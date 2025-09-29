// src/api.js
import axios from "axios";
import { API_URL } from "./config";

// ✅ On supprime le /api final si présent pour éviter /api/api/...
const ROOT_URL = API_URL.replace(/\/api\/?$/, "");

const api = axios.create({ baseURL: ROOT_URL });

// Ajoute automatiquement le token admin si présent (localStorage)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
