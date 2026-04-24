/**
 * PriorityPing UI Layer
 */
window.PriorityPingUI = {
  render(notifications, winKey) {
    let sidebar = document.getElementById('pp-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = 'pp-sidebar';
      document.body.appendChild(sidebar);
      document.body.classList.add('pp-active');

      sidebar.addEventListener('click', (e) => {
        // Filter button
        const filterBtn = e.target.closest('.pp-filter-btn');
        if (filterBtn) {
          const key = filterBtn.dataset.key;
          chrome.storage.local.set({ ppTimeWindow: key });
          return;
        }

        // Why toggle
        const toggle = e.target.closest('.pp-exp-toggle');
        if (toggle) {
          const bullets = toggle.parentElement.querySelector('.pp-bullets');
          bullets.classList.toggle('open');
          toggle.textContent = bullets.classList.contains('open') ? 'Hide ▴' : 'Why? ▾';
          return;
        }

        // Dismiss
        const dismiss = e.target.closest('.pp-dismiss');
        if (dismiss) {
          dismiss.closest('.pp-card').remove();
        }
      });
    }

    const isDemo = notifications.length > 0 && notifications[0].is_demo;
    const currentKey = winKey || 'all';

    const filters = [
      { key: 'today', label: 'Today' },
      { key: '3days', label: '3 Days' },
      { key: '7days', label: '7 Days' },
      { key: 'all',   label: 'All' },
    ];

    const sections = {
      action: notifications.filter(n => n.explanation.bucket === 'action').sort((a,b) => b.explanation.score - a.explanation.score),
      fyi: notifications.filter(n => n.explanation.bucket === 'info').sort((a,b) => b.explanation.score - a.explanation.score)
    };

    sidebar.innerHTML = `
      <div class="pp-header">
        <div class="pp-header-top">
          <div class="pp-logo">PP</div>
          <div class="pp-header-text">
            <div class="pp-title-row">PriorityPing ${isDemo ? '<span class="pp-demo-badge">Demo</span>' : ''}</div>
            <div class="pp-tagline">Prioritized Canvas notifications</div>
          </div>
        </div>
        <div class="pp-filter-row">
          ${filters.map(f => `
            <button class="pp-filter-btn ${f.key === currentKey ? 'active' : ''}" data-key="${f.key}">${f.label}</button>
          `).join('')}
        </div>
      </div>
      <div class="pp-scroll">
        ${this.renderSection('Needs Action', sections.action)}
        ${this.renderSection('FYI', sections.fyi)}
      </div>
    `;
  },

  renderSection(title, items) {
    if (items.length === 0) return '';
    return `
      <div class="pp-section">
        <div class="pp-section-label">${title}</div>
        ${items.map(item => this.renderCard(item)).join('')}
      </div>
    `;
  },

  renderCard(item) {
    const exp = item.explanation;
    const priority = exp.priority_label.toLowerCase();

    return `
      <div class="pp-card ${priority}">
        <button class="pp-dismiss">&#x2715;</button>
        <div class="pp-badge-row">
          <span class="pp-badge ${priority}">${exp.priority_label}</span>
          ${item.course_label ? `<span class="pp-course-label">${item.course_label}</span>` : ''}
          <span class="pp-confidence">${exp.confidence}% confidence</span>
          ${item.is_demo ? '<span class="pp-demo-badge">DEMO</span>' : ''}
        </div>
        <div class="pp-title">${item.title}</div>
        <div class="pp-category">${item.category} • ${item.source === 'todo' ? 'Due ' + item.due_date : 'Posted ' + item.date_posted}</div>

        <div class="pp-exp-wrapper">
          <span class="pp-exp-toggle">Why? ▾</span>
          <div class="pp-bullets">
            ${exp.factors.map(f => `
              <div class="pp-factor">
                <span class="pp-factor-label ${f.direction}">${f.label}</span>
              </div>
            `).join('')}
            ${exp.suppressed_reason ? `<div class="pp-suppressed">&#x1F4A1; ${exp.suppressed_reason}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
};
