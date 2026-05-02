import axios, { type AxiosError } from "axios";

import useUserStore from "../stores/userStore";

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
// Keep local development working even when .env is not created yet.
const apiBaseUrl = envBaseUrl || (import.meta.env.DEV ? "http://127.0.0.1:8000" : undefined);

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
});

axiosInstance.interceptors.request.use((config) => {
  const token = useUserStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useUserStore.getState().clear();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;

export async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await axiosInstance.get(url, { responseType: "blob" });
  const blob = response.data as Blob;
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
