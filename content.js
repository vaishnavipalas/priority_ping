/**
 * Content Script for PriorityPing - CMU Canvas
 */
(function() {
  let classifier = null;
  let observer = null;
  let weights = {};
  let seenCourses = new Set();
  let lastDigest = '';

  const URGENT_REGEX = /due|tonight|urgent|reminder|missing|overdue|important|final|deadline|past due|late|by midnight|due today|due tomorrow|closes/i;
  const TIME_REF_REGEX = /today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}/i;

  async function init() {
    try {
      const wResponse = await fetch(chrome.runtime.getURL('model/weights.json'));
      const wData = await wResponse.json();
      classifier = new window.CanvasClassifier(wData);

      // Listen for storage changes (importance updates)
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.ppCourseWeights || changes.ppTimeWindow) {
           processNotifications();
        }
      });

      startObserver();
      processNotifications();
    } catch (err) {
      console.error('PriorityPing init failed:', err);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => processNotifications(), 800));
    const target = document.querySelector('#application') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  async function processNotifications() {
    const rows = Array.from(document.querySelectorAll('li.stream-category table.stream-details tbody tr'));
    if (rows.length === 0) return;

    const storage = await chrome.storage.local.get(['ppCourseWeights', 'ppTimeWindow', 'ppSeenCourses']);
    const courseWeights = storage.ppCourseWeights || {};
    const timeWindow = storage.ppTimeWindow || '7days';
    const oldSeen = storage.ppSeenCourses || [];
    seenCourses = new Set(oldSeen);

    const parsed = rows.map(row => parseRow(row, courseWeights)).filter(p => p !== null);
    
    // Update seen courses
    const currentSeen = Array.from(seenCourses);
    if (currentSeen.length !== oldSeen.length) {
       chrome.storage.local.set({ ppSeenCourses: currentSeen });
    }

    // Filter by time window (for display only)
    const filtered = parsed.filter(item => isWithinWindow(item.date_posted, timeWindow));

    const digest = filtered.map(f => f.id).join('|');
    if (digest === lastDigest) return;
    lastDigest = digest;

    const results = filtered.map(item => {
      const explanation = classifier.explain(item.features);
      return {
        ...item,
        explanation
      };
    });

    if (window.PriorityPingUI) {
      window.PriorityPingUI.render(results);
    }
  }

  function parseRow(row, courseWeights) {
    const titleLink = row.querySelector('a.content_summary');
    if (!titleLink) return null;

    const href = titleLink.getAttribute('href') || '';
    const courseMatch = href.match(/\/courses\/(\d+)/);
    const courseId = courseMatch ? courseMatch[1] : null;
    if (courseId) seenCourses.add(courseId);

    const categoryLi = row.closest('li.stream-category');
    const category = categoryLi?.dataset.category || 'Announcement';

    const dateCell = row.querySelector('td.date span[data-html-tooltip-title]');
    const datePosted = dateCell?.getAttribute('data-html-tooltip-title') || '';

    const fullTitle = titleLink.textContent.trim();
    const fakeLink = titleLink.querySelector('.fake-link');
    const cleanTitle = fullTitle.replace(fakeLink?.textContent || '', '').replace(/^[:-]\s*/, '').trim();

    const bucket = ['Assignment', 'DiscussionTopic', 'Submission'].includes(category) || cleanTitle.toLowerCase().includes('quiz') ? 'action' : 'info';
    
    const features = {
      bucket,
      course_id: courseId,
      course_importance: courseWeights[courseId] || 2,
      title_has_urgent_kw: URGENT_REGEX.test(cleanTitle) ? 1 : 0,
      title_has_time_ref: TIME_REF_REGEX.test(cleanTitle) ? 1 : 0
    };

    if (bucket === 'action') {
      let typeWeight = 3;
      if (cleanTitle.toLowerCase().includes('missing')) typeWeight = 5;
      else if (cleanTitle.toLowerCase().includes('quiz')) typeWeight = 5;
      else if (category === 'Submission') typeWeight = 2;

      features.notification_type = typeWeight;
      features.requires_action = (typeWeight >= 3 && category !== 'Submission') ? 1 : 0;
      features.is_graded = (category === 'Assignment' || category === 'Submission') ? 1 : 0;
    } else {
      let typeWeight = 2;
      if (features.title_has_urgent_kw) typeWeight = 4;
      if (category === 'Conversation' || category === 'Message') typeWeight = 1;

      features.announcement_type = typeWeight;
      features.is_course_wide = courseId ? 1 : 0;
    }

    return {
      id: cleanTitle + datePosted,
      title: cleanTitle,
      course_id: courseId,
      date_posted: datePosted,
      category,
      features
    };
  }

  function isWithinWindow(dateStr, windowKey) {
    if (windowKey === 'all') return true;
    const winDays = { today: 1, '3days': 3, '7days': 7 };
    const maxMs = winDays[windowKey] * 24 * 3600 * 1000;
    
    try {
      // Normalize Canvas date "Apr 22 at 7:58pm"
      let dStr = dateStr.replace(' at ', ' ');
      if (!dStr.includes(new Date().getFullYear())) dStr += ` ${new Date().getFullYear()}`;
      const d = new Date(dStr);
      return (Date.now() - d.getTime()) <= maxMs;
    } catch (e) { return true; }
  }

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  window.ppSetWindow = (ms) => {
    chrome.storage.local.set({ ppTimeWindow: ms });
  };

  init();
})();
