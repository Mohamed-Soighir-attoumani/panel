// src/pages/NotificationsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

function buildHeaders(me) {
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (me?.role === "admin" && me?.communeId) headers["x-commune-id"] = me.communeId;
  if (me?.role === "superadmin") {
    const selectedCid = (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || "";
    if (selectedCid) headers["x-commune-id"] = selectedCid;
  }
  return headers;
}

export default function NotificationsList() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [list, setList] = useState([]);
  const [period, setPeriod] = useState(""); // "", "7", "30"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await axios.get(`${API_URL}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const user = res?.data?.user || null;
        setMe(user);
        localStorage.setItem("me", JSON.stringify(user));
      } catch {
        localStorage.removeItem("token");
        window.location.href = "/login";
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  const headers = useMemo(() => buildHeaders(me), [me]);

  const fetchData = async () => {
    if (loadingMe) return;
    setLoading(true);
    try {
      const params = {};
      if (period) params.period = period;
      const res = await axios.get(`${API_URL}/api/notifications`, { headers, params });
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Erreur notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, headers]); // refetch si période ou commune change

  const markAllRead = async () => {
    try {
      await axios.patch(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
      fetchData();
    } catch (e) {
      console.error("Erreur mark-all-read:", e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, { headers });
      fetchData();
    } catch (e) {
      console.error("Erreur suppression:", e);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">🔔 Notifications</h1>
        <div className="flex gap-2 items-center">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Toute période</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
          </select>
          <button
            onClick={markAllRead}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Marquer tout comme lu
          </button>
        </div>
      </div>

      {loading ? (
        <div>Chargement…</div>
      ) : list.length === 0 ? (
        <div className="text-gray-500">Aucune notification.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((n) => (
            <div key={n._id} className="bg-white p-4 rounded shadow border">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{n.title}</h3>
                {!n.isRead && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                    Non lue
                  </span>
                )}
              </div>
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">{n.message}</p>
              <p className="text-xs text-gray-400 mt-2">
                {n.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : "Date inconnue"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleDelete(n._id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
