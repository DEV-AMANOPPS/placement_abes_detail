async function fetchAndUpdateStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();
    // Use totalUsers if provided, otherwise fall back to totalUsers property
    const count = data.totalUsers ?? data.totalUsers;
    const el = document.getElementById('registered-count');
    if (el) {
      el.textContent = `${count} Students Registered`;
    }
  } catch (err) {
    console.error('Failed to fetch stats', err);
  }
}

// Initial fetch and periodic polling every 5 seconds
fetchAndUpdateStats();
setInterval(fetchAndUpdateStats, 5000);
