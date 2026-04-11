// register.js - Fixed: Use readonly to preserve form values

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const signupBtn = document.getElementById('signupBtn');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifySection = document.getElementById('verifySection');
  const overlay = document.getElementById('loadingOverlay');
  const card = document.getElementById('regCard');
  const glow = document.getElementById('regGlow');

  // Get URLs from data attributes on the form
  const sendCodeUrl = signupForm.getAttribute('data-send-code-url');
  const verifyUrl = signupForm.getAttribute('data-verify-url');

  // ── Cursor glow effect ──
  card.addEventListener('mousemove', function (e) {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width)  * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    glow.style.background = `radial-gradient(500px circle at ${x}% ${y}%, rgba(76,217,100,0.09) 0%, transparent 65%)`;
  });

  // ── Password toggles ──
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', function () {
      const target = this.dataset.target;
      const input  = document.getElementById(target);
      const eyeId  = target === 'password' ? 'eye1' : 'eye2';
      const eye    = document.getElementById(eyeId);
      const isText = input.type === 'text';
      input.type   = isText ? 'password' : 'text';
      eye.innerHTML = isText
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    });
  });

  // ── Numeric-only verification code input ──
  const codeInput = document.getElementById('verification_code');
  if (codeInput) {
    codeInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  // ── Email validation based on school selection ──
  const schoolSelect = document.getElementById('school');
  const emailInput   = document.getElementById('email');

  function validateEmailForSchool(email, school) {
    if (school === 'spus') {
      return email.includes('spus.edu.ph');
    }
    return true;
  }

  schoolSelect.addEventListener('change', function () {
    clearError('email');
    if (emailInput.value) validateEmailLive();
  });

  function validateEmailLive() {
    const email  = emailInput.value.trim();
    const school = schoolSelect.value;
    if (email && school === 'spus' && !validateEmailForSchool(email, school)) {
      showError('email', 'For St. Paul University, email must contain spus.edu.ph');
      return false;
    }
    clearError('email');
    return true;
  }

  emailInput.addEventListener('input', validateEmailLive);

  // ── Real-time password match ──
  const passwordField        = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirm_password');

  confirmPasswordField.addEventListener('input', function () {
    if (this.value && passwordField.value !== this.value) {
      showError('confirm_password', 'Passwords do not match');
    } else {
      clearError('confirm_password');
    }
  });

  // ── Clear all errors ──
  function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
  }

  // ── Full form validation ──
  function validateForm() {
    let valid = true;
    clearErrors();

    const required = [
      { id: 'first_name',       msg: 'First name is required' },
      { id: 'last_name',        msg: 'Last name is required' },
      { id: 'email',            msg: 'Email is required' },
      { id: 'school_id',        msg: 'School ID is required' },
      { id: 'school',           msg: 'Please select a school' },
      { id: 'user_type',        msg: 'Please select a user type' },
      { id: 'password',         msg: 'Password is required' },
      { id: 'confirm_password', msg: 'Please confirm your password' },
    ];

    required.forEach(f => {
      if (!document.getElementById(f.id).value.trim()) {
        showError(f.id, f.msg);
        valid = false;
      }
    });

    const email = emailInput.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', 'Enter a valid email address');
      valid = false;
    } else if (email && schoolSelect.value === 'spus' && !validateEmailForSchool(email, schoolSelect.value)) {
      showError('email', 'For St. Paul University, email must contain spus.edu.ph');
      valid = false;
    }

    const pw  = passwordField.value;
    const cpw = confirmPasswordField.value;
    if (pw && pw.length < 8) {
      showError('password', 'Password must be at least 8 characters');
      valid = false;
    }
    if (pw && cpw && pw !== cpw) {
      showError('confirm_password', 'Passwords do not match');
      valid = false;
    }

    return valid;
  }

  // ── Lock / unlock form inputs ──
  function lockFormInputs(lock) {
    const inputs = signupForm.querySelectorAll('input:not(#verification_code), select');

    inputs.forEach(input => {
      if (lock) {
        if (input.tagName === 'INPUT') {
          input.setAttribute('readonly', 'readonly');
        } else if (input.tagName === 'SELECT') {
          input.disabled = true;
          const hidden = document.createElement('input');
          hidden.type  = 'hidden';
          hidden.name  = input.name;
          hidden.value = input.value;
          hidden.className = 'temp-hidden-input';
          input.parentNode.insertBefore(hidden, input.nextSibling);
        }
        input.style.opacity        = '0.6';
        input.style.pointerEvents  = 'none';
      } else {
        if (input.tagName === 'INPUT') {
          input.removeAttribute('readonly');
        } else if (input.tagName === 'SELECT') {
          input.disabled = false;
          signupForm.querySelectorAll('.temp-hidden-input').forEach(h => h.remove());
        }
        input.style.opacity       = '1';
        input.style.pointerEvents = 'auto';
      }
    });
  }

  // ── Create Account button → send verification code ──
  signupBtn.addEventListener('click', function () {
    if (!validateForm()) return;

    const email = emailInput.value.trim();

    signupBtn.disabled = true;
    overlay.classList.remove('hidden');

    fetch(sendCodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: JSON.stringify({
        email:            email,
        first_name:       document.getElementById('first_name').value.trim(),
        last_name:        document.getElementById('last_name').value.trim(),
        school_id:        document.getElementById('school_id').value.trim(),
        school:           schoolSelect.value,
        user_type:        document.getElementById('user_type').value,
        password:         passwordField.value,
        confirm_password: confirmPasswordField.value,
        context:          'signup',
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('emailDisplay').textContent = email;
        verifySection.style.display = 'block';
        signupBtn.style.display     = 'none';
        verifyBtn.style.display     = 'flex';
        codeInput.focus();

        lockFormInputs(true);

        // Advance step indicators
        const s1 = document.getElementById('step1');
        const s2 = document.getElementById('step2');
        const s3 = document.getElementById('step3');
        s1.classList.remove('active'); s1.classList.add('done');
        s2.classList.remove('active'); s2.classList.add('done');
        s3.classList.add('active');
      } else {
        showError('email', data.message || 'Failed to send verification code. Please try again.');
        signupBtn.disabled = false;
      }
    })
    .catch(() => {
      showError('email', 'Something went wrong. Please try again.');
      signupBtn.disabled = false;
    })
    .finally(() => {
      overlay.classList.add('hidden');
    });
  });

  // ── Verify & Complete button ──
  verifyBtn.addEventListener('click', function () {
    clearError('verification_code');

    const code = codeInput.value.trim();

    if (!code) {
      showError('verification_code', 'Verification code is required');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      showError('verification_code', 'Code must be 6 digits');
      return;
    }

    verifyBtn.disabled     = true;
    verifyBtn.textContent  = 'Verifying…';

    const formData = new FormData(signupForm);

    fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: formData,
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Redirect to index on successful account creation
        window.location.href = data.redirect_url || '/';
      } else {
        showError('verification_code', data.message || 'Invalid code. Please try again.');
        verifyBtn.disabled    = false;
        verifyBtn.textContent = 'Verify & Complete';
      }
    })
    .catch(() => {
      showError('verification_code', 'Error verifying code. Please try again.');
      verifyBtn.disabled    = false;
      verifyBtn.textContent = 'Verify & Complete';
    });
  });
});

// ── Helper functions ──
function showError(fieldId, message) {
  const errorSpan = document.getElementById(fieldId + '_error');
  if (errorSpan) errorSpan.textContent = message;
}

function clearError(fieldId) {
  const errorSpan = document.getElementById(fieldId + '_error');
  if (errorSpan) errorSpan.textContent = '';
}