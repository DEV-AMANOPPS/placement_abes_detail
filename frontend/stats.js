// stats.js — Real-time stats polling with smooth number animation

let previousCount = null;

function animateNumber(el, from, to, duration = 600) {
  if (from === to) return;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = current + ' Students Registered';
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

async function fetchAndUpdateStats() {
  try {
    const res = await fetch(CONFIG.getApiUrl('/api/stats'));
    if (!res.ok) return;
    const data = await res.json();

    const count = data.global?.totalUsers ?? data.totalUsers ?? 0;
    const el = document.getElementById('registered-count');

    if (el) {
      if (previousCount === null) {
        // First load — just set it
        el.textContent = count + ' Students Registered';
      } else if (count !== previousCount) {
        // Animate the change
        animateNumber(el, previousCount, count);
        // Brief highlight pulse to signal update
        el.style.transition = 'color 0.3s';
        el.style.color = '#10b981';
        setTimeout(() => { el.style.color = ''; }, 1000);
      }
      previousCount = count;
    }
  } catch (err) {
    // Silently fail — don't break the dashboard
  }
}

// Initial fetch immediately
fetchAndUpdateStats();

// Poll every 5 seconds for real-time updates
setInterval(fetchAndUpdateStats, 5000);
