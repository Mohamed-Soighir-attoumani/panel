// src/config.js
// BASE_URL = racine serveur backend (sans /api)
// API_URL  = endpoint API (avec /api)

export const BASE_URL = 'https://backend-admin-tygd.onrender.com'.replace(/\/+$/, '');
export const API_URL  = `${BASE_URL}/api`;

// (optionnel) clé app s'il t'en faut une côté panel
export const APP_KEY = import.meta.env?.VITE_APP_KEY ?? 'ton-secret-app';
