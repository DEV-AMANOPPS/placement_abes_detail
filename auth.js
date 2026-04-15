// ==============================
// auth.js - Central Auth Helper
// ==============================

function getToken() {
  return localStorage.getItem('token');
}

function getUserData() {
  const raw = localStorage.getItem('userData');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  // Decode JWT payload (base64) without library
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      logout(false);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getTokenPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function logout(redirect = true) {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  if (redirect) window.location.href = 'login.html';
}

// Auth guard: call on protected pages (dashboard, index.html)
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Guard: redirect logged-in users away from login/register
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = 'index.html';
  }
}

// Inject user name into a DOM element
function injectUserName(elementId, fallback = 'Student') {
  const userData = getUserData();
  const payload = getTokenPayload();
  const name = userData?.name || payload?.name || fallback;
  const el = document.getElementById(elementId);
  if (el) el.textContent = name;
  return name;
}
