// login.js
redirectIfLoggedIn(); // If already logged in, go to dashboard

const loginForm = document.getElementById('loginForm');
const loginBtn  = document.getElementById('loginBtn');
const msgDiv    = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // UI: loading state
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  msgDiv.className = 'message-box';
  msgDiv.textContent = '';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
      // Persist token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('userData', JSON.stringify({
        name:  data.name || email.split('@')[0],
        email: email,
        role:  data.role || 'user'
      }));

      msgDiv.className  = 'message-box success';
      msgDiv.textContent = '✓ Login successful! Redirecting…';
      setTimeout(() => window.location.href = 'index.html', 800);
    } else {
      msgDiv.className  = 'message-box error';
      msgDiv.textContent = data.error || 'Login failed. Please try again.';
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  } catch (err) {
    msgDiv.className  = 'message-box error';
    msgDiv.textContent = 'Network error. Is the server running?';
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
});
