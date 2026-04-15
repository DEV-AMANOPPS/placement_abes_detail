document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    const msgDiv = document.getElementById('registerMessage');
    if (res.ok) {
        msgDiv.textContent = 'Registration successful! Redirecting to login...';
        setTimeout(() => window.location.href = 'login.html', 1000);
    } else {
        msgDiv.textContent = data.error || 'Registration failed';
    }
});
