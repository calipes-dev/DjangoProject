// StudentDashboard.js - Complete JavaScript

// ============================================
// TOTAL EXP AND RANK
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // Fetch Total EXP
  fetch('/api/student/total-exp/')
    .then(response => response.json())
    .then(data => {
      const totalExp = data.total_exp || 0;
      document.getElementById('totalExp').textContent = totalExp.toLocaleString() + ' EXP';
    })
    .catch(error => {
      console.error('Error fetching total EXP:', error);
      document.getElementById('totalExp').textContent = '0 EXP';
    });
  
  // Fetch User Rank
  fetch('/api/leaderboard-data/')
    .then(response => response.json())
    .then(data => {
      const userRank = data.user_rank || 'N/A';
      document.getElementById('studentRank').textContent = userRank !== 'N/A' ? `#${userRank}` : '#N/A';
    })
    .catch(error => {
      console.error('Error fetching rank:', error);
      document.getElementById('studentRank').textContent = '#N/A';
    });
});

// ============================================
// PROGRESS MODAL FUNCTIONS
// ============================================
function showProgressModal() {
  const modal = document.getElementById('progressModal');
  modal.style.display = 'block';
  
  // Add class to body to prevent scrolling and stretching
  document.body.classList.add('modal-open');
  
  // Trigger animation after display
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  loadProgressData();
}

function closeProgressModal() {
  const modal = document.getElementById('progressModal');
  modal.classList.remove('show');
  
  // Wait for animation to complete before hiding
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }, 300);
}

function loadProgressData() {
  const classId = document.getElementById('progressClassFilter').value;
  const content = document.getElementById('progressContent');
  
  content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Loading...</p></div>';
  
  fetch(`/api/student/progress/?class_id=${classId}`)
    .then(response => response.json())
    .then(data => {
      renderProgressData(data);
    })
    .catch(error => {
      content.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-exclamation-circle text-danger" style="font-size: 3rem;"></i>
          <p class="mt-3">Error loading progress data. Please try again.</p>
        </div>
      `;
    });
}

function renderProgressData(data) {
  const content = document.getElementById('progressContent');
  const percentage = Math.round((data.completed / data.total) * 100) || 0;
  const scorePercentage = Math.round((data.total_score / data.max_score) * 100) || 0;
  
  content.innerHTML = `
    <!-- Overall Stats - Equal Width Cards -->
    <div class="row g-4 mb-4">
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 p-4 text-center" style="background-color: #374151; border: none;">
          <div class="circular-progress mx-auto mb-3" style="position: relative; width: 120px; height: 120px;">
            <svg width="120" height="120" style="transform: rotate(-90deg);">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#4b5563" stroke-width="8"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#3b82f6" stroke-width="8"
                      stroke-dasharray="${2 * Math.PI * 50}"
                      stroke-dashoffset="${2 * Math.PI * 50 * (1 - percentage / 100)}"
                      stroke-linecap="round"
                      style="transition: stroke-dashoffset 1s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
              <div style="font-size: 1.5rem; font-weight: bold; color: #f9fafb;">${percentage}%</div>
              <div style="font-size: 0.75rem; color: #9ca3af;">Complete</div>
            </div>
          </div>
          <p class="mb-0" style="color: #9ca3af; font-weight: 500;">Overall Completion</p>
          <p class="small mb-0" style="color: #9ca3af;">${data.completed} of ${data.total} challenges</p>
        </div>
      </div>

      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 p-4" style="background-color: #374151; border: none;">
          <div class="d-flex align-items-center gap-3 mb-3">
            <i class="fas fa-check-circle" style="font-size: 2rem; color: #10b981;"></i>
            <div>
              <h3 class="mb-0" style="color: #f9fafb;">${data.completed}</h3>
              <p class="small mb-0" style="color: #9ca3af;">Completed</p>
            </div>
          </div>
          <div class="mt-auto">
            <div class="d-flex justify-content-between small mb-2">
              <span style="color: #9ca3af;">Total Score</span>
              <span style="color: #f9fafb; font-weight: 600;">${data.total_score}</span>
            </div>
            <div class="progress" style="height: 8px; background-color: #4b5563;">
              <div class="progress-bar bg-success progress-bar-animated" 
                  style="width: ${scorePercentage}%; background-color: #10b981;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 p-4" style="background-color: #374151; border: none;">
          <div class="d-flex align-items-center gap-3 mb-3">
            <i class="fas fa-hourglass-half" style="font-size: 2rem; color: #f59e0b;"></i>
            <div>
              <h3 class="mb-0" style="color: #f9fafb;">${data.total - data.completed}</h3>
              <p class="small mb-0" style="color: #9ca3af;">Remaining</p>
            </div>
          </div>
          <div class="mt-auto">
            <div class="d-flex justify-content-between small mb-2">
              <span style="color: #9ca3af;">Possible Score</span>
              <span style="color: #f9fafb; font-weight: 600;">${data.max_score - data.total_score}</span>
            </div>
            <div class="progress" style="height: 8px; background-color: #4b5563;">
              <div class="progress-bar bg-warning progress-bar-animated" 
                  style="width: ${100 - scorePercentage}%; background-color: #f59e0b;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress by Class -->
    ${data.by_class && data.by_class.length > 0 ? `
    <div class="card p-4 mb-4" style="background-color: #374151; border: none;">
      <h5 class="mb-4" style="color: #f9fafb;"><i class="fas fa-book-open me-2" style="color: #3b82f6;"></i>Progress by Class</h5>
      <div class="row g-3">
        ${data.by_class.map((cls, idx) => {
          const classPercentage = Math.round((cls.completed / cls.total) * 100);
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
          const color = colors[idx % colors.length];
          return `
            <div class="col-12">
              <div class="card p-3" style="background-color: #1f2937; border: none;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-semibold" style="color: #f3f4f6;">${cls.class_name}</span>
                  <span class="small" style="color: #9ca3af;">${cls.completed}/${cls.total} completed</span>
                </div>
                <div class="progress mb-2" style="height: 12px; background-color: #4b5563;">
                  <div class="progress-bar progress-bar-animated" 
                      style="width: ${classPercentage}%; background-color: ${color};"></div>
                </div>
                <div class="d-flex justify-content-between small">
                  <span style="color: #9ca3af;">Score: ${cls.score}/${cls.max_score}</span>
                  <span style="color: #9ca3af;">${classPercentage}%</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Weekly Progress Chart -->
    ${data.weekly_progress && data.weekly_progress.length > 0 ? `
    <div class="card p-4" style="background-color: #374151; border: none;">
      <h5 class="mb-3" style="color: #f9fafb;"><i class="fas fa-chart-line me-2" style="color: #10b981;"></i>Weekly Progress</h5>
      <div style="width: 100%; height: 300px; position: relative;">
        <canvas id="weeklyProgressChart"></canvas>
      </div>
    </div>
    ` : `
    <div class="card p-4" style="background-color: #374151; border: none;">
      <h5 class="mb-3" style="color: #f9fafb;"><i class="fas fa-chart-line me-2" style="color: #10b981;"></i>Weekly Progress</h5>
      <div class="text-center py-4">
        <i class="fas fa-chart-bar" style="font-size: 3rem; color: #6b7280; opacity: 0.3;"></i>
        <p class="mt-3" style="color: #9ca3af;">No weekly data available yet</p>
      </div>
    </div>
    `}
  `;

  // Render chart if data exists
  if (data.weekly_progress && data.weekly_progress.length > 0) {
    setTimeout(() => renderWeeklyChart(data.weekly_progress), 100);
  }
}

// ============================================
// TASKS MODAL FUNCTIONS
// ============================================
function showTasksModal() {
  const modal = document.getElementById('tasksModal');
  modal.style.display = 'block';
  
  // Add class to body to prevent scrolling and stretching
  document.body.classList.add('modal-open');
  
  // Trigger animation after display
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  loadPendingTasks();
}

function closeTasksModal() {
  const modal = document.getElementById('tasksModal');
  modal.classList.remove('show');
  
  // Wait for animation to complete before hiding
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }, 300);
}

function loadPendingTasks() {
  const classId = document.getElementById('tasksClassFilter').value;
  const content = document.getElementById('tasksContent');
  
  content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div><p class="mt-2">Loading...</p></div>';
  
  fetch(`/api/student/pending-tasks/?class_id=${classId}`)
    .then(response => response.json())
    .then(data => {
      renderPendingTasks(data);
    })
    .catch(error => {
      content.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-exclamation-circle text-danger" style="font-size: 3rem;"></i>
          <p class="mt-3">Error loading pending tasks. Please try again.</p>
        </div>
      `;
    });
}

function renderPendingTasks(data) {
  const content = document.getElementById('tasksContent');
  const countEl = document.getElementById('tasksCount');
  
  countEl.textContent = `${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} remaining`;
  
  if (data.tasks.length === 0) {
    content.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
        <h4 class="mt-3 mb-2">All caught up!</h4>
        <p class="text-muted">No pending tasks for the selected filter.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = data.tasks.map(task => {
    const timeInfo = getTimeRemaining(task.due_date);
    const borderColor = task.class_type === 'cybersecurity' ? '#ef4444' : '#3b82f6';
    const typeColor = task.type === 'CTF' ? 'danger' : task.type === 'Quiz' ? 'success' : 'warning';
    
    return `
      <div class="card task-card p-4 mb-3" 
          style="background-color: #374151; border-left: 4px solid ${borderColor}; border-radius: 0.75rem;"
          onclick="window.location.href='/student/class/${task.class_id}/'">
        <div class="row align-items-center g-3">
          <div class="col-12 col-md-8">
            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <h5 class="mb-0">${task.title}</h5>
              <span class="badge bg-${typeColor} small">${task.type}</span>
            </div>
            <div class="d-flex flex-wrap gap-3 small text-muted">
              <span><i class="fas fa-book-open me-1"></i>${task.class_name}</span>
              <span class="${timeInfo.color}">
                <i class="fas fa-clock me-1"></i>${timeInfo.text}
              </span>
            </div>
          </div>
          <div class="col-12 col-md-4 text-md-end">
            <div class="d-flex align-items-center justify-content-md-end gap-3">
              <div class="text-center">
                <div class="h4 mb-0 text-warning">${task.score}</div>
                <div class="small text-muted">points</div>
              </div>
              <button class="btn btn-${timeInfo.urgent ? 'danger' : 'primary'} btn-sm" 
                      onclick="event.stopPropagation(); window.location.href='/student/class/${task.class_id}/'">
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getTimeRemaining(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  
  if (diff < 0) {
    return { text: 'Overdue', color: 'text-danger', urgent: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days === 0 && hours < 24) {
    return { text: `${hours}h remaining`, color: 'text-danger', urgent: true };
  }
  if (days <= 2) {
    return { text: `${days}d ${hours}h remaining`, color: 'text-warning', urgent: false };
  }
  return { text: `${days} days remaining`, color: 'text-success', urgent: false };
}

// ============================================
// WEEKLY PROGRESS CHART RENDERING
// ============================================
let weeklyChartInstance = null;

function renderWeeklyChart(weeklyData) {
  const canvas = document.getElementById('weeklyProgressChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Destroy previous chart if exists
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  // Prepare data
  const labels = weeklyData.map(item => item.week);
  const completedData = weeklyData.map(item => item.completed);

  weeklyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completed Challenges',
        data: completedData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#9ca3af',
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#fff',
          bodyColor: '#9ca3af',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(75, 85, 99, 0.3)',
            drawBorder: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(75, 85, 99, 0.3)',
            drawBorder: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 11
            },
            stepSize: 1
          }
        }
      }
    }
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Close modals on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeProgressModal();
    closeTasksModal();
  }
});

// Close modals on backdrop click
document.addEventListener('click', function(e) {
  const progressModal = document.getElementById('progressModal');
  const tasksModal = document.getElementById('tasksModal');
  
  if (e.target === progressModal) {
    closeProgressModal();
  }
  if (e.target === tasksModal) {
    closeTasksModal();
  }
});