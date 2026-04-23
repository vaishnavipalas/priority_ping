/**
 * PriorityPing UI Layer
 */
window.PriorityPingUI = {
  render(notifications) {
    let panel = document.getElementById('pp-dashboard');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'pp-dashboard';
      document.body.appendChild(panel);
    }

    const sections = {
      action: notifications.filter(n => n.features.bucket === 'action').sort((a,b) => b.explanation.score - a.explanation.score),
      info: notifications.filter(n => n.features.bucket === 'info').sort((a,b) => b.explanation.score - a.explanation.score)
    };

    panel.innerHTML = `
      <div class="pp-panel-header">
        <div class="pp-logo">PriorityPing <span>CMU</span></div>
        <div class="pp-controls">
          <button id="pp-close">×</button>
        </div>
      </div>
      <div class="pp-scroll-area">
        ${this.renderSection('Priority Tasks', sections.action)}
        ${this.renderSection('FYI & Updates', sections.info)}
      </div>
    `;

    document.getElementById('pp-close').onclick = () => panel.remove();
  },

  renderSection(title, items) {
    if (items.length === 0) return '';
    return `
      <div class="pp-section">
        <h3>${title}</h3>
        ${items.map(item => `
          <div class="pp-card pp-priority-${item.explanation.priority_label.toLowerCase()}">
            <div class="pp-card-main">
              <span class="pp-tag">${item.category}</span>
              <div class="pp-title">${item.title}</div>
              <div class="pp-headline">${item.explanation.headline}</div>
              <div class="pp-meta">Course: ${item.course_id || 'Global'} • ${item.date_posted}</div>
            </div>
            <div class="pp-explanation">
              ${item.explanation.factors.map(f => `
                <div class="pp-factor">
                  <span class="pp-icon ${f.direction}"></span>
                  ${f.label} (${f.impact})
                </div>
              `).join('')}
              ${item.explanation.suppressed_by ? `<div class="pp-suppressed">Note: ${item.explanation.suppressed_by}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
