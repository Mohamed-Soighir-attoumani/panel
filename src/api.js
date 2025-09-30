// src/api.js
import axios from "axios";
import { API_URL } from "./config";

/**
 * On force un baseURL qui finit TOUJOURS par /api/
 * Quel que soit ton API_URL (avec ou sans /api), on retombe sur .../api/
 */
const raw = String(API_URL || "").replace(/\/+$/, "");
const withApi = /\/api$/i.test(raw) ? raw : `${raw}/api`;
const baseURL = `${withApi}/`; // <-- slash final IMPORTANT

const api = axios.create({
  baseURL,
  timeout: 20000,
  validateStatus: () => true,
});

// 🔐 Bearer auto (prend 'token' puis fallback 'token_orig' si besoin)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("token_orig");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // ✅ On veut toujours adresser RELATIVEMENT à baseURL (/api/)
  //    Donc :
  //    - on supprime le slash de tête s'il y en a un
  //    - on supprime "api/" de tête si quelqu’un a encore mis "/api/..."
  if (typeof config.url === "string") {
    let u = config.url.trim();
    if (u.startsWith("/")) u = u.slice(1);
    if (u.toLowerCase().startsWith("api/")) u = u.slice(4);
    config.url = u; // ex: "me", "incidents?x=1", "articles/123"
  }
  return config;
});

export default api;
