/**
 * Settings Logic for PriorityPing
 */
document.addEventListener('DOMContentLoaded', async () => {
  const courseList = document.getElementById('course-list');
  const demoToggle = document.getElementById('demo-mode');
  const timeWindow = document.getElementById('time-window');

  const storage = await chrome.storage.local.get(['ppSeenCourses', 'ppCourseWeights', 'ppTimeWindow', 'ppDemoMode']);
  const seen = storage.ppSeenCourses || [];
  const weights = storage.ppCourseWeights || {};

  demoToggle.checked = storage.ppDemoMode || false;
  timeWindow.value = storage.ppTimeWindow || '7days';

  if (seen.length === 0) {
    courseList.innerHTML = '<div class="empty">No courses detected yet. Visit Canvas to populate this list.</div>';
  } else {
    seen.forEach(cid => {
      const w = weights[cid] || 2;
      const row = document.createElement('div');
      row.className = 'course-row';
      row.innerHTML = `
        <span class="course-id">${cid}</span>
        <div class="priority-group" data-id="${cid}">
          <button data-val="1" ${w === 1 ? 'class="active"' : ''}>Low</button>
          <button data-val="2" ${w === 2 ? 'class="active"' : ''}>Med</button>
          <button data-val="3" ${w === 3 ? 'class="active"' : ''}>High</button>
        </div>
      `;
      courseList.appendChild(row);
    });
  }

  courseList.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
      const cid = e.target.closest('.priority-group').dataset.id;
      const val = parseInt(e.target.dataset.val);
      
      const res = await chrome.storage.local.get('ppCourseWeights');
      const cur = res.ppCourseWeights || {};
      cur[cid] = val;
      await chrome.storage.local.set({ ppCourseWeights: cur });
      
      // Update UI
      e.target.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  demoToggle.onchange = () => chrome.storage.local.set({ ppDemoMode: demoToggle.checked });
  timeWindow.onchange = () => chrome.storage.local.set({ ppTimeWindow: timeWindow.value });
});
