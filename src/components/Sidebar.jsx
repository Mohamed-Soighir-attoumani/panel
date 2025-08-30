// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

/* --- Helpers headers: token + x-commune-id (admin/superadmin) --- */
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
  // Admin => impose sa commune
  if (me?.role === "admin" && me?.communeId) {
    headers["x-commune-id"] = me.communeId;
  }
  // Superadmin => filtre choisi sinon tout
  if (me?.role === "superadmin") {
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

  // Recalcule les headers si LS change
  const authHeaders = useMemo(buildHeaders, [
    localStorage.getItem("token"),
    localStorage.getItem("selectedCommuneId"),
    localStorage.getItem("me"),
  ]);

  useEffect(() => {
    let mounted = true;
    let intervalId;

    async function fetchIncidents() {
      try {
        const res = await axios.get(`${API_URL}/api/incidents`, { headers: authHeaders });
        const enCours = Array.isArray(res.data)
          ? res.data.filter((i) => i.status === "En cours")
          : [];
        if (!mounted) return;
        setPendingCount(enCours.length);
      } catch {
        // silencieux
      }
    }

    fetchIncidents();
    intervalId = setInterval(fetchIncidents, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [authHeaders]);

  return (
    <>
      {/* Burger mobile */}
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

      {/* Sidebar — desktop: fixe sous le header ; mobile: drawer */}
      <aside
        className={[
          "bg-gray-900 text-white z-[65] flex flex-col justify-between",
          "shadow-2xl transition-transform duration-300",
          // Desktop
          "hidden md:flex md:fixed md:top-16 md:left-0 md:h-[calc(100vh-64px)] md:w-64 md:p-4 md:pt-6",
          // Mobile (drawer)
          "fixed top-0 left-0 h-screen w-4/5 max-w-xs p-4 pt-6 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="flex-1">
          {/* Close button mobile */}
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

          <nav className="mt-2">
            {/* ↓↓↓ Espace réduit pour éviter que des liens partent “sous l’écran” */}
            <ul className="space-y-4">
              {/* Dashboard */}
              <li>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/dashboard") ? "text-blue-400" : "hover:text-blue-300"
                  }`}
                >
                  🏠 Tableau de bord
                </Link>
              </li>

              {/* ✅ INFOS (Santé & Propreté) — tes routes: /infos et /infos/nouveau */}
              <li className="border-t border-gray-700 pt-4">
                <Link
                  to="/infos"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/infos") && !isActive("/infos/nouveau")
                      ? "text-blue-400"
                      : "hover:text-blue-300"
                  }`}
                >
                  ℹ️ Liste des infos
                </Link>
              </li>
              <li>
                <Link
                  to="/infos/nouveau"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/infos/nouveau") ? "text-blue-400" : "hover:text-blue-300"
                  }`}
                >
                  ➕ Nouvelle info
                </Link>
              </li>

              {/* Incidents */}
              <li className="border-t border-gray-700 pt-4 relative">
                <Link
                  to="/incidents"
                  onClick={() => setOpen(false)}
                  className={[
                    "flex items-center gap-2 text-base font-medium transition",
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

              {/* Notifications */}
              <li className="border-t border-gray-700 pt-4">
                <Link
                  to="/notifications"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/notifications") && !isActive("/notifications/nouveau")
                      ? "text-blue-400"
                      : "hover:text-blue-300"
                  }`}
                >
                  🔔 Liste des notifications
                </Link>
              </li>
              <li>
                <Link
                  to="/notifications/nouveau"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/notifications/nouveau") ? "text-blue-400" : "hover:text-blue-300"
                  }`}
                >
                  ➕ Nouvelle notification
                </Link>
              </li>

              {/* Articles */}
              <li className="border-t border-gray-700 pt-4">
                <Link
                  to="/articles/liste"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/articles/liste") ? "text-blue-400" : "hover:text-blue-300"
                  }`}
                >
                  📋 Liste des articles
                </Link>
              </li>
              <li>
                <Link
                  to="/articles/nouveau"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/articles/nouveau") || (isActive("/articles") && !isActive("/articles/liste"))
                      ? "text-blue-400"
                      : "hover:text-blue-300"
                  }`}
                >
                  📝 Créer un article
                </Link>
              </li>

              {/* Projets */}
              <li className="border-t border-gray-700 pt-4">
                <Link
                  to="/projects/liste"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/projects/liste") ? "text-blue-400" : "hover:text-blue-300"
                  }`}
                >
                  📄 Liste des projets
                </Link>
              </li>
              <li>
                <Link
                  to="/projects/nouveau"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-base font-medium transition ${
                    isActive("/projects/nouveau") || (isActive("/projects") && !isActive("/projects/liste"))
                      ? "text-blue-400"
                      : "hover:text-blue-300"
                  }`}
                >
                  📁 Créer un projet
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Carte signature en bas */}
        <a
          href="https://www.facebook.com/mohamedsoighir.attoumani"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-4 block px-3 py-4 rounded-xl bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-inner border border-gray-700 text-center transition-all duration-300 hover:scale-105 hover:border-yellow-400 hover:shadow-lg"
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
