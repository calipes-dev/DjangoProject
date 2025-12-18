// announcement.js

/**
 * Show Create Announcement Modal
 */
function showCreateAnnouncementModal() {
  const modal = document.getElementById('createAnnouncementModal');
  modal.classList.add('show');
  document.body.classList.add('modal-open');
}

/**
 * Close Create Announcement Modal
 */
function closeCreateAnnouncementModal() {
  const modal = document.getElementById('createAnnouncementModal');
  modal.classList.remove('show');
  document.body.classList.remove('modal-open');
  
  // Reset form
  const form = document.getElementById('createAnnouncementForm');
  if (form) {
    form.reset();
  }
}

/**
 * Show Edit Announcement Modal
 * @param {number} announcementId - The ID of the announcement
 */
function showEditAnnouncementModal(announcementId) {
  const modal = document.getElementById('editAnnouncementModal');
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  
  // Fetch announcement details
  fetch(`/announcements/${announcementId}/details/`)
    .then(response => response.json())
    .then(data => {
      // Populate form fields
      document.getElementById('edit_announcement_id').value = data.announcement_id;
      document.getElementById('edit_title').value = data.title;
      document.getElementById('edit_content').value = data.content;
      document.getElementById('edit_link').value = data.link || '';
      
      // Set class selection
      const classSelect = document.getElementById('edit_class_id');
      if (data.class_id) {
        classSelect.value = data.class_id;
      } else {
        classSelect.value = 'all';
      }
      
      // Display current attachments
      const attachmentsDiv = document.getElementById('currentAttachments');
      let attachmentsHTML = '';
      
      if (data.image) {
        attachmentsHTML += `
          <div class="alert alert-info mb-2">
            <i class="fas fa-image me-2"></i>Current Image: 
            <a href="${data.image}" target="_blank">View</a>
          </div>
        `;
      }
      
      if (data.video) {
        attachmentsHTML += `
          <div class="alert alert-info mb-2">
            <i class="fas fa-video me-2"></i>Current Video: 
            <a href="${data.video}" target="_blank">View</a>
          </div>
        `;
      }
      
      if (data.file) {
        attachmentsHTML += `
          <div class="alert alert-info mb-2">
            <i class="fas fa-file me-2"></i>Current File: 
            <a href="${data.file}" target="_blank">${data.file_name}</a>
          </div>
        `;
      }
      
      attachmentsDiv.innerHTML = attachmentsHTML;
      
      // Set form action
      const form = document.getElementById('editAnnouncementForm');
      form.action = `/announcements/${announcementId}/edit/`;
    })
    .catch(error => {
      console.error('Error loading announcement:', error);
      alert('Failed to load announcement details');
      closeEditAnnouncementModal();
    });
}

/**
 * Close Edit Announcement Modal
 */
function closeEditAnnouncementModal() {
  const modal = document.getElementById('editAnnouncementModal');
  modal.classList.remove('show');
  document.body.classList.remove('modal-open');
  
  // Reset form
  const form = document.getElementById('editAnnouncementForm');
  if (form) {
    form.reset();
  }
}

/**
 * Filter announcements by class
 */
function filterByClass() {
  const classId = document.getElementById('classFilter').value;
  window.location.href = `?class_id=${classId}`;
}

/**
 * Toggle reaction picker visibility
 * @param {number} announcementId - The ID of the announcement
 */
function toggleReactionPicker(announcementId) {
  const picker = document.getElementById(`reactionPicker-${announcementId}`);
  
  // Close all other pickers
  document.querySelectorAll('.reaction-picker').forEach(p => {
    if (p.id !== `reactionPicker-${announcementId}`) {
      p.classList.remove('show');
    }
  });
  
  // Toggle current picker
  picker.classList.toggle('show');
}

/**
 * React to an announcement
 * @param {number} announcementId - The ID of the announcement
 * @param {string} reactionType - Type of reaction (like, love, celebrate, insightful, curious)
 */
function reactToAnnouncement(announcementId, reactionType) {
  // Get CSRF token from cookie
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/${announcementId}/react/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({ reaction_type: reactionType })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Reload page to update reactions
      location.reload();
    } else {
      console.error('Failed to react:', data.error);
      alert('Failed to react to announcement');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while reacting');
  });
}

/**
 * Show/hide comments section
 * @param {number} announcementId - The ID of the announcement
 */
function showComments(announcementId) {
  const commentsSection = document.getElementById(`comments-${announcementId}`);
  
  if (commentsSection.style.display === 'none') {
    commentsSection.style.display = 'block';
    loadComments(announcementId);
  } else {
    commentsSection.style.display = 'none';
  }
}

/**
 * Load comments for an announcement
 * @param {number} announcementId - The ID of the announcement
 */
function loadComments(announcementId) {
  fetch(`/announcements/${announcementId}/details/`)
    .then(response => response.json())
    .then(data => {
      const commentsList = document.getElementById(`commentsList-${announcementId}`);
      
      if (data.comments.length === 0) {
        commentsList.innerHTML = '<p class="text-muted text-center small">No comments yet. Be the first to comment!</p>';
        return;
      }
      
      // Render comments
      commentsList.innerHTML = data.comments.map(comment => `
        <div class="d-flex gap-2 mb-3">
          <img src="${comment.user_image || '/static/img/default-avatar.png'}" 
               alt="User" 
               class="profile-img-sm">
          <div class="flex-grow-1">
            <div class="comment-container">
              <h6 class="comment-user-name mb-1">${comment.user_name}</h6>
              <p class="comment-text mb-0">${escapeHtml(comment.content)}</p>
            </div>
            <div class="d-flex gap-2 mt-1">
              <small class="comment-timestamp">${comment.created_at}</small>
              ${comment.is_owner ? `
                <button class="action-button text-danger" onclick="deleteComment(${comment.comment_id}, ${announcementId})">
                  <i class="fas fa-trash me-1"></i>Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');
    })
    .catch(error => {
      console.error('Error loading comments:', error);
      const commentsList = document.getElementById(`commentsList-${announcementId}`);
      commentsList.innerHTML = '<p class="text-danger text-center small">Failed to load comments</p>';
    });
}

/**
 * Add a comment to an announcement
 * @param {number} announcementId - The ID of the announcement
 */
function addComment(announcementId) {
  const input = document.getElementById(`commentInput-${announcementId}`);
  const content = input.value.trim();
  
  if (!content) {
    alert('Please enter a comment');
    return;
  }
  
  // Get CSRF token
  const csrfToken = getCookie('csrftoken');
  
  // Disable input while submitting
  input.disabled = true;
  
  fetch(`/announcements/${announcementId}/comment/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({ content })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Clear input
      input.value = '';
      
      // Reload comments
      loadComments(announcementId);
      
      // Update comment count
      updateCommentCount(announcementId, data.total_comments);
    } else {
      alert('Failed to add comment: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while adding comment');
  })
  .finally(() => {
    input.disabled = false;
  });
}

/**
 * Delete a comment
 * @param {number} commentId - The ID of the comment
 * @param {number} announcementId - The ID of the announcement
 */
function deleteComment(commentId, announcementId) {
  if (!confirm('Are you sure you want to delete this comment?')) {
    return;
  }
  
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/comment/${commentId}/delete/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Reload comments
      loadComments(announcementId);
      
      // Update comment count
      updateCommentCount(announcementId, data.total_comments);
    } else {
      alert('Failed to delete comment: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while deleting comment');
  });
}

/**
 * Toggle pin status for an announcement (student-side)
 * @param {number} announcementId - The ID of the announcement
 */
function togglePin(announcementId) {
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/${announcementId}/pin/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Reload page to update pin status
      location.reload();
    } else {
      alert('Failed to pin announcement: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while pinning announcement');
  });
}

/**
 * Delete an announcement (teacher only)
 * @param {number} announcementId - The ID of the announcement
 */
function deleteAnnouncement(announcementId) {
  if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
    return;
  }
  
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/${announcementId}/delete/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Remove announcement card from DOM
      const announcementCard = document.getElementById(`announcement-${announcementId}`);
      if (announcementCard) {
        announcementCard.style.transition = 'opacity 0.3s ease';
        announcementCard.style.opacity = '0';
        setTimeout(() => {
          announcementCard.remove();
          
          // Check if there are no more announcements
          const feed = document.getElementById('announcementsFeed');
          if (feed && feed.children.length === 0) {
            location.reload();
          }
        }, 300);
      }
    } else {
      alert('Failed to delete announcement: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while deleting announcement');
  });
}

/**
 * Show report announcement modal
 * @param {number} announcementId - The ID of the announcement
 */
function reportAnnouncement(announcementId) {
  const modal = document.getElementById('reportAnnouncementModal');
  if (!modal) {
    console.error('Report modal not found');
    return;
  }
  
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  
  // Set announcement ID in hidden field
  document.getElementById('report_announcement_id').value = announcementId;
  
  // Clear previous reason
  document.getElementById('report_reason').value = '';
}

/**
 * Close report modal
 */
function closeReportModal() {
  const modal = document.getElementById('reportAnnouncementModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    
    // Reset form
    const form = document.getElementById('reportAnnouncementForm');
    if (form) {
      form.reset();
    }
  }
}

/**
 * Submit report
 * @param {Event} event - Form submit event
 */
function submitReport(event) {
  event.preventDefault();
  
  const announcementId = document.getElementById('report_announcement_id').value;
  const reason = document.getElementById('report_reason').value.trim();
  
  if (!reason) {
    alert('Please provide a reason for reporting');
    return;
  }
  
  const csrfToken = getCookie('csrftoken');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  // Disable button while submitting
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
  
  fetch(`/announcements/${announcementId}/report/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({ reason })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      closeReportModal();
      showSuccessMessage('Report submitted successfully. We will review it shortly.');
    } else {
      alert('Failed to submit report: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while submitting report');
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-flag me-2"></i>Submit Report';
  });
}

/**
 * Show success message
 * @param {string} message - Message to display
 */
function showSuccessMessage(message) {
  // Create temporary success alert
  const alert = document.createElement('div');
  alert.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
  alert.style.zIndex = '9999';
  alert.innerHTML = `
    <i class="fas fa-check-circle me-2"></i>${message}
  `;
  
  document.body.appendChild(alert);
  
  setTimeout(() => {
    alert.style.transition = 'opacity 0.3s ease';
    alert.style.opacity = '0';
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}

/**
 * Toggle teacher pin (pin to top of feed)
 * @param {number} announcementId - The ID of the announcement
 */
function toggleTeacherPin(announcementId) {
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/${announcementId}/teacher-pin/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      location.reload();
    } else {
      alert('Failed to pin announcement: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while pinning announcement');
  });
}

/**
 * Update comment count display
 * @param {number} announcementId - The ID of the announcement
 * @param {number} count - New comment count
 */
function updateCommentCount(announcementId, count) {
  const commentBtn = document.querySelector(`#announcement-${announcementId} .reaction-btn:nth-child(2) span`);
  if (commentBtn) {
    commentBtn.textContent = count;
  }
}

/**
 * Get CSRF token from cookie
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value
 */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Close reaction pickers when clicking outside
 */
document.addEventListener('click', function(e) {
  if (!e.target.closest('.position-relative')) {
    document.querySelectorAll('.reaction-picker').forEach(p => {
      p.classList.remove('show');
    });
  }
});

/**
 * Close modal when clicking on backdrop
 */
document.addEventListener('click', function(e) {
  const createModal = document.getElementById('createAnnouncementModal');
  const editModal = document.getElementById('editAnnouncementModal');
  const reportModal = document.getElementById('reportAnnouncementModal');
  
  if (e.target === createModal) {
    closeCreateAnnouncementModal();
  }
  
  if (e.target === editModal) {
    closeEditAnnouncementModal();
  }
  
  if (e.target === reportModal) {
    closeReportModal();
  }
});

/**
 * Close modal on Escape key
 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeCreateAnnouncementModal();
    closeEditAnnouncementModal();
    closeReportModal();
  }
});

/**
 * Handle Enter key in comment inputs
 */
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners to comment inputs
  document.querySelectorAll('[id^="commentInput-"]').forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const announcementId = this.id.split('-')[1];
        addComment(parseInt(announcementId));
      }
    });
  });
  
  // Handle file upload preview in create announcement modal
  const createForm = document.getElementById('createAnnouncementForm');
  if (createForm) {
    const fileInputs = createForm.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', function() {
        const label = this.closest('label');
        if (this.files.length > 0) {
          const fileName = this.files[0].name;
          label.classList.add('btn-success');
          label.classList.remove('btn-outline-secondary');
          
          // Add checkmark icon
          const icon = label.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-check me-2';
          }
        } else {
          label.classList.remove('btn-success');
          label.classList.add('btn-outline-secondary');
        }
      });
    });
  }
  
  // Handle file upload preview in edit announcement modal
  const editForm = document.getElementById('editAnnouncementForm');
  if (editForm) {
    const fileInputs = editForm.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', function() {
        const label = this.closest('label');
        if (this.files.length > 0) {
          const fileName = this.files[0].name;
          label.classList.add('btn-success');
          label.classList.remove('btn-outline-secondary');
          
          // Add checkmark icon
          const icon = label.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-check me-2';
          }
        } else {
          label.classList.remove('btn-success');
          label.classList.add('btn-outline-secondary');
        }
      });
    });
  }
});

/**
 * Initialize announcement board
 */
function initAnnouncementBoard() {
  console.log('Announcement board initialized');
  
  // Load any pinned announcements on top
  // This can be extended for additional initialization logic
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnnouncementBoard);
} else {
  initAnnouncementBoard();
}