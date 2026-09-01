const RENDER_BACKEND = 'https://lms-app-stgs.onrender.com';
const BACKEND_URL = (typeof window !== 'undefined' && window.LMS_BACKEND_URL)
  ? window.LMS_BACKEND_URL
  : (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))
    ? RENDER_BACKEND
    : '';

const API = {
  base: BACKEND_URL + '/api',
  token: () => localStorage.getItem('token'),
  role: () => localStorage.getItem('role'),


  async request(method, url, body, isFormData) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (this.token()) headers['Authorization'] = `Bearer ${this.token()}`;

    const res = await fetch(this.base + url, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body, isFormData) { return this.request('POST', url, body, isFormData); },
  put(url, body) { return this.request('PUT', url, body); },
  patch(url, body) { return this.request('PATCH', url, body); },
  delete(url) { return this.request('DELETE', url); }
};

function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', user.role);
  localStorage.setItem('user', JSON.stringify(user));
}

function requireAuth(role) {
  if (!API.token() || API.role() !== role) {
    window.location.href = '/index.html';
  }
}
