/**
 * Settings Logic for PriorityPing
 */
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('course-settings');
  const winSelect = document.getElementById('time-window');

  const storage = await chrome.storage.local.get(['ppSeenCourses', 'ppCourseWeights', 'ppTimeWindow', 'ppCourseNames']);
  const seen = storage.ppSeenCourses || [];
  const weights = storage.ppCourseWeights || {};
  const courseNames = storage.ppCourseNames || {};
  const currentTimeWindow = storage.ppTimeWindow || '7days';

  winSelect.value = currentTimeWindow;

  if (seen.length === 0) {
    container.innerHTML = '<p class="empty-state">No courses detected yet. Visit your Canvas dashboard.</p>';
  } else {
    seen.forEach(courseId => {
      const currentWeight = weights[courseId] || 2;
      const row = document.createElement('div');
      row.className = 'course-row';
      row.innerHTML = `
        <span class="course-id">${courseNames[courseId] || courseId}</span>
        <div class="toggle-group" data-id="${courseId}">
          <button data-val="1" ${currentWeight === 1 ? 'class="active"' : ''}>Low</button>
          <button data-val="2" ${currentWeight === 2 ? 'class="active"' : ''}>Med</button>
          <button data-val="3" ${currentWeight === 3 ? 'class="active"' : ''}>High</button>
        </div>
      `;
      container.appendChild(row);
    });
  }

  // Handle weight toggles
  container.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
      const btn = e.target;
      const val = parseInt(btn.dataset.val);
      const courseId = btn.parentNode.dataset.id;
      
      // Update UI
      btn.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Save
      const s = await chrome.storage.local.get('ppCourseWeights');
      const w = s.ppCourseWeights || {};
      w[courseId] = val;
      await chrome.storage.local.set({ ppCourseWeights: w });
    }
  });

  // Handle time window
  winSelect.onchange = () => {
    chrome.storage.local.set({ ppTimeWindow: winSelect.value });
  };
});
