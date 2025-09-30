// src/config.js

// On veut que API_URL se termine *exactement* par /api
// Exemple d'env : REACT_APP_API_URL=https://backend-admin-tygd.onrender.com/api
const RAW = (process.env.REACT_APP_API_URL || "https://backend-admin-tygd.onrender.com/api").replace(/\/+$/, "");

// Force le suffixe /api s'il manque
export const API_URL = RAW.endsWith("/api") ? RAW : `${RAW}/api`;

// BASE_URL = racine sans /api (utile pour /uploads)
export const BASE_URL = API_URL.replace(/\/api$/, "");

// Raccourcis d’endpoints (⚠️ sans /api car API_URL l’a déjà)
export const ARTICLES_PATH  = "/articles";
export const PROJECTS_PATH  = "/projects";
export const INCIDENTS_PATH = "/incidents";
