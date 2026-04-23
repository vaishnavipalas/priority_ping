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
      
      const storage = await chrome.storage.local.get(['ppTimeWindow']);
      const winMap = { today: 24*3600*1000, '3days': 3*24*3600*1000, '7days': 7*24*3600*1000, all: Infinity };
      currentWindowMs = winMap[storage.ppTimeWindow || '7days'];

      startObserver();
      processNotifications();
    } catch (err) {
      console.error('PriorityPing init failed:', err);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => {
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

  async function processNotifications() {
    const { elements, type } = collectNotificationElements();
    if (elements.length === 0) return;

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
        is_graded: ['assignment_due', 'quiz_exam', 'grade_posted'].includes(item.notification_type) ? 1 : 0,
        requires_submission: ['assignment_due', 'quiz_exam', 'discussion'].includes(item.notification_type) ? 1 : 0,
        teacher_posted: item.notification_type === 'discussion' ? 0 : 1,
        estimated_time_hours: item.notification_type === 'assignment_due' ? 4 : 1,
        title_has_urgent_kw: /due|tonight|urgent|reminder|missing|overdue|important|final|deadline|past due|late|by midnight|due today|due tomorrow|closes/i.test(item.title) ? 1 : 0,
        has_time_reference: /tonight|today|by midnight|this week|tomorrow|friday|sunday/i.test(item.title) ? 1 : 0,
        course_credits: (item.course_name === '67272' || item.course_name === '15150') ? 12 : 9
      };
      
      return {
          ...obj,
          prediction: classifier.predict(obj)
      };
    });

    window.PriorityPingUI.render(lastMapped, { recentActivityActive: isRecentActivityActive });
  }


  window.ppSetWindow = (ms) => {
      currentWindowMs = ms;
      lastDigest = ''; // Force re-render
      processNotifications();
  };

  init();
})();
