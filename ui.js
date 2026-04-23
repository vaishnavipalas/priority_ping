/**
 * UI Manager for PriorityPing
 */
(function() {
  const UI = {
    panel: null,
    isCollapsed: false,
    dragData: { x: 0, y: 0, active: false },
    lastData: [],
    
    featureLabels: {
      has_deadline: "Has a deadline",
      days_until_deadline: "Days until deadline",
      is_graded: "Is a graded item",
      requires_submission: "Requires submission",
      teacher_posted: "Posted by instructor",
      estimated_time_hours: "Estimated time",
      title_has_urgent_kw: "Contains urgent keywords",
      has_time_reference: "Mentions a specific time",
      course_credits: "Course credit weight",
      notification_type_quiz_exam: "Is a quiz or exam",
      notification_type_grade_posted: "Is a grade notification",
      notification_type_announcement_urgent: "Is an urgent announcement",
      notification_type_announcement_info: "Is an informational announcement",
      notification_type_discussion: "Is a discussion",
      notification_type_group_collab: "Is a group activity",
      notification_type_event_optional: "Is an optional event"
    },

    async init() {
      const storage = await chrome.storage.local.get(['ppCollapsed', 'ppPanelPosition', 'ppTimeWindow']);
      this.isCollapsed = !!storage.ppCollapsed;
      this.createPanel();
      
      if (storage.ppPanelPosition) {
        this.panel.style.top = storage.ppPanelPosition.top;
        this.panel.style.right = storage.ppPanelPosition.right;
      }
      
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      window.addEventListener('mouseup', this.onMouseUp.bind(this));
    },

    createPanel() {
      if (this.panel) return;
      
      this.panel = document.createElement('div');
      this.panel.id = 'priority-ping-panel';
      this.panel.className = this.isCollapsed ? 'pp-icon' : '';
      
      this.renderStatic();
      document.body.appendChild(this.panel);
    },

    renderStatic() {
      this.panel.innerHTML = `
        <div class="pp-header">
          <div class="pp-logo" title="Restore PriorityPing">PP</div>
          <div class="pp-header-content">
            <h1 class="pp-title">PriorityPing</h1>
            <p class="pp-subtitle">Prioritized Canvas notifications</p>
          </div>
          <button class="pp-hide-btn">Hide</button>
        </div>
        <div class="pp-content">
          <div class="pp-filters">
            <button data-window="today" class="pp-pill">Today</button>
            <button data-window="3days" class="pp-pill">3 Days</button>
            <button data-window="7days" class="pp-pill">7 Days</button>
            <button data-window="all" class="pp-pill">All</button>
          </div>
          <div class="pp-scope-note"></div>
          <div class="pp-grid">
            <div class="pp-col-left">
              <h2 class="pp-col-title">Needs Action</h2>
              <div class="pp-list-action"></div>
            </div>
            <div class="pp-col-right">
              <h2 class="pp-col-title">FYI</h2>
              <div class="pp-list-fyi"></div>
            </div>
          </div>
          <div class="pp-low-priority-section">
            <button class="pp-toggle-low">Show 0 low-priority items</button>
            <div class="pp-list-low hidden"></div>
          </div>
          <div class="pp-footer">
            <span class="pp-course-settings-link">Course settings → open extension popup</span>
          </div>
        </div>
      `;

      this.panel.querySelector('.pp-header').addEventListener('mousedown', this.onMouseDown.bind(this));
      this.panel.querySelector('.pp-hide-btn').addEventListener('click', () => this.toggleCollapse(true));
      this.panel.querySelector('.pp-logo').addEventListener('click', (e) => {
        if (this.isCollapsed) {
          e.stopPropagation();
          this.toggleCollapse(false);
        }
      });

      this.panel.querySelectorAll('.pp-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const win = btn.dataset.window;
          const map = { today: 24*3600*1000, '3days': 3*24*3600*1000, '7days': 7*24*3600*1000, all: Infinity };
          window.ppSetWindow?.(map[win]);
          this.updatePills(win);
        });
      });

      this.panel.querySelector('.pp-toggle-low').addEventListener('click', (e) => {
          const list = this.panel.querySelector('.pp-list-low');
          list.classList.toggle('hidden');
          const isHidden = list.classList.contains('hidden');
          e.target.textContent = isHidden ? e.target.textContent.replace('Hide', 'Show') : e.target.textContent.replace('Show', 'Hide');
      });
      
      this.restorePills();
    },

    async restorePills() {
        const storage = await chrome.storage.local.get('ppTimeWindow');
        const win = storage.ppTimeWindow || '7days';
        this.updatePills(win);
    },

    updatePills(win) {
        this.panel.querySelectorAll('.pp-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.window === win);
        });
        chrome.storage.local.set({ ppTimeWindow: win });
    },

    onMouseDown(e) {
      if (e.target.closest('button')) return;
      this.dragData.active = true;
      this.dragData.x = e.clientX - this.panel.getBoundingClientRect().right;
      this.dragData.y = e.clientY - this.panel.getBoundingClientRect().top;
      this.panel.classList.add('pp-dragging');
    },

    onMouseMove(e) {
      if (!this.dragData.active) return;
      
      const right = window.innerWidth - e.clientX + this.dragData.x;
      const top = e.clientY - this.dragData.y;
      
      this.panel.style.right = `${right}px`;
      this.panel.style.top = `${top}px`;
    },

    onMouseUp() {
      if (!this.dragData.active) return;
      this.dragData.active = false;
      this.panel.classList.remove('pp-dragging');
      chrome.storage.local.set({
        ppPanelPosition: {
          right: this.panel.style.right,
          top: this.panel.style.top
        }
      });
    },

    toggleCollapse(collapsed) {
      this.isCollapsed = collapsed;
      this.panel.classList.toggle('pp-icon', collapsed);
      chrome.storage.local.set({ ppCollapsed: collapsed });
    },

    async render(notifications, { recentActivityActive }) {
      this.lastData = notifications;
      if (!this.panel) this.createPanel();

      const note = this.panel.querySelector('.pp-scope-note');
      if (recentActivityActive) {
        note.className = 'pp-scope-note pp-note-blue';
        note.innerHTML = 'Showing notifications from Recent Activity.';
      } else {
        note.className = 'pp-scope-note pp-note-amber';
        note.innerHTML = 'Open Recent Activity to let PriorityPing parse notifications.';
      }

      const storage = await chrome.storage.local.get('ppCourseImportance');
      const importance = storage.ppCourseImportance || {};

      const listAction = this.panel.querySelector('.pp-list-action');
      const listFyi = this.panel.querySelector('.pp-list-fyi');
      const listLow = this.panel.querySelector('.pp-list-low');
      const lowBtn = this.panel.querySelector('.pp-toggle-low');

      listAction.innerHTML = '';
      listFyi.innerHTML = '';
      listLow.innerHTML = '';

      const processed = notifications.map(item => {
          let priority = item.prediction.priority;
          const course = item.course_name;
          
          // Apply overrides
          if (course === '67272' || course === '15150') {
              priority = Math.min(priority + 1, 3);
          }
          
          const manual = importance[course];
          if (manual === '2') { // High
              priority = Math.min(priority + 1, 3);
          } else if (manual === '0') { // Mute
              priority = 0;
          }

          return { ...item, displayPriority: priority };
      });

      const lowItems = processed.filter(p => p.displayPriority === 0);
      processed.forEach(item => {
          if (item.displayPriority === 0) {
              this.appendCard(listLow, item);
          } else {
              const needsAction = ['assignment_due', 'quiz_exam', 'group_collab', 'discussion'].includes(item.notification_type);
              if (needsAction) this.appendCard(listAction, item);
              else this.appendCard(listFyi, item);
          }
      });

      lowBtn.textContent = `Show ${lowItems.length} low-priority items`;
      lowBtn.style.display = lowItems.length > 0 ? 'block' : 'none';
    },

    appendCard(container, item) {
      const card = document.createElement('div');
      card.className = `pp-card priority-${item.displayPriority}`;
      
      const labels = ['Low', 'Moderate', 'High', 'Critical'];
      const tier = labels[item.displayPriority];
      const isAction = ['assignment_due', 'quiz_exam', 'group_collab', 'discussion'].includes(item.notification_type);
      
      const confStr = Math.round(item.prediction.confidence * 100);
      const uncertain = item.prediction.confidence < 0.6 || item.prediction.uncertain;

      card.innerHTML = `
        <div class="pp-card-header">
          <span class="pp-badge pp-badge-${tier.toLowerCase()}">${tier}</span>
          <span class="pp-confidence" title="Model confidence: how certain the classifier is in this ranking. Below 60% is a close call.">
            ${uncertain ? '~' : ''}${confStr}% confidence
          </span>
        </div>
        <h3 class="pp-card-title">${item.title}</h3>
        <div class="pp-card-meta">
          <span class="pp-course-code">${item.course_name}</span>
          ${item.days_until_deadline >= 0 ? `<span class="pp-deadline">${this.formatDeadline(item.days_until_deadline)}</span>` : ''}
        </div>
        <div class="pp-tags">
          <span class="pp-tag ${isAction ? 'pp-tag-action' : 'pp-tag-fyi'}">${isAction ? 'Needs action' : 'FYI'}</span>
        </div>
        <button class="pp-why-btn">Why?</button>
        <div class="pp-explanation hidden"></div>
      `;

      card.querySelector('.pp-why-btn').addEventListener('click', (e) => {
          const expBox = card.querySelector('.pp-explanation');
          expBox.classList.toggle('hidden');
          if (!expBox.classList.contains('hidden')) {
              const explanations = window.CanvasClassifierInstance.explain(item);
              expBox.innerHTML = explanations.map(exp => {
                  const label = this.featureLabels[exp.feature] || exp.feature;
                  return `<div class="pp-exp-row">
                    <span class="pp-exp-label">${label}</span>
                    <span class="pp-exp-dir dir-${exp.direction}">${exp.direction} priority</span>
                  </div>`;
              }).join('');
          }
      });

      container.appendChild(card);
    },

    formatDeadline(days) {
        if (days === 0) return "Due today";
        if (days === 1) return "Due tomorrow";
        return `Due in ${days} days`;
    }
  };

  window.PriorityPingUI = UI;
  UI.init();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PP_RERENDER') {
      UI.render(UI.lastData, { recentActivityActive: true });
    }
  });
})();
