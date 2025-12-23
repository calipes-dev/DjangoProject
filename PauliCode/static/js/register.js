// register.js - Fixed: Use readonly to preserve form values

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const signupBtn = document.getElementById('signup-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const verificationSection = document.getElementById('verification-section');
  const verifyBtnContainer = document.getElementById('verify-btn-container');
  const schoolSelect = document.getElementById('school');
  const emailInput = document.getElementById('email');
  let verificationPending = false;
  
  // Get URLs from data attributes
  const sendCodeUrl = signupForm.getAttribute('data-send-code-url');
  const verifyUrl = signupForm.getAttribute('data-verify-url');
  
  // Add focus animations to form groups
  const formGroups = document.querySelectorAll('.col-md-6');
  formGroups.forEach((group, index) => {
    group.style.animation = `slideUp 0.6s ease-out ${0.3 + index * 0.1}s both`;
  });
  
  // Password Toggle Functionality
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-target');
      const passwordInput = document.getElementById(targetId);
      const icon = this.querySelector('i');
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  });
  
  // Show/hide toggle button based on input
  const passwordInputs = document.querySelectorAll('.password-wrapper .input-field-custom');
  
  passwordInputs.forEach(input => {
    const toggleBtn = input.parentElement.querySelector('.toggle-password');
    
    input.addEventListener('input', function() {
      if (this.value.length > 0) {
        toggleBtn.classList.add('visible');
      } else {
        toggleBtn.classList.remove('visible');
      }
    });
    
    input.addEventListener('focus', function() {
      if (this.value.length > 0) {
        toggleBtn.classList.add('visible');
      }
    });
  });
  
  // Email validation based on school selection
  function validateEmailForSchool(email, school) {
    if (school === 'spus') {
      return email.includes('spus.edu.ph');
    }
    return true;
  }
  
  // Update email validation when school changes
  schoolSelect.addEventListener('change', function() {
    clearError('email');
    if (emailInput.value) {
      validateEmail();
    }
  });
  
  // Real-time email validation
  function validateEmail() {
    const email = emailInput.value.trim();
    const school = schoolSelect.value;
    
    if (email && school === 'spus') {
      if (!validateEmailForSchool(email, school)) {
        showError('email', '* For St. Paul University, email must contain spus.edu.ph');
        return false;
      }
    }
    clearError('email');
    return true;
  }
  
  emailInput.addEventListener('input', validateEmail);
  
  // Handle signup button click - send verification code
  signupBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    clearErrors();
    
    const firstName = document.getElementById('first_name').value.trim();
    const lastName = document.getElementById('last_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const school = document.getElementById('school').value;
    const schoolId = document.getElementById('school_id').value.trim();
    const userType = document.getElementById('user_type').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    
    let hasError = false;
    
    if (!firstName) {
      showError('first_name', '* First name is required');
      hasError = true;
    }
    
    if (!lastName) {
      showError('last_name', '* Last name is required');
      hasError = true;
    }
    
    if (!email) {
      showError('email', '* Email is required');
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', '* Please enter a valid email');
      hasError = true;
    } else if (school === 'spus' && !validateEmailForSchool(email, school)) {
      showError('email', '* For St. Paul University, email must contain spus.edu.ph');
      hasError = true;
    }
    
    if (!school) {
      showError('school', '* Please select a school');
      hasError = true;
    }
    
    if (!schoolId) {
      showError('school_id', '* School ID is required');
      hasError = true;
    }
    
    if (!userType) {
      showError('user_type', '* Please select a user type');
      hasError = true;
    }
    
    if (!password) {
      showError('password', '* Password is required');
      hasError = true;
    } else if (password.length < 8) {
      showError('password', '* Password must be at least 8 characters');
      hasError = true;
    }
    
    if (!confirmPassword) {
      showError('confirm_password', '* Please confirm your password');
      hasError = true;
    } else if (password && confirmPassword && password !== confirmPassword) {
      showError('confirm_password', '* Passwords do not match');
      hasError = true;
    }
    
    if (!hasError) {
      sendVerificationCode(email, firstName, lastName);
    }
  });
  
  // Send verification code via AJAX
  function sendVerificationCode(email, firstName, lastName) {
    signupBtn.disabled = true;
    signupBtn.textContent = 'Sending code...';
    
    fetch(sendCodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: JSON.stringify({
        email: email,
        first_name: firstName,
        last_name: lastName,
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        verificationPending = true;
        verificationSection.style.display = 'block';
        verifyBtnContainer.style.display = 'block';
        
        // ✅ Use readonly instead of disabled
        lockFormInputs(true);
        
        signupBtn.style.display = 'none';
        showAlert('Verification code sent to ' + email, 'success');
      } else {
        showError('email', '* Failed to send code: ' + (data.message || 'Please try again'));
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('email', '* Error sending code. Please try again.');
      signupBtn.disabled = false;
      signupBtn.textContent = 'Create Account';
    });
  }
  
  // ✅ NEW: Lock form inputs using readonly (preserves values in submission)
  function lockFormInputs(lock) {
    // Get all input and select elements except verification code
    const inputs = document.querySelectorAll('input:not(#verification_code), select');
    
    inputs.forEach(input => {
      if (lock) {
        // For input fields, use readonly
        if (input.tagName === 'INPUT') {
          input.setAttribute('readonly', 'readonly');
        }
        // For select fields, we must use disabled BUT add hidden inputs
        else if (input.tagName === 'SELECT') {
          input.disabled = true;
          // Create hidden input to preserve value
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'hidden';
          hiddenInput.name = input.name;
          hiddenInput.value = input.value;
          hiddenInput.className = 'temp-hidden-input';
          input.parentNode.insertBefore(hiddenInput, input.nextSibling);
        }
        
        input.style.opacity = '0.6';
        input.style.pointerEvents = 'none';
        input.style.backgroundColor = '#f5f5f5';
      } else {
        // Unlock
        if (input.tagName === 'INPUT') {
          input.removeAttribute('readonly');
        } else if (input.tagName === 'SELECT') {
          input.disabled = false;
          // Remove hidden inputs
          const hiddenInputs = document.querySelectorAll('.temp-hidden-input');
          hiddenInputs.forEach(hidden => hidden.remove());
        }
        
        input.style.opacity = '1';
        input.style.pointerEvents = 'auto';
        input.style.backgroundColor = '';
      }
    });
  }
  
  // Handle verify button click
  verifyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    clearError('verification_code');
    const verificationCode = document.getElementById('verification_code').value.trim();
    
    if (!verificationCode) {
      showError('verification_code', '* Verification code is required');
      return;
    }
    
    if (!/^\d{6}$/.test(verificationCode)) {
      showError('verification_code', '* Code must be 6 digits');
      return;
    }
    
    verifyCode(verificationCode);
  });
  
  // Verify code and create account
  function verifyCode(code) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    
    // ✅ Create FormData from the form (includes all fields)
    const formData = new FormData(signupForm);
    
    // ✅ DON'T append verification_code - it's already in the form!
    // The input field with id="verification_code" is automatically included
    
    fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showAlert('Account created successfully! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = data.redirect_url || '/login/';
        }, 1500);
      } else {
        showError('verification_code', '* ' + (data.message || 'Invalid code. Please try again.'));
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify & Complete';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('verification_code', '* Error verifying code. Please try again.');
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify & Complete';
    });
  }
  
  // Real-time password match validation
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirm_password');
  
  confirmPasswordField.addEventListener('input', function() {
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;
    
    if (confirmPassword && password !== confirmPassword) {
      showError('confirm_password', '* Passwords do not match');
    } else {
      clearError('confirm_password');
    }
  });
  
  // Clear error on input focus
  const inputFields = document.querySelectorAll('.input-field-custom');
  inputFields.forEach(input => {
    input.addEventListener('focus', function() {
      clearError(this.id);
    });
  });
  
  // Alert box auto-hide
  const alertBox = document.getElementById('alert-box');
  if (alertBox) {
    setTimeout(() => {
      alertBox.style.opacity = '0';
      setTimeout(() => alertBox.remove(), 500);
    }, 3000);
  }
});

// Helper functions
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorSpan = document.getElementById(fieldId + '_error');
  
  if (field) {
    field.classList.add('error');
  }
  if (errorSpan) {
    errorSpan.textContent = message;
  }
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorSpan = document.getElementById(fieldId + '_error');
  
  if (field) {
    field.classList.remove('error');
  }
  if (errorSpan) {
    errorSpan.textContent = '';
  }
}

function clearErrors() {
  const errorMessages = document.querySelectorAll('.error-message');
  const inputFields = document.querySelectorAll('.input-field-custom, .select-field-custom');
  
  errorMessages.forEach(error => error.textContent = '');
  inputFields.forEach(field => field.classList.remove('error'));
}

function showAlert(message, type) {
  const alertBox = document.createElement('div');
  alertBox.id = 'alert-box';
  alertBox.className = `alert-box alert-${type}`;
  alertBox.textContent = message;
  document.body.appendChild(alertBox);
  
  setTimeout(() => {
    alertBox.style.opacity = '0';
    setTimeout(() => alertBox.remove(), 500);
  }, 4000);
}