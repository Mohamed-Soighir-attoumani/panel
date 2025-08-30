import React, { useEffect, useState } from "react";

/**
 * Affiche les enfants si le rôle de l'utilisateur suffit.
 * On lit `me` depuis localStorage (déjà mis à jour par /api/me sur les pages).
 * Rangs : user=1, admin=2, superadmin=3
 */
const RANK = { user: 1, admin: 2, superadmin: 3 };

const RequireRole = ({ role = "admin", children }) => {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("me");
      setMe(raw ? JSON.parse(raw) : null);
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div className="p-6 text-gray-600">
        Chargement…
      </div>
    );
  }

  const required = RANK[role] ?? RANK.admin;
  const have = RANK[me?.role] ?? 0;

  if (have >= required) {
    return children;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
        <p className="text-gray-600">
          Cette page est réservée aux utilisateurs avec le rôle&nbsp;
          <strong>{role}</strong>.
        </p>
      </div>
    </div>
  );
};

export default RequireRole;
