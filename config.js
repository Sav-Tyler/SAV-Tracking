// config.js

// Compute a default base URL from the current host.
// If page is opened as http://192.168.1.23:5000/index.html -> http://192.168.1.23:5000/api
const DEFAULT_API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000/api`;

// Allow override from settings.html via localStorage
const stored = localStorage.getItem('api_base_url');
export const API_BASE_URL = stored || DEFAULT_API_BASE_URL;
