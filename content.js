/**
 * Content Script for PriorityPing - CMU Canvas
 */
(function() {
  let classifier = null;
  let observer = null;
  let lastDigest = '';
  let lastMapped = [];
  let currentWindowMs = 7 * 24 * 3600 * 1000;

  async function init() {
    try {
      const response = await fetch(chrome.runtime.getURL('model/weights.json'));
      const weights = await response.json();
      classifier = new window.CanvasClassifier(weights);
      window.CanvasClassifierInstance = classifier;
      
      const storage = await chrome.storage.local.get(['ppTimeWindow', 'ppDeadlineCache']);
      const winMap = { today: 24*3600*1000, '3days': 3*24*3600*1000, '7days': 7*24*3600*1000, all: Infinity };
      currentWindowMs = winMap[storage.ppTimeWindow || '7days'];

      // If on an assignment or discussion page, scrape the due date
      if (document.querySelector('#assignment_show, #discussion_topic_show')) {
        scrapeDeadline();
      }

      startObserver();
      processNotifications();
    } catch (err) {
      console.error('PriorityPing init failed:', err);
    }
  }

  /**
   * Scrapes the precise due date from an assignment or discussion page and caches it.
   */
  async function scrapeDeadline() {
    let dueDateRaw = null;
    
    // Assignment Page Structure (Screenshots 2 & 3)
    const assignmentDateContainer = document.querySelector('.student-assignment-overview .date_text');
    if (assignmentDateContainer) {
        if (assignmentDateContainer.textContent.includes('No Due Date')) {
            dueDateRaw = "None";
        } else {
            const datePart = assignmentDateContainer.querySelector('.display_date')?.textContent.trim();
            const timePart = assignmentDateContainer.querySelector('.display_time')?.textContent.trim();
            if (datePart && timePart) {
                dueDateRaw = `${datePart} ${timePart}`;
            } else {
                dueDateRaw = assignmentDateContainer.textContent.trim();
            }
        }
    }
    
    // Discussion Page Structure (Screenshot 4)
    if (!dueDateRaw || dueDateRaw === "None") {
        const discussionDateEl = document.querySelector('.discussions-show-due-dates');
        if (discussionDateEl) {
            dueDateRaw = discussionDateEl.textContent.trim().replace('Due ', '');
        }
    }

    const titleEl = document.querySelector('.assignment-title h1, .discussion-title, .assignment-title');
    const urlParts = window.location.pathname.match(/\/courses\/(\d+)\//);
    
    if (dueDateRaw && titleEl && urlParts) {
      const courseId = urlParts[1];
      const title = titleEl.textContent.trim();
      
      const storage = await chrome.storage.local.get('ppDeadlineCache');
      const cache = storage.ppDeadlineCache || {};
      
      const cacheKey = `${courseId}_${title}`;
      cache[cacheKey] = {
         dueDate: dueDateRaw,
         scrapedAt: Date.now()
      };
      
      await chrome.storage.local.set({ ppDeadlineCache: cache });
      console.log('PriorityPing cached real deadline:', title, dueDateRaw);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => {
        // If the URL changed but script didn't re-run, check for assignment/discussion page
        if (document.querySelector('#assignment_show, #discussion_topic_show')) {
            scrapeDeadline();
        }
        processNotifications();
    }, 800));
    const target = document.querySelector('#application') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  function collectNotificationElements() {
    // Priority 1: Table structure from Screenshot 1
    const tableRows = Array.from(document.querySelectorAll('table#assignment-details tbody tr, table.stream-details tbody tr'));
    if (tableRows.length > 0) return { elements: tableRows, type: 'table' };
    
    // Priority 2: List structure
    const categories = Array.from(document.querySelectorAll('li.stream-category'));
    return { elements: categories, type: 'list' };
  }

  function parseElement(el) {
    const titleEl = el.querySelector('a.content_summary');
    if (!titleEl) return null;
    
    const courseEl = el.querySelector('span.fake-link');
    // Using Screenshot 1 logic: td.date -> span[data-html-tooltip-title]
    const dateCell = el.querySelector('td.date');
    const dateSpan = dateCell?.querySelector('span[data-html-tooltip-title]') || dateCell?.querySelector('span');
    const dateText = dateSpan?.getAttribute('data-html-tooltip-title') || dateSpan?.textContent?.trim();

    const categoryHint = el.closest('[data-category]')?.dataset.category;

    const rawTitle = titleEl.textContent.trim();
    const courseName = courseEl?.textContent.trim() || 'General';
    
    let type = 'announcement_info';
    if (categoryHint === 'Announcement') type = 'announcement_info';
    else if (categoryHint === 'Assignment') type = 'assignment_due';
    else if (categoryHint === 'DiscussionTopic') type = 'discussion';
    else if (categoryHint === 'Submission') type = 'grade_posted';
    else type = inferTypeFromTitle(rawTitle);

    return {
      id: rawTitle + (dateText || ''),
      title: rawTitle.replace(courseName, '').replace(/^[:-]\s*/, '').trim(),
      course_name: courseName,
      notification_type: type,
      date_received: dateText,
      raw_el: el
    };
  }

  function parseDueDays(title, courseId = null, cache = {}) {
    // 1. Check cache first (precise scraping from Screenshot 2)
    const cacheKey = `${courseId}_${title}`;
    if (cache[cacheKey]) {
        const cachedDate = new Date(cache[cacheKey].dueDate);
        if (!isNaN(cachedDate.getTime())) {
            const diff = cachedDate.getTime() - Date.now();
            return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
        }
    }

    // 2. Generic Regex fallback
    const t = title.toLowerCase();
    if (/due tonight|by midnight|due today/.test(t)) return 0;
    if (/due tomorrow/.test(t)) return 1;
    const match = t.match(/due in (\d+) days/);
    if (match) return parseInt(match[1]);
    
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekdays.length; i++) {
        if (t.includes(`due ${weekdays[i]}`)) {
            const today = new Date().getDay();
            const target = i;
            let diff = target - today;
            if (diff < 0) diff += 7;
            return diff;
        }
    }
    return -1;
  }

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function inferTypeFromTitle(text) {
    const t = text.toLowerCase();
    if (/quiz|exam|midterm|final/.test(t)) return 'quiz_exam';
    if (/grade|graded|score|feedback posted/.test(t)) return 'grade_posted';
    if (/announcement/.test(t) && /urgent|important|due/.test(t)) return 'announcement_urgent';
    if (/announcement|update|info/.test(t)) return 'announcement_info';
    if (/discussion|reply|thread/.test(t)) return 'discussion';
    if (/group|team|collaboration|peer/.test(t)) return 'group_collab';
    if (/event|seminar|workshop|optional/.test(t)) return 'event_optional';
    if (/assignment|homework|submit|submission|due/.test(t)) return 'assignment_due';
    return 'announcement_info';
  }

  function isWithinWindow(dateText, windowMs) {
    if (windowMs === Infinity) return true;
    if (!dateText) return false;
    try {
      // Normalize Canvas date (e.g., "Apr 22 at 7:58pm")
      let cleanDate = dateText.replace(' at ', ' ');
      // Append current year if missing
      if (!cleanDate.includes(new Date().getFullYear().toString())) {
          cleanDate += ` ${new Date().getFullYear()}`;
      }
      const d = new Date(cleanDate);
      if (isNaN(d.getTime())) return true;
      return (Date.now() - d.getTime()) <= windowMs;
    } catch (e) { return true; }
  }

  /**
   * Background pre-fetcher for assignments and discussions.
   */
  async function preFetchDeadlines(notifications) {
    const storage = await chrome.storage.local.get('ppDeadlineCache');
    const cache = storage.ppDeadlineCache || {};
    let cacheUpdated = false;

    const pending = notifications.filter(item => {
      const isTriagable = item.notification_type === 'assignment_due' || item.notification_type === 'discussion';
      if (!isTriagable) return false;
      
      const link = item.raw_el?.querySelector('a.content_summary')?.getAttribute('href');
      if (!link) return false;
      
      const parts = link.match(/\/courses\/(\d+)\//);
      if (!parts) return false;
      
      const cacheKey = `${parts[1]}_${item.title}`;
      return !cache[cacheKey];
    });

    if (pending.length === 0) return;

    console.log(`PriorityPing: Background fetching ${pending.length} deadlines...`);

    for (const item of pending.slice(0, 3)) {
      const link = item.raw_el.querySelector('a.content_summary').getAttribute('href');
      const parts = link.match(/\/courses\/(\d+)\//);
      const cacheKey = `${parts[1]}_${item.title}`;

      try {
        const response = await fetch(link);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        let dueDateRaw = null;
        
        // Peek Assignment
        const assignmentDateContainer = doc.querySelector('.student-assignment-overview .date_text');
        if (assignmentDateContainer) {
            if (assignmentDateContainer.textContent.includes('No Due Date')) {
                dueDateRaw = "None";
            } else {
                const datePart = assignmentDateContainer.querySelector('.display_date')?.textContent.trim();
                const timePart = assignmentDateContainer.querySelector('.display_time')?.textContent.trim();
                dueDateRaw = (datePart && timePart) ? `${datePart} ${timePart}` : assignmentDateContainer.textContent.trim();
            }
        }
        
        // Peek Discussion
        if (!dueDateRaw) {
            const discEl = doc.querySelector('.discussions-show-due-dates');
            if (discEl) dueDateRaw = discEl.textContent.trim().replace('Due ', '');
        }

        if (dueDateRaw) {
          cache[cacheKey] = {
            dueDate: dueDateRaw,
            scrapedAt: Date.now()
          };
          cacheUpdated = true;
          console.log(`PriorityPing: Auto-fetched real deadline for ${item.title}: ${dueDateRaw}`);
        }
      } catch (err) { }
    }

    if (cacheUpdated) {
      await chrome.storage.local.set({ ppDeadlineCache: cache });
      lastDigest = ''; // Force re-render
      processNotifications();
    }
  }

  async function processNotifications() {
    const { elements, type } = collectNotificationElements();
    if (elements.length === 0) return;

    const storage = await chrome.storage.local.get('ppDeadlineCache');
    const deadlineCache = storage.ppDeadlineCache || {};

    const parsed = elements
      .map(el => parseElement(el))
      .filter(p => p && isWithinWindow(p.date_received, currentWindowMs));

    const digest = parsed.map(p => p.id).join('|');
    if (digest === lastDigest) return;
    lastDigest = digest;

    const isRecentActivityActive = !!document.querySelector('ul.recent_activity, table.stream-details');

    lastMapped = parsed.map(item => {
      const obj = {
        title: item.title,
        notification_type: item.notification_type,
        course_name: item.course_name,
        has_deadline: item.notification_type === 'assignment_due' || item.notification_type === 'quiz_exam' || item.notification_type === 'discussion' ? 1 : 0,
        days_until_deadline: parseDueDays(item.title, item.course_name, deadlineCache),
        is_graded: ['assignment_due', 'quiz_exam', 'grade_posted'].includes(item.notification_type) ? 1 : 0,
        requires_submission: ['assignment_due', 'quiz_exam', 'discussion'].includes(item.notification_type) ? 1 : 0,
        teacher_posted: item.notification_type === 'discussion' ? 0 : 1,
        estimated_time_hours: item.notification_type === 'assignment_due' ? 4 : 1,
        title_has_urgent_kw: /due|tonight|urgent|reminder|missing|overdue|important|final|deadline/i.test(item.title) ? 1 : 0,
        has_time_reference: /tonight|today|by midnight|this week|tomorrow|friday|sunday/i.test(item.title) ? 1 : 0,
        course_credits: (item.course_name === '67272' || item.course_name === '15150') ? 12 : 9,
        raw_el: item.raw_el // keep reference for pre-fetcher
      };
      
      return {
          ...obj,
          prediction: classifier.predict(obj)
      };
    });

    window.PriorityPingUI.render(lastMapped, { recentActivityActive: isRecentActivityActive });

    // Trigger pre-fetcher for any missing dates
    preFetchDeadlines(lastMapped);
  }


  window.ppSetWindow = (ms) => {
      currentWindowMs = ms;
      lastDigest = ''; // Force re-render
      processNotifications();
  };

  init();
})();
