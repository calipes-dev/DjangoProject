// register.js - Fixed: Use readonly to preserve form values

const DEBUG = true;

function dbg(label, data) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().split('T')[1].slice(0, -1);
  if (data !== undefined) {
    console.groupCollapsed(`%c[PauliCode] ${ts} » ${label}`, 'color:#4CD964;font-weight:600;');
    console.log(data);
    console.groupEnd();
  } else {
    console.log(`%c[PauliCode] ${ts} » ${label}`, 'color:#4CD964;font-weight:600;');
  }
}

function dbgError(label, err) {
  const ts = new Date().toISOString().split('T')[1].slice(0, -1);
  console.error(`%c[PauliCode] ${ts} ✖ ${label}`, 'color:#f87171;font-weight:700;', err);
}

function dbgWarn(label, data) {
  const ts = new Date().toISOString().split('T')[1].slice(0, -1);
  console.warn(`%c[PauliCode] ${ts} ⚠ ${label}`, 'color:#fbbf24;font-weight:600;', data ?? '');
}

document.addEventListener('DOMContentLoaded', function() {
  dbg('DOM ready — register.js initialising');

  const signupForm = document.getElementById('signupForm');
  const signupBtn  = document.getElementById('signupBtn');
  const verifyBtn  = document.getElementById('verifyBtn');
  const verifySection = document.getElementById('verifySection');
  const overlay    = document.getElementById('loadingOverlay');
  const card       = document.getElementById('regCard');
  const glow       = document.getElementById('regGlow');

  // Sanity-check critical DOM nodes
  const domNodes = { signupForm, signupBtn, verifyBtn, verifySection, overlay, card, glow };
  Object.entries(domNodes).forEach(([name, el]) => {
    if (!el) dbgWarn(`DOM node not found: #${name}`);
  });

  // Get URLs from data attributes on the form
  const sendCodeUrl = signupForm?.getAttribute('data-send-code-url');
  const verifyUrl   = signupForm?.getAttribute('data-verify-url');
  dbg('Endpoint URLs resolved', { sendCodeUrl, verifyUrl });
  if (!sendCodeUrl) dbgWarn('data-send-code-url is missing from <form>');
  if (!verifyUrl)   dbgWarn('data-verify-url is missing from <form>');

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
      if (!input) { dbgWarn(`pw-toggle: input #${target} not found`); return; }
      const isText = input.type === 'text';
      input.type   = isText ? 'password' : 'text';
      dbg(`Password toggle: #${target} → type="${input.type}"`);
      eye.innerHTML = isText
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    });
  });

  // ── Numeric-only verification code input ──
  const codeInput = document.getElementById('verification_code');
  if (codeInput) {
    codeInput.addEventListener('input', function () {
      const raw = this.value;
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
      if (raw !== this.value) dbgWarn('Verification code: non-numeric chars stripped', { raw, cleaned: this.value });
    });
  } else {
    dbgWarn('DOM node not found: #verification_code');
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
    dbg(`School changed → "${this.value}"`);
    clearError('email');
    if (emailInput.value) validateEmailLive();
  });

  function validateEmailLive() {
    const email  = emailInput.value.trim();
    const school = schoolSelect.value;
    if (email && school === 'spus' && !validateEmailForSchool(email, school)) {
      dbgWarn('Email validation failed (school domain mismatch)', { email, school });
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
    dbg('validateForm() called');
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

    const missingFields = [];
    required.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) { dbgWarn(`validateForm: field #${f.id} not found in DOM`); return; }
      if (!el.value.trim()) {
        showError(f.id, f.msg);
        missingFields.push(f.id);
        valid = false;
      }
    });
    if (missingFields.length) dbgWarn('validateForm: empty required fields', missingFields);

    const email = emailInput.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      dbgWarn('validateForm: invalid email format', email);
      showError('email', 'Enter a valid email address');
      valid = false;
    } else if (email && schoolSelect.value === 'spus' && !validateEmailForSchool(email, schoolSelect.value)) {
      dbgWarn('validateForm: SPUS domain mismatch', { email, school: schoolSelect.value });
      showError('email', 'For St. Paul University, email must contain spus.edu.ph');
      valid = false;
    }

    const pw  = passwordField.value;
    const cpw = confirmPasswordField.value;
    if (pw && pw.length < 8) {
      dbgWarn('validateForm: password too short', { length: pw.length });
      showError('password', 'Password must be at least 8 characters');
      valid = false;
    }
    if (pw && cpw && pw !== cpw) {
      dbgWarn('validateForm: passwords do not match');
      showError('confirm_password', 'Passwords do not match');
      valid = false;
    }

    dbg(`validateForm() result → ${valid ? '✔ PASS' : '✖ FAIL'}`);
    return valid;
  }

  // ── Lock / unlock form inputs ──
  function lockFormInputs(lock) {
    dbg(`lockFormInputs(${lock})`);
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
    dbg('signupBtn clicked');

    if (!validateForm()) {
      dbgWarn('signupBtn: form validation failed — aborting send-code request');
      return;
    }

    const email = emailInput.value.trim();
    const payload = {
      email,
      first_name:       document.getElementById('first_name').value.trim(),
      last_name:        document.getElementById('last_name').value.trim(),
      school_id:        document.getElementById('school_id').value.trim(),
      school:           schoolSelect.value,
      user_type:        document.getElementById('user_type').value,
      password:         passwordField.value,
      confirm_password: confirmPasswordField.value,
      context:          'signup',
    };
    dbg('send-code → request payload (password redacted)', { ...payload, password: '***', confirm_password: '***' });

    signupBtn.disabled = true;
    overlay.classList.remove('hidden');

    fetch(sendCodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: JSON.stringify(payload),
    })
    .then(res => {
      dbg('send-code → HTTP response', { status: res.status, ok: res.ok, url: res.url });
      if (!res.ok) dbgWarn(`send-code → non-2xx status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      dbg('send-code → response JSON', data);
      if (data.success) {
        dbg('send-code → success, showing verify section');
        document.getElementById('emailDisplay').textContent = email;
        verifySection.style.display = 'block';
        signupBtn.style.display     = 'none';
        verifyBtn.style.display     = 'flex';
        codeInput.focus();

        lockFormInputs(true);

        const s1 = document.getElementById('step1');
        const s2 = document.getElementById('step2');
        const s3 = document.getElementById('step3');
        s1.classList.remove('active'); s1.classList.add('done');
        s2.classList.remove('active'); s2.classList.add('done');
        s3.classList.add('active');
      } else {
        dbgWarn('send-code → server returned success:false', { message: data.message });
        showError('email', data.message || 'Failed to send verification code. Please try again.');
        signupBtn.disabled = false;
      }
    })
    .catch(err => {
      dbgError('send-code → fetch/parse error', err);
      showError('email', 'Something went wrong. Please try again.');
      signupBtn.disabled = false;
    })
    .finally(() => {
      overlay.classList.add('hidden');
      dbg('send-code → request cycle complete');
    });
  });

  // ── Verify & Complete button ──
  verifyBtn.addEventListener('click', function () {
    dbg('verifyBtn clicked');
    clearError('verification_code');

    const code = codeInput.value.trim();
    dbg('verify → code entered', { length: code.length, value: code });

    if (!code) {
      dbgWarn('verify → empty code submitted');
      showError('verification_code', 'Verification code is required');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      dbgWarn('verify → code failed regex (must be 6 digits)', code);
      showError('verification_code', 'Code must be 6 digits');
      return;
    }

    verifyBtn.disabled    = true;
    verifyBtn.textContent = 'Verifying…';

    const formData = new FormData(signupForm);
    dbg('verify → FormData fields', Object.fromEntries(
      [...formData.entries()].map(([k, v]) =>
        k.toLowerCase().includes('password') ? [k, '***'] : [k, v]
      )
    ));

    fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
      body: formData,
    })
    .then(res => {
      dbg('verify → HTTP response', { status: res.status, ok: res.ok, url: res.url });
      if (!res.ok) dbgWarn(`verify → non-2xx status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      dbg('verify → response JSON', data);
      if (data.success) {
        dbg('verify → success! redirecting', { redirect_url: data.redirect_url || '/' });
        window.location.href = data.redirect_url || '/';
      } else {
        dbgWarn('verify → server returned success:false', { message: data.message });
        showError('verification_code', data.message || 'Invalid code. Please try again.');
        verifyBtn.disabled    = false;
        verifyBtn.textContent = 'Verify & Complete';
      }
    })
    .catch(err => {
      dbgError('verify → fetch/parse error', err);
      showError('verification_code', 'Error verifying code. Please try again.');
      verifyBtn.disabled    = false;
      verifyBtn.textContent = 'Verify & Complete';
    });
  });

  dbg('register.js fully initialised ✔');
});

// ── Helper functions ──
function showError(fieldId, message) {
  const errorSpan = document.getElementById(fieldId + '_error');
  if (errorSpan) {
    errorSpan.textContent = message;
  } else {
    console.warn(`%c[PauliCode] showError: #${fieldId}_error not found in DOM`, 'color:#fbbf24;font-weight:600;');
  }
}

function clearError(fieldId) {
  const errorSpan = document.getElementById(fieldId + '_error');
  if (errorSpan) errorSpan.textContent = '';
}