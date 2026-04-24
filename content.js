/**
 * Content Script for PriorityPing
 */
(function() {
  let classifier = null;
  let observer = null;
  let weights = null;
  let currentWindowMs = 7 * 24 * 3600 * 1000;
  let lastDigest = '';

  const URGENT_REGEX = /due tonight|urgent|overdue|missing|past due|late|closes|by midnight|due today|due tomorrow|final reminder|changed|cancelled|cancellation/i;
  const TIME_REF_REGEX = /today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}/i;

  async function fetchCourseNames() {
    try {
      const resp = await fetch('/api/v1/courses?per_page=100&enrollment_type=student');
      const courses = await resp.json();
      if (!Array.isArray(courses)) return;
      const names = {};
      courses.forEach(c => { names[String(c.id)] = c.course_code || c.name; });
      await chrome.storage.local.set({ ppCourseNames: names });
    } catch(e) { console.warn("PriorityPing: Could not fetch course names", e); }
  }

  async function init() {
    console.log("PriorityPing: Initializing...");
    try {
      const resp = await fetch(chrome.runtime.getURL('weights.json'));
      weights = await resp.json();
      classifier = new window.CanvasClassifier(weights);
      console.log("PriorityPing: Classifier loaded.");
      fetchCourseNames();

      // Listener for storage changes (settings)
      chrome.storage.onChanged.addListener((changes) => {
        console.log("PriorityPing: Storage changed, re-processing...");
        process();
      });

      startObserver();
      process();
    } catch (e) { console.error("PriorityPing init failed", e); }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => {
      chrome.storage.local.get('ppDemoMode', (data) => {
        if (!data.ppDemoMode) {
          console.log("PriorityPing: DOM changed, re-scraping...");
          process();
        }
      });
    }, 800));
    const target = document.querySelector('#application') || document.body;
    observer.observe(target, { childList: true, subtree: true });
    console.log("PriorityPing: Mutation observer active.");
  }

  async function process() {
    console.log("PriorityPing: Processing notifications...");
    const storage = await chrome.storage.local.get(['ppCourseWeights', 'ppTimeWindow', 'ppDemoMode', 'ppSeenCourses', 'ppCourseNames']);
    const courseWeights = storage.ppCourseWeights || {};
    const courseNames = storage.ppCourseNames || {};
    const winKey = storage.ppTimeWindow || '7days';
    const isDemo = storage.ppDemoMode || false;
    const seenCodes = new Set(storage.ppSeenCourses || []);

    const winMap = { today: 24*3600*1000, '3days': 3*24*3600*1000, '7days': 7*24*3600*1000, all: Infinity };
    currentWindowMs = winMap[winKey];

    let items = [];
    if (isDemo) {
      items = window.PP_DEMO_DATA;
    } else {
      const rows = document.querySelectorAll('li.stream-category table.stream-details tbody tr');
      rows.forEach(row => {
        const parsed = parseRow(row, seenCodes);
        if (parsed) items.push(parsed);
      });
      // Save newly seen courses
      chrome.storage.local.set({ ppSeenCourses: Array.from(seenCodes) });
    }

    const filtered = items.filter(it => isWithinWindow(it.date_posted, currentWindowMs));
    const digest = filtered.map(f => f.id).join('|');
    if (digest === lastDigest) return;
    lastDigest = digest;

    const results = filtered.map(it => {
      const features = buildFeatures(it, courseWeights);
      return {
        ...it,
        course_label: courseNames[it.course_id] || it.course_id || '',
        is_demo: isDemo,
        explanation: classifier.explain(features)
      };
    });

    if (window.PriorityPingUI) {
      window.PriorityPingUI.render(results);
    }
  }

  function parseRow(row, seenCodes) {
    const titleLink = row.querySelector('a.content_summary');
    if (!titleLink) return null;

    const href = titleLink.getAttribute('href') || '';
    const courseId = href.match(/\/courses\/(\d+)/)?.[1] || null;
    if (courseId) seenCodes.add(courseId);

    const fullTitle = titleLink.textContent.trim();
    const fakeLink = titleLink.querySelector('.fake-link');
    const cleanTitle = fullTitle.replace(fakeLink?.textContent || '', '').replace(/^[:-]\s*/, '').trim();

    const categoryLi = row.closest('li.stream-category');
    const category = categoryLi?.dataset.category || 'Announcement';

    const dateCell = row.querySelector('td.date span[data-html-tooltip-title]');
    const datePosted = dateCell?.getAttribute('data-html-tooltip-title') || '';

    return {
      id: cleanTitle + datePosted,
      title: cleanTitle,
      course_id: courseId,
      date_posted: datePosted,
      category: category
    };
  }

  function buildFeatures(item, courseWeights) {
    const t = item.title.toLowerCase();
    const cat = item.category;
    let bucket = 'info';
    let type = 'announcement';
    let subtypeWeight = 2;

    // Taxonomy Logic
    if (['Assignment', 'DiscussionTopic', 'Submission'].includes(cat) || t.includes('quiz') || t.includes('exam')) {
      bucket = 'action';
      if (t.includes('due date change')) { type = 'due_date_change'; subtypeWeight = 4; }
      else if (t.includes('peer review')) { type = 'peer_review'; subtypeWeight = 4; }
      else if (cat === 'Submission') { type = 'grade_posted'; subtypeWeight = 3; }
      else if (cat === 'DiscussionTopic') { type = 'discussion_topic'; subtypeWeight = 2; }
      else {
        type = 'assignment';
        if (/final|midterm/.test(t)) subtypeWeight = 5;
        else if (/exam|quiz/.test(t)) subtypeWeight = 4;
        else if (/homework|lab|project/.test(t)) subtypeWeight = 3;
        else if (t.includes('discussion')) subtypeWeight = 2;
        else if (/participation|reading/.test(t)) subtypeWeight = 1;
        else subtypeWeight = 2;
      }
    } else {
      if (cat === 'Conversation' || cat === 'Message') { type = 'conversation'; subtypeWeight = 3; }
      else if (t.includes('grading policy')) { type = 'policy_change'; subtypeWeight = 2; }
      else if (t.includes('recording ready')) { type = 'recording_ready'; subtypeWeight = 1; }
    }

    const common = {
      bucket,
      course_importance: courseWeights[item.course_id] || 2,
      subtype_weight: subtypeWeight,
      title_has_urgent_kw: URGENT_REGEX.test(item.title) ? 1 : 0,
      title_has_time_ref: TIME_REF_REGEX.test(item.title) ? 1 : 0
    };

    if (bucket === 'action') {
      return {
        ...common,
        is_reminder_or_missing: /reminder:|missing:|overdue|past due/i.test(item.title) ? 1 : 0,
        is_grade_impacting: /grade|graded|score|points|feedback/i.test(item.title) || subtypeWeight >= 3 ? 1 : 0,
        requires_action: /submission confirmed/i.test(item.title) ? 0 : 1,
        is_group_item: /group|team|peer|collaboration/i.test(item.title) ? 1 : 0,
        is_instructor_posted: !(/^reminder:|^missing:/i.test(item.title)) ? 1 : 0,
        is_mention: t.includes('mention') ? 1 : 0
      };
    } else {
      return {
        ...common,
        is_course_wide: item.course_id ? 1 : 0,
        is_direct_message: type === 'conversation' ? 1 : 0,
        is_global: cat === 'GlobalAnnouncement' ? 1 : 0
      };
    }
  }

  function isWithinWindow(dateStr, windowMs) {
    if (windowMs === Infinity) return true;
    if (!dateStr) return false;
    try {
      let dStr = dateStr.replace(' at ', ' ');
      // Normalize "8am" → "8:00 AM" and "10:07am" → "10:07 AM"
      dStr = dStr.replace(/(\d+)(?::(\d+))?(am|pm)/i, (_, h, m, period) =>
        `${h}:${m || '00'} ${period.toUpperCase()}`
      );
      if (!dStr.includes(String(new Date().getFullYear()))) dStr += ` ${new Date().getFullYear()}`;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return false;
      return (Date.now() - d.getTime()) <= windowMs;
    } catch (e) { return false; }
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
