import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, '');
export const TOKEN_KEY = 'unfazed_token';

const axiosInstance = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function readBlobError(data) {
  try {
    return JSON.parse(await data.text());
  } catch {
    return {};
  }
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    let data = error.response?.data || {};
    if (data instanceof Blob) data = await readBlobError(data);

    const message =
      data.message ||
      (error.code === 'ERR_NETWORK'
        ? 'Cannot reach the Unfazed server. Please check that the API is running.'
        : error.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : 'Something went wrong. Please try again.');

    const normalized = new Error(message);
    normalized.status = status;
    normalized.code = data.code;
    normalized.details = data.details;

    if (status === 401 && localStorage.getItem(TOKEN_KEY) && !error.config?.skipAuthRedirect) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('unfazed:logout'));
    }
    if (status === 403 && data.code === 'UPGRADE_REQUIRED') {
      window.dispatchEvent(new CustomEvent('unfazed:upgrade-required', { detail: data.details }));
    }
    return Promise.reject(normalized);
  }
);

export default axiosInstance;
