// src/pages/NotificationsList.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { API_URL } from "../config";

function buildHeaders() {
  const token = localStorage.getItem("token") || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    if (me?.role === "admin" && me?.communeId) headers["x-commune-id"] = me.communeId;
    if (me?.role === "superadmin") {
      const cid = localStorage.getItem("selectedCommuneId") || "";
      if (cid) headers["x-commune-id"] = cid;
    }
  } catch {}
  return headers;
}

export default function NotificationsList() {
  const [items, setItems] = useState([]);
  const [period, setPeriod] = useState(""); // "", "7", "30"
  const [loading, setLoading] = useState(true);
  const headers = useMemo(buildHeaders, [
    localStorage.getItem("token"),
    localStorage.getItem("me"),
    localStorage.getItem("selectedCommuneId"),
  ]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers,
        params: period ? { period } : {},
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Erreur /api/notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [period, headers]);

  return (
    <div className="pt-[80px] px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">🔔 Notifications</h1>
        <div className="flex gap-2">
          <select
            className="border rounded px-2 py-1"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">Toute période</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
          </select>
          <button
            onClick={fetchAll}
            className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Aucune notification.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((n) => (
            <div key={n._id} className="bg-white border rounded p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">{n.title}</h3>
                <span className="text-xs text-gray-500">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <p className="text-gray-700 mb-2">{n.message}</p>

              {/* badges visibilité (compat: anciens docs sans champs ajoutés) */}
              <div className="flex gap-2 text-xs">
                {n.visibility && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 border">
                    {n.visibility}
                  </span>
                )}
                {n.communeId && n.visibility === "local" && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 border">
                    {n.communeId}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
