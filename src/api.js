// src/api.js
import axios from "axios";
import { API_URL } from "./config";

// On supprime /api final si présent pour éviter /api/api/...
const ROOT_URL = API_URL.replace(/\/api\/?$/, "");

const api = axios.create({ baseURL: ROOT_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
