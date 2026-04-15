// register.js
redirectIfLoggedIn(); // If already logged in, go to dashboard

const registerForm = document.getElementById('registerForm');
const registerBtn  = document.getElementById('registerBtn');
const msgDiv       = document.getElementById('registerMessage');
const passwordInput = document.getElementById('password');
const strengthFill  = document.getElementById('strengthFill');
const strengthHint  = document.getElementById('strengthHint');

// Password strength indicator
passwordInput.addEventListener('input', function() {
  const val = this.value;
  let strength = 0;
  let hint = 'Too short';
  let color = '#ef4444'; // red

  if (val.length >= 6)  { strength = 33; hint = 'Weak'; color = '#f59e0b'; }
  if (val.length >= 8 && /[A-Z]/.test(val)) { strength = 66; hint = 'Good'; color = '#06b6d4'; }
  if (val.length >= 10 && /[A-Z]/.test(val) && /[0-9]/.test(val)) { strength = 100; hint = 'Strong 💪'; color = '#10b981'; }

  strengthFill.style.width      = strength + '%';
  strengthFill.style.background = color;
  strengthHint.textContent      = hint;
  strengthHint.style.color      = color;
});

registerForm.addEventListener('submit', async function(e) {
  e.preventDefault();

  const name     = document.getElementById('name').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = passwordInput.value;

  if (password.length < 6) {
    msgDiv.className  = 'message-box error';
    msgDiv.textContent = 'Password must be at least 6 characters.';
    return;
  }

  registerBtn.classList.add('loading');
  registerBtn.disabled = true;
  msgDiv.className  = 'message-box';
  msgDiv.textContent = '';

  try {
    // Check if the user is accidentally opening the file via file:// protocol
    if (window.location.protocol === 'file:') {
      throw new Error('You are opening the file directly. Please use http://localhost:3000/register.html instead.');
    }

    const res  = await fetch(CONFIG.getApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (res.ok) {
      msgDiv.className  = 'message-box success';
      msgDiv.textContent = '✓ Account created! Redirecting to login…';
      setTimeout(() => window.location.href = 'login.html', 1200);
    } else {
      msgDiv.className  = 'message-box error';
      msgDiv.textContent = data.error || 'Registration failed. Please try again.';
      registerBtn.classList.remove('loading');
      registerBtn.disabled = false;
    }
  } catch (err) {
    console.error('Registration Error Details:', err);
    msgDiv.className  = 'message-box error';
    msgDiv.textContent = err.message.includes('opening the file directly') 
      ? err.message 
      : 'Network error. Is the server running on port 3000?';
    registerBtn.classList.remove('loading');
    registerBtn.disabled = false;
  }
});
