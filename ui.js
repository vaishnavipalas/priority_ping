/**
 * PriorityPing UI Layer
 */
window.PriorityPingUI = {
  render(notifications) {
    let sidebar = document.getElementById('pp-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = 'pp-sidebar';
      document.body.appendChild(sidebar);
      document.body.classList.add('pp-active');
      
      // Global listener for interactions
      sidebar.addEventListener('click', (e) => {
        const toggle = e.target.closest('.pp-exp-toggle');
        if (toggle) {
          const bullets = toggle.parentElement.querySelector('.pp-bullets');
          bullets.classList.toggle('open');
          toggle.textContent = bullets.classList.contains('open') ? 'Hide reasoning ▴' : 'Why this priority? ▾';
          return;
        }

        const dismiss = e.target.closest('.pp-dismiss');
        if (dismiss) {
          dismiss.closest('.pp-card').remove();
        }
      });
    }

    const isDemo = notifications.length > 0 && notifications[0].is_demo;

    const sections = {
      action: notifications.filter(n => n.explanation.bucket === 'action').sort((a,b) => b.explanation.score - a.explanation.score),
      fyi: notifications.filter(n => n.explanation.bucket === 'info').sort((a,b) => b.explanation.score - a.explanation.score)
    };

    sidebar.innerHTML = `
      <div class="pp-header">
        <h1>PriorityPing ${isDemo ? '<span class="pp-demo-badge">Demo</span>' : ''}</h1>
        <div class="pp-tagline">PriorityPing helps you decide what to look at first — the final call is always yours.</div>
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
        <button class="pp-dismiss">🗑</button>
        <div class="pp-badge-row">
          <span class="pp-badge ${priority}">${exp.priority_label}</span>
          ${item.course_label ? `<span class="pp-course-label">${item.course_label}</span>` : ''}
          <span class="pp-confidence">${exp.confidence}% confidence</span>
          ${item.is_demo ? '<span class="pp-demo-badge">DEMO</span>' : ''}
        </div>
        <div class="pp-title">${item.title}</div>
        <div class="pp-category">${item.category} • ${item.source === 'todo' ? 'Due ' + item.due_date : item.date_posted}</div>
        
        <div class="pp-exp-wrapper">
          <span class="pp-exp-toggle">Why this priority? ▾</span>
          <div class="pp-bullets">
            ${exp.bullets.map(b => `<div class="pp-bullet">${b}</div>`).join('')}
            ${exp.suppressed_reason ? `<div class="pp-suppressed">💡 ${exp.suppressed_reason}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
};
