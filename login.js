document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    const msgDiv = document.getElementById('loginMessage');
    if (res.ok) {
        msgDiv.textContent = 'Login successful! Redirecting...';
        setTimeout(() => window.location.href = 'index.html', 1000);
    } else {
        msgDiv.textContent = data.error || 'Login failed';
    }
});
