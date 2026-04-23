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
      
      const storage = await chrome.storage.local.get('ppTimeWindow');
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
    observer = new MutationObserver(debounce(() => processNotifications(), 500));
    const target = document.querySelector('#application') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function collectNotificationElements() {
    const rows = Array.from(document.querySelectorAll('table.stream-details tbody tr'));
    if (rows.length > 0) return { elements: rows, type: 'table' };
    
    const categories = Array.from(document.querySelectorAll('li.stream-category'));
    return { elements: categories, type: 'list' };
  }

  function parseElement(el) {
    const titleEl = el.querySelector('a.content_summary');
    if (!titleEl) return null;
    
    const courseEl = el.querySelector('span.fake-link');
    const dateEl = el.querySelector('td.date span') || el.querySelector('.date');
    const categoryHint = el.closest('[data-category]')?.dataset.category;

    const rawTitle = titleEl.textContent.trim();
    const courseName = courseEl?.textContent.trim() || 'General';
    const dateText = dateEl?.getAttribute('data-html-tooltip-title') || dateEl?.textContent.trim();
    
    let type = 'announcement_info';
    if (categoryHint === 'Announcement') type = 'announcement_info';
    else if (categoryHint === 'Assignment') type = 'assignment_due';
    else if (categoryHint === 'DiscussionTopic') type = 'discussion';
    else if (categoryHint === 'Submission') type = 'grade_posted';
    else type = inferTypeFromTitle(rawTitle);

    return {
      id: rawTitle + dateText,
      title: rawTitle.replace(courseName, '').replace(/^[:-]\s*/, '').trim(),
      course_name: courseName,
      notification_type: type,
      date_text: dateText,
      raw_el: el
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

  function parseDueDays(title) {
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

  function isWithinWindow(dateText, windowMs) {
    if (windowMs === Infinity) return true;
    try {
      const d = new Date(dateText);
      if (isNaN(d.getTime())) return true;
      return (Date.now() - d.getTime()) <= windowMs;
    } catch (e) { return true; }
  }

  function processNotifications() {
    const { elements, type } = collectNotificationElements();
    if (elements.length === 0) return;

    const parsed = elements
      .map(el => parseElement(el))
      .filter(p => p && isWithinWindow(p.date_text, currentWindowMs));

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
        days_until_deadline: parseDueDays(item.title),
        is_graded: ['assignment_due', 'quiz_exam', 'grade_posted'].includes(item.notification_type) ? 1 : 0,
        requires_submission: ['assignment_due', 'quiz_exam', 'discussion'].includes(item.notification_type) ? 1 : 0,
        teacher_posted: item.notification_type === 'discussion' ? 0 : 1,
        estimated_time_hours: item.notification_type === 'assignment_due' ? 4 : 1,
        title_has_urgent_kw: /due|tonight|urgent|reminder|missing|overdue|important|final|deadline/i.test(item.title) ? 1 : 0,
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
