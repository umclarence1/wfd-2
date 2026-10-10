import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken = null;

function readCsrfCookie() {
  const match = document.cookie.split('; ').find((row) => row.startsWith('csrf-token='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export async function ensureCsrfToken(force = false) {
  if (!force) {
    const fromCookie = readCsrfCookie();
    if (fromCookie) {
      csrfToken = fromCookie;
      return csrfToken;
    }
    if (csrfToken) return csrfToken;
  }

  const { data } = await axios.get(`${api.defaults.baseURL}/csrf-token`, { withCredentials: true });
  csrfToken = readCsrfCookie() || data.csrfToken;
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = await ensureCsrfToken();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let refreshPromise = null;

const refreshAccessSession = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, null, { withCredentials: true })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'Invalid CSRF token.' &&
      original &&
      !original._csrfRetry
    ) {
      original._csrfRetry = true;
      clearCsrfToken();
      const token = await ensureCsrfToken(true);
      original.headers['X-CSRF-Token'] = token;
      return api(original);
    }

    const url = String(original?.url || '');
    const isAuthRefresh = url.includes('/auth/refresh') || url.includes('/auth/login');
    if (
      error.response?.status === 401 &&
      original &&
      !original._authRetry &&
      !isAuthRefresh
    ) {
      original._authRetry = true;
      try {
        await refreshAccessSession();
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
