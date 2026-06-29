import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken = null;

export async function ensureCsrfToken() {
  if (!csrfToken) {
    const { data } = await axios.get(`${api.defaults.baseURL}/csrf-token`, { withCredentials: true });
    csrfToken = data.csrfToken;
  }
  return csrfToken;
}

api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = await ensureCsrfToken();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

export default api;
