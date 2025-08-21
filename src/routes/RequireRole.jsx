// src/routes/RequireRole.jsx
import React from "react";

/**
 * Affiche children uniquement si le rôle courant === role (ex: "superadmin").
 * Le rôle est lu depuis le JWT (token) puis fallback sur le cache "admin" du localStorage.
 */
function getRoleFromToken() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1] || ""));
    return payload?.role || null;
  } catch {
    return null;
  }
}

export default function RequireRole({ role, children }) {
  const jwtRole = getRoleFromToken();
  const cachedRole = (() => {
    try {
      const raw = localStorage.getItem("admin");
      return raw ? JSON.parse(raw).role : null;
    } catch {
      return null;
    }
  })();

  const effectiveRole = jwtRole || cachedRole;

  if (effectiveRole !== role) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
          <p className="text-gray-600">
            Cette page est réservée au <strong>{role}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
