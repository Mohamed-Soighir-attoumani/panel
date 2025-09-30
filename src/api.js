// src/api.js
import axios from "axios";
import { API_URL } from "./config";

// Base directement sur .../api
const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  validateStatus: () => true,
});

// 🔐 Token auto
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Compatibilité : si quelqu’un passe encore un chemin commençant par /api/…,
  // on le normalise pour éviter /api/api/…
  if (typeof config.url === "string") {
    config.url = config.url.replace(/^\/api(\/|$)/, "/");
  }
  return config;
});

export default api;
