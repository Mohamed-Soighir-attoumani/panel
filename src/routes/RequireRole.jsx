// src/routes/RequireRole.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Navigate } from "react-router-dom";
import { API_URL } from "../config";

export default function RequireRole({ role = "admin", children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await axios.get(`${API_URL}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMe(res.data?.user || null);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Chargement…</div>;
  if (!me) return <Navigate to="/login" replace />;

  const rank = { user: 1, admin: 2, superadmin: 3 };
  if ((rank[me.role] || 0) < (rank[role] || 0)) {
    return <div className="p-6 text-red-600">Accès interdit.</div>;
  }

  return children;
}
