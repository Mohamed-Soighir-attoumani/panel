// src/api.js
import axios from "axios";
import { API_URL } from "./config";

/**
 * Normalise la base pour garantir UNE SEULE fois le suffixe /api.
 * - "https://host"            -> "https://host/api"
 * - "https://host/"           -> "https://host/api"
 * - "https://host/api"        -> "https://host/api"
 * - "https://host/api/"       -> "https://host/api"
 * - "https://host/api/api"    -> "https://host/api"   (corrige doublon)
 * - ""/undefined -> window.location.origin + "/api"   (fallback)
 */
function makeApiBase(raw) {
  const baseRaw = (raw || "").trim().replace(/\/+$/, "");
  const origin =
    baseRaw ||
    (typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "");

  if (!origin) return "/api"; // très rare (SSR sans env), mais safe

  // supprime doublons finaux "/api(/api)*"
  const cleaned = origin.replace(/(?:\/api)+$/i, "");
  return `${cleaned}/api`;
}

const BASE = makeApiBase(API_URL);

const api = axios.create({
  baseURL: BASE,        // ex: https://mon-backend.tld/api
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

  // Nettoie un éventuel "/api/..." au début du chemin pour éviter /api/api/...
  if (typeof config.url === "string") {
    // force un seul slash de tête
    if (!config.url.startsWith("/")) config.url = `/${config.url}`;
    // supprime un préfixe /api s'il existe
    config.url = config.url.replace(/^\/api(\/|$)/i, "/");
  }

  return config;
});

export default api;
