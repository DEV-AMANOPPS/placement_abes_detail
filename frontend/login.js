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
    // Check if the user is accidentally opening the file via file:// protocol
    if (window.location.protocol === 'file:') {
      throw new Error('You are opening the file directly. Please use http://localhost:3000/login.html instead.');
    }

    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
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
    console.error('Login Error Details:', err);
    msgDiv.className  = 'message-box error';
    msgDiv.textContent = err.message.includes('opening the file directly') 
      ? err.message 
      : 'Network error. Is the server running on port 3000?';
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
});
