// announcement.js - COMPLETE VERSION WITH MULTIPLE FILES AND LINKS

// ========================================
// GLOBAL STATE FOR LINKS AND FILES
// ========================================
let announcementLinks = [];
let editAnnouncementLinks = [];

// ========================================
// LINKS MANAGEMENT FUNCTIONS
// ========================================

/**
 * Add a link to the announcement
 * @param {string} formType - 'create' or 'edit'
 */
function addLink(formType = 'create') {
  const urlInput = document.getElementById(formType === 'create' ? 'linkUrl' : 'editLinkUrl');
  const titleInput = document.getElementById(formType === 'create' ? 'linkTitle' : 'editLinkTitle');
  
  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    alert('Please enter a valid URL (e.g., https://example.com)');
    return;
  }
  
  const linksList = formType === 'create' ? announcementLinks : editAnnouncementLinks;
  linksList.push({ 
    url, 
    title: title || url,
    id: Date.now() // Add unique ID for easier removal
  });
  
  // Clear inputs
  urlInput.value = '';
  titleInput.value = '';
  
  // Re-render
  renderLinksList(formType === 'create' ? 'linksList' : 'editLinksList', linksList, formType);
}

/**
 * Remove a link from the list
 * @param {number} linkId - The unique ID of the link
 * @param {string} formType - 'create' or 'edit'
 */
function removeLink(linkId, formType = 'create') {
  const linksList = formType === 'create' ? announcementLinks : editAnnouncementLinks;
  const index = linksList.findIndex(link => link.id === linkId);
  
  if (index > -1) {
    linksList.splice(index, 1);
    renderLinksList(formType === 'create' ? 'linksList' : 'editLinksList', linksList, formType);
  }
}

/**
 * Render the links list
 * @param {string} containerId - ID of the container element
 * @param {array} linksList - Array of link objects
 * @param {string} formType - 'create' or 'edit'
 */
function renderLinksList(containerId, linksList, formType = 'create') {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.warn(`Container ${containerId} not found`);
    return;
  }
  
  if (linksList.length === 0) {
    container.innerHTML = '<p class="text-muted small mb-0">No links added yet</p>';
    return;
  }
  
  container.innerHTML = linksList.map((link) => `
    <div class="link-item">
      <i class="fas fa-link link-icon"></i>
      <div class="link-content">
        <span>${escapeHtml(link.title)}</span>
        <span class="link-url"> - ${escapeHtml(link.url)}</span>
      </div>
      <button type="button" class="btn btn-sm btn-danger delete-btn" 
              onclick="removeLink(${link.id}, '${formType}')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

// ========================================
// MULTIPLE FILES MANAGEMENT FUNCTIONS
// ========================================

/**
 * Handle multiple file selection display
 * @param {HTMLInputElement} input - The file input element
 * @param {string} containerId - ID of the container to display files
 */
function handleMultipleFiles(input, containerId = 'selectedFilesList') {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.warn(`Container ${containerId} not found`);
    return;
  }
  
  const files = Array.from(input.files);
  
  if (files.length === 0) {
    container.innerHTML = '';
    const label = input.closest('label');
    if (label) label.classList.remove('has-files');
    return;
  }
  
  // Add visual feedback to button
  const label = input.closest('label');
  if (label) label.classList.add('has-files');
  
  container.innerHTML = files.map((file, index) => {
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    const fileIcon = getFileIcon(file.type);
    
    return `
      <div class="file-item d-flex align-items-center justify-content-between p-2 mb-2"
           style="background-color: #374151; border-radius: 8px;">
        <div class="flex-grow-1">
          <i class="fas ${fileIcon} me-2" style="color: #10b981;"></i>
          <span class="text-white">${escapeHtml(file.name)}</span>
          <small class="text-muted ms-2">(${fileSize} MB)</small>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger"
                onclick="removeFileFromInput(${index}, '${containerId}', this)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');
}

/**
 * Get appropriate Font Awesome icon for file type
 * @param {string} mimeType - The MIME type of the file
 * @returns {string} Font Awesome icon class
 */
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType.startsWith('video/')) return 'fa-video';
  if (mimeType.startsWith('audio/')) return 'fa-music';
  if (mimeType.includes('pdf')) return 'fa-file-pdf';
  if (mimeType.includes('word')) return 'fa-file-word';
  if (mimeType.includes('sheet')) return 'fa-file-excel';
  return 'fa-file';
}

/**
 * Remove a file from the file input
 * @param {number} index - Index of file to remove
 * @param {string} containerId - ID of the container
 * @param {HTMLElement} button - The button element that was clicked
 */
function removeFileFromInput(index, containerId, button) {
  const container = document.getElementById(containerId);
  const fileInput = container.closest('form')?.querySelector(`input[type="file"]`);
  
  if (fileInput && fileInput.files) {
    const dataTransfer = new DataTransfer();
    const files = Array.from(fileInput.files);
    files.splice(index, 1);
    
    files.forEach(file => {
      dataTransfer.items.add(file);
    });
    
    fileInput.files = dataTransfer.files;
    handleMultipleFiles(fileInput, containerId);
  }
}

/**
 * Show Create Announcement Modal
 */
function showCreateAnnouncementModal() {
  const modal = document.getElementById('createAnnouncementModal');
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  
  // Reset links array
  announcementLinks = [];
  renderLinksList('linksList', announcementLinks, 'create');
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
    announcementLinks = [];
    renderLinksList('linksList', announcementLinks, 'create');
    
    // Clear file lists
    const fileContainers = document.querySelectorAll('[id$="FilesList"]');
    fileContainers.forEach(container => {
      container.innerHTML = '';
    });
    
    // Reset file upload buttons
    document.querySelectorAll('.file-upload-btn').forEach(btn => {
      btn.classList.remove('btn-success');
      btn.classList.add('btn-outline-secondary');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = icon.className.replace('fa-check-circle', 'fa-image');
      }
    });
    
    // Reset multi-file upload buttons
    document.querySelectorAll('.multi-file-upload-btn').forEach(btn => {
      btn.classList.remove('has-files');
    });
    
    // Hide progress bar
    const progressContainer = document.getElementById('uploadProgress');
    if (progressContainer) {
      progressContainer.classList.remove('show');
      progressContainer.querySelector('.progress-fill').style.width = '0%';
      progressContainer.querySelector('.progress-percentage').textContent = '0%';
    }
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
      
      // Display multiple files if available
      if (data.files && data.files.length > 0) {
        attachmentsHTML += '<div class="mb-2"><strong class="text-white">Current Files:</strong></div>';
        data.files.forEach(file => {
          attachmentsHTML += `
            <div class="alert alert-info mb-2 d-flex justify-content-between align-items-center">
              <div>
                <i class="fas fa-file me-2"></i>
                <a href="${file.file_url}" target="_blank">${file.file_name}</a>
                <small class="ms-2">(${file.file_size})</small>
              </div>
              <button type="button" class="btn btn-sm btn-danger" 
                      onclick="deleteAnnouncementFile(${file.file_id})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;
        });
      }
      
      attachmentsDiv.innerHTML = attachmentsHTML;
      
      // Load existing links
      editAnnouncementLinks = data.links || [];
      renderLinksList('editLinksList', editAnnouncementLinks, 'edit');
      
      // Set form action
      const form = document.getElementById('editAnnouncementForm');
      form.action = `/announcements/${announcementId}/edit/`;
    })
    .catch(error => {
      console.error('Error loading announcement:', error);
      alert('Failed to load announcement details: ' + error.message);
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
    editAnnouncementLinks = [];
    renderLinksList('editLinksList', editAnnouncementLinks, 'edit');
    
    // Clear file lists
    const editFileContainers = document.querySelectorAll('#editAnnouncementModal [id$="FilesList"]');
    editFileContainers.forEach(container => {
      container.innerHTML = '';
    });
  }
}

/**
 * Delete a file attachment from announcement
 * @param {number} fileId - The ID of the file to delete
 */
function deleteAnnouncementFile(fileId) {
  if (!confirm('Are you sure you want to delete this file?')) {
    return;
  }
  
  const csrfToken = getCookie('csrftoken');
  
  fetch(`/announcements/file/${fileId}/delete/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Reload the modal
      const announcementId = document.getElementById('edit_announcement_id').value;
      closeEditAnnouncementModal();
      setTimeout(() => showEditAnnouncementModal(announcementId), 100);
    } else {
      alert('Failed to delete file: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while deleting file');
  });
}

/**
 * Filter announcements by class
 */
function filterByClass() {
  const classId = document.getElementById('classFilter').value;
  window.location.href = `?class_id=${classId}`;
}

/**
 * Submit announcement form with links JSON
 * @param {Event} event - The form submit event
 * @param {string} formType - 'create' or 'edit'
 * @returns {boolean} - Whether to allow form submission
 */
function submitAnnouncementForm(event, formType = 'create') {
  const form = event.target;
  const linksList = formType === 'create' ? announcementLinks : editAnnouncementLinks;
  
  // Create hidden input for links JSON
  let linksInput = form.querySelector('input[name="links_json"]');
  if (!linksInput) {
    linksInput = document.createElement('input');
    linksInput.type = 'hidden';
    linksInput.name = 'links_json';
    form.appendChild(linksInput);
  }
  
  linksInput.value = JSON.stringify(linksList);
  return true; // Allow form submission
}

// ✅ NEW: Hover reaction picker
let reactionHoverTimeout = null;

function showReactionPickerOnHover(announcementId) {
  clearTimeout(reactionHoverTimeout);
  const picker = document.getElementById(`reactionPicker-${announcementId}`);
  if (picker) {
    picker.classList.add('hover-show');
  }
}

function hideReactionPickerOnHover(announcementId) {
  reactionHoverTimeout = setTimeout(() => {
    const picker = document.getElementById(`reactionPicker-${announcementId}`);
    if (picker && !picker.matches(':hover')) {
      picker.classList.remove('hover-show');
    }
  }, 200);
}

function keepReactionPickerOpen(announcementId) {
  clearTimeout(reactionHoverTimeout);
}

/**
 * Toggle reaction picker visibility (for click)
 * @param {number} announcementId - The ID of the announcement
 */
function toggleReactionPicker(announcementId) {
  const picker = document.getElementById(`reactionPicker-${announcementId}`);
  
  // Close all other pickers
  document.querySelectorAll('.reaction-picker').forEach(p => {
    if (p.id !== `reactionPicker-${announcementId}`) {
      p.classList.remove('show');
      p.classList.remove('hover-show');
    }
  });
  
  // Toggle current picker
  if (picker.classList.contains('show') || picker.classList.contains('hover-show')) {
    picker.classList.remove('show');
    picker.classList.remove('hover-show');
  } else {
    picker.classList.add('show');
  }
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
 * ✅ NEW: Show reaction modal with all users who reacted
 */
function showReactionModal(announcementId) {
  fetch(`/announcements/${announcementId}/details/`)
    .then(response => response.json())
    .then(data => {
      // Create modal if it doesn't exist
      let modal = document.getElementById('reactionModal');
      if (!modal) {
        modal = createReactionModal();
        document.body.appendChild(modal);
      }
      
      // Populate modal with reaction data
      const modalBody = modal.querySelector('.reaction-modal-body');
      modalBody.innerHTML = '';
      
      if (!data.reactions_by_type || Object.keys(data.reactions_by_type).length === 0) {
        modalBody.innerHTML = '<p class="text-muted text-center">No reactions yet</p>';
      } else {
        // Display reactions grouped by type
        const reactionEmojis = {
          'like': '👍',
          'love': '❤️',
          'celebrate': '🎉',
          'insightful': '💡',
          'curious': '🤔'
        };
        
        for (const [type, users] of Object.entries(data.reactions_by_type)) {
          const section = document.createElement('div');
          section.className = 'reaction-type-section';
          
          const header = document.createElement('div');
          header.className = 'reaction-type-header';
          header.innerHTML = `
            <span class="reaction-type-emoji">${reactionEmojis[type] || '👍'}</span>
            <span class="reaction-type-name">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <span class="reaction-type-count">(${users.length})</span>
          `;
          section.appendChild(header);
          
          users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'reaction-user-item';
            
            // ✅ FIXED: Properly handle image URLs with fallback
            const imageUrl = user.user_image ? user.user_image : '/static/img/default-avatar.png';
            
            userItem.innerHTML = `
              <img src="${imageUrl}" 
                   alt="${escapeHtml(user.user_name)}" 
                   class="reaction-user-avatar"
                   onerror="this.src='/static/img/default-avatar.png'">
              <span class="reaction-user-name">${escapeHtml(user.user_name)}</span>
            `;
            section.appendChild(userItem);
          });
          
          modalBody.appendChild(section);
        }
      }
      
      modal.classList.add('show');
    })
    .catch(error => {
      console.error('Error loading reactions:', error);
      alert('Failed to load reactions');
    });
}

/**
 * ✅ NEW: Create reaction modal element
 */
function createReactionModal() {
  const modal = document.createElement('div');
  modal.id = 'reactionModal';
  modal.className = 'reaction-modal-backdrop';
  modal.innerHTML = `
    <div class="reaction-modal-content">
      <div class="reaction-modal-header">
        <h5 class="reaction-modal-title">
          <i class="fas fa-heart me-2" style="color: #10b981;"></i>Reactions
        </h5>
        <button class="btn btn-link text-white p-0" onclick="closeReactionModal()">
          <i class="fas fa-times" style="font-size: 1.5rem;"></i>
        </button>
      </div>
      <div class="reaction-modal-body">
        <!-- Reactions will be loaded here -->
      </div>
    </div>
  `;
  
  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeReactionModal();
    }
  });
  
  return modal;
}

/**
 * ✅ NEW: Close reaction modal
 */
function closeReactionModal() {
  const modal = document.getElementById('reactionModal');
  if (modal) {
    modal.classList.remove('show');
  }
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
 * ✅ NEW: Upload progress tracking for create announcement
 */
function handleAnnouncementSubmit(event) {
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const progressContainer = document.getElementById('uploadProgress');
  
  // Check if there are files to upload
  const fileInputs = form.querySelectorAll('input[type="file"]');
  let hasFiles = false;
  fileInputs.forEach(input => {
    if (input.files.length > 0) {
      hasFiles = true;
    }
  });
  
  if (hasFiles) {
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
    
    // Show progress container
    progressContainer.classList.add('show');
    
    // Simulate upload progress (since we can't track actual FormData upload easily)
    let progress = 0;
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressPercentage = progressContainer.querySelector('.progress-percentage');
    
    const interval = setInterval(() => {
      progress += 10;
      progressFill.style.width = progress + '%';
      progressPercentage.textContent = progress + '%';
      
      if (progress >= 90) {
        clearInterval(interval);
      }
    }, 200);
    
    // The form will submit naturally, complete on page reload
  }
}

/**
 * ✅ NEW: Handle file selection and show preview
 */
function handleFileSelect(input, fileType) {
  const label = input.closest('label');
  if (input.files.length > 0) {
    const fileName = input.files[0].name;
    const fileSize = (input.files[0].size / 1024 / 1024).toFixed(2); // MB
    
    // Update button appearance
    label.classList.add('btn-success');
    label.classList.remove('btn-outline-secondary');
    
    // Update icon to checkmark
    const icon = label.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-check-circle me-2';
    }
    
    // Update progress filename
    const progressFilename = document.querySelector('.progress-filename');
    if (progressFilename) {
      progressFilename.textContent = `${fileName} (${fileSize} MB)`;
    }
  } else {
    // Reset button
    label.classList.remove('btn-success');
    label.classList.add('btn-outline-secondary');
    
    // Reset icon
    const icon = label.querySelector('i');
    if (icon) {
      const iconTypes = {
        'image': 'fa-image',
        'video': 'fa-video',
        'file': 'fa-file'
      };
      icon.className = `fas ${iconTypes[fileType]} me-2`;
    }
  }
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
  if (!e.target.closest('.reaction-wrapper')) {
    document.querySelectorAll('.reaction-picker').forEach(p => {
      p.classList.remove('show');
      p.classList.remove('hover-show');
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
    closeReactionModal();
  }
});

/**
 * ✅ NEW: Dropdown toggle function
 */
function toggleAnnouncementDropdown(event, announcementId) {
  event.preventDefault();
  event.stopPropagation();
  
  const menu = document.getElementById('dropdownMenu' + announcementId);
  const button = document.getElementById('dropdownMenuButton' + announcementId);
  
  if (!menu) {
    console.error('Dropdown menu not found:', 'dropdownMenu' + announcementId);
    return;
  }
  
  const isOpen = menu.classList.contains('show');
  
  // Close all other dropdowns
  document.querySelectorAll('.dropdown-menu').forEach(m => {
    if (m.id !== 'dropdownMenu' + announcementId) {
      m.classList.remove('show');
      const btn = m.previousElementSibling;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Toggle current dropdown
  if (isOpen) {
    menu.classList.remove('show');
    button.setAttribute('aria-expanded', 'false');
  } else {
    menu.classList.add('show');
    button.setAttribute('aria-expanded', 'true');
  }
}

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
  
  // Handle single file upload buttons (image, video)
  const createForm = document.getElementById('createAnnouncementForm');
  if (createForm) {
    // Add form submit handler
    createForm.addEventListener('submit', function(e) {
      return submitAnnouncementForm(e, 'create');
    });
    
    // Single file inputs (image, video)
    const singleFileInputs = createForm.querySelectorAll('input[name="image"], input[name="video"]');
    singleFileInputs.forEach(input => {
      input.addEventListener('change', function() {
        const button = this.closest('label');
        if (this.files.length > 0) {
          button.classList.add('btn-success');
          button.classList.remove('btn-outline-secondary');
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-check-circle me-2';
          }
        } else {
          button.classList.remove('btn-success');
          button.classList.add('btn-outline-secondary');
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-image me-2';
          }
        }
      });
    });
  }
  
  // Handle multiple file inputs in create modal
  const createMultiFileInput = document.getElementById('multiFileInput');
  if (createMultiFileInput) {
    createMultiFileInput.addEventListener('change', function() {
      handleMultipleFiles(this, 'selectedFilesList');
    });
  }
  
  // Handle file upload preview in edit announcement modal
  const editForm = document.getElementById('editAnnouncementForm');
  if (editForm) {
    // Add form submit handler
    editForm.addEventListener('submit', function(e) {
      return submitAnnouncementForm(e, 'edit');
    });
    
    // Single file inputs (image, video)
    const singleFileInputs = editForm.querySelectorAll('input[name="image"], input[name="video"]');
    singleFileInputs.forEach(input => {
      input.addEventListener('change', function() {
        const button = this.closest('label');
        if (this.files.length > 0) {
          button.classList.add('btn-success');
          button.classList.remove('btn-outline-secondary');
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-check-circle me-2';
          }
        } else {
          button.classList.remove('btn-success');
          button.classList.add('btn-outline-secondary');
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-image me-2';
          }
        }
      });
    });
  }
  
  // Handle multiple file inputs in edit modal
  const editMultiFileInput = document.getElementById('editMultiFileInput');
  if (editMultiFileInput) {
    editMultiFileInput.addEventListener('change', function() {
      handleMultipleFiles(this, 'editSelectedFilesList');
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
        const button = menu.previousElementSibling;
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    }
  });
  
  // Prevent dropdown from closing when clicking inside menu
  document.addEventListener('click', function(e) {
    if (e.target.closest('.dropdown-menu')) {
      e.stopPropagation();
    }
  });
});