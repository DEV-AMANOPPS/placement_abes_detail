/**
 * config.js - Central configuration for the ABES Placement Portal
 */
const CONFIG = {
  // Use localhost for local development, and the Render URL for production
  API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '' // Use relative paths on localhost (since backend serves frontend)
    : 'https://placement-abes-detail.onrender.com', // Live Render Backend

  // Helper to ensure API paths are consistent
  getApiUrl: (path) => {
    // If it's a relative path, prefix it with the base URL
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${CONFIG.API_BASE_URL}${cleanPath}`;
  }
};

console.log('API Configuration Loaded:', CONFIG.API_BASE_URL || 'Local Environment');
