// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

/* --- Base API sûre (évite /api/api) --- */
const BASE_API = API_URL.endsWith("/api") ? API_URL : `${API_URL}/api`;

/* --- Headers avec token + x-commune-id selon rôle --- */
function buildHeaders() {
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("me") || "null");
  } catch {
    me = null;
  }

  if (me?.role === "admin" && me?.communeId) {
    headers["x-commune-id"] = me.communeId;
  } else if (me?.role === "superadmin") {
    const selectedCid =
      (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || "";
    if (selectedCid) headers["x-commune-id"] = selectedCid;
  }
  return headers;
}

const Sidebar = () => {
  const location = useLocation();

  const [open, setOpen] = useState(false); // drawer mobile
  const [pendingCount, setPendingCount] = useState(0);
  const hasPendingIncidents = pendingCount > 0;

  const isActive = (path) => location.pathname.startsWith(path);

  useEffect(() => {
    let mounted = true;
    let intervalId;

    async function fetchIncidents() {
      try {
        const headers = buildHeaders(); // (re)lit token + communeId à chaque tick
        const res = await axios.get(`${BASE_API}/incidents`, { headers, validateStatus: () => true });

        if (!mounted) return;

        if (res.status === 401 || res.status === 403) {
          // ne casse pas la sidebar visuellement; on arrête juste le compteur
          setPendingCount(0);
          return;
        }

        if (res.status >= 200 && res.status < 300) {
          const arr = Array.isArray(res.data) ? res.data : [];
          const enCours = arr.filter((i) => i.status === "En cours");
          setPendingCount(enCours.length);
        } else {
          setPendingCount(0);
        }
      } catch {
        if (!mounted) return;
        setPendingCount(0);
      }
    }

    // premier fetch immédiat puis polling
    fetchIncidents();
    intervalId = setInterval(fetchIncidents, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {/* Burger mobile (sous le header) */}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="md:hidden fixed z-[60] top-[72px] left-3 inline-flex items-center justify-center rounded-md bg-gray-900 text-white px-3 py-2 shadow-lg"
      >
        ☰
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-[55] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* --- Sidebar --- */}
      <aside
        className={[
          "bg-gray-900 text-white",
          // Desktop : colonne gauche qui ne recouvre pas la page
          // -> float-left + largeur fixe, décollée du header fixe (~56px)
          "hidden md:block md:float-left md:w-64 md:min-h-screen md:pt-4 md:mt-[56px] md:px-4",
          // Mobile drawer : fixe par-dessus quand ouvert
          open
            ? "fixed top-0 left-0 z-[65] w-4/5 max-w-xs h-screen p-4 pt-6 md:static"
            : ""
        ].join(" ")}
      >
        {/* En-tête drawer mobile */}
        {open && (
          <div className="md:hidden flex justify-end mb-2">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="rounded-md bg-gray-800 hover:bg-gray-700 px-3 py-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="mt-2">
          <ul className="space-y-4">
            {/* Dashboard */}
            <li>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/dashboard") ? "text-blue-400" : "hover:text-blue-300"
                }`}
              >
                🏠 Tableau de bord
              </Link>
            </li>

            {/* Incidents */}
            <li className="border-t border-gray-700 pt-4 relative">
              <Link
                to="/incidents"
                onClick={() => setOpen(false)}
                className={[
                  "block flex items-center gap-2 text-base font-medium transition",
                  hasPendingIncidents
                    ? "text-red-500 animate-pulse font-semibold"
                    : isActive("/incidents")
                    ? "text-blue-400"
                    : "hover:text-blue-300",
                ].join(" ")}
              >
                📢 Incidents
                {hasPendingIncidents && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs w-5 h-5 animate-bounce">
                    {pendingCount}
                  </span>
                )}
              </Link>
              {hasPendingIncidents && (
                <span className="pointer-events-none absolute -top-1 -right-2 block w-3 h-3 rounded-full bg-red-500 animate-ping" />
              )}
            </li>

            {/* Infos (Santé & Propreté) */}
            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/infos/nouveau"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/infos/nouveau") ? "text-blue-400" : "hover:text-blue-300"
                }`}
              >
                ➕ Santé & Propreté
              </Link>
            </li>
            <li>
              <Link
                to="/infos"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/infos") && !isActive("/infos/nouveau")
                    ? "text-blue-400"
                    : "hover:text-blue-300"
                }`}
              >
                ℹ️ Liste Santé & Propreté
              </Link>
            </li>

            {/* Notifications */}
            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/notifications/nouveau"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/notifications/nouveau") ? "text-blue-400" : "hover:text-blue-300"
                }`}
              >
                ➕ Nouvelle notification
              </Link>
            </li>
            <li>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/notifications") && !isActive("/notifications/nouveau")
                    ? "text-blue-400"
                    : "hover:text-blue-300"
                }`}
              >
                🔔 Liste des notifications
              </Link>
            </li>

            {/* Articles */}
            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/articles/nouveau"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/articles/nouveau") ||
                  (isActive("/articles") && !isActive("/articles/liste"))
                    ? "text-blue-400"
                    : "hover:text-blue-300"
                }`}
              >
                📝 Créer un article
              </Link>
            </li>
            <li>
              <Link
                to="/articles/liste"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/articles/liste") ? "text-blue-400" : "hover:text-blue-300"
                }`}
              >
                📋 Liste des articles
              </Link>
            </li>

            {/* Projets */}
            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/projects/nouveau"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/projects/nouveau") ||
                  (isActive("/projects") && !isActive("/projects/liste"))
                    ? "text-blue-400"
                    : "hover:text-blue-300"
                }`}
              >
                📁 Créer un projet
              </Link>
            </li>
            <li>
              <Link
                to="/projects/liste"
                onClick={() => setOpen(false)}
                className={`block flex items-center gap-2 text-base font-medium transition ${
                  isActive("/projects/liste") ? "text-blue-400" : "hover:text-blue-300"
                }`}
              >
                📄 Liste des projets
              </Link>
            </li>
          </ul>
        </nav>

        {/* Carte signature bas */}
        <a
          href="https://www.facebook.com/mohamedsoighir.attoumani"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-6 block px-3 py-4 rounded-xl bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-inner border border-gray-700 text-center transition-all duration-300 hover:scale-105 hover:border-yellow-400 hover:shadow-lg"
          onClick={() => setOpen(false)}
        >
          <p className="text-sm text-gray-300 group-hover:text-yellow-300 transition">
            Conçu avec passion pour la sécurité citoyenne à Dembeni
          </p>
          <p className="text-base font-bold text-white tracking-wide mt-1 group-hover:text-white">
            MOHAMED SOIGHIR Attoumani
          </p>
          <p className="text-xs text-amber-400 italic mt-1 group-hover:text-amber-300">
            Bénévole engagé depuis 2018 🇾🇹
          </p>
        </a>
      </aside>
    </>
  );
};

export default Sidebar;
