// Base de l’API (sans /api à la fin)
const RAW = process.env.REACT_APP_API_URL || "https://backend-admin-tygd.onrender.com";
export const API_URL = RAW.replace(/\/+$/, "");
// Racine (pour les fichiers statiques /uploads si nécessaire)
export const BASE_URL = API_URL;

// Chemins d’API REST montés côté backend
export const ARTICLES_PATH      = "/api/articles";
export const PROJECTS_PATH      = "/api/projects";
export const INCIDENTS_PATH     = "/api/incidents";
export const NOTIFICATIONS_PATH = "/api/notifications"; // <= AJOUT
