// src/pages/NotificationsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { NOTIFICATIONS_PATH } from "../config";

export default function NotificationsList() {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [period, setPeriod] = useState(""); // "", "7", "30"
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", message: "" });

  // Charge me : localStorage d'abord, sinon /api/me
  useEffect(() => {
    (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem("me") || "null");
        if (cached) {
          setMe(cached);
          return;
        }
        const res = await api.get("/api/me", { validateStatus: () => true });
        if (res.status === 200) {
          const user = res.data?.user || res.data || null;
          setMe(user);
          localStorage.setItem("me", JSON.stringify(user));
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          window.location.assign("/login");
        }
      } catch {
        // soft-fail
      }
    })();
  }, []);

  // 👉 Headers : on FORÇE Authorization + x-commune-id (admin)
  const requestHeaders = useMemo(() => {
    const h = {};
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;

    if (me?.role === "admin" && me?.communeId) {
      h["x-commune-id"] = String(me.communeId).toLowerCase().trim();
    }
    // superadmin : pas de x-commune-id → backend renvoie tout
    return h;
  }, [me?.role, me?.communeId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const params = period ? { period } : {};
      const res = await api.get(NOTIFICATIONS_PATH, {
        headers: requestHeaders, // IMPORTANT: contient Authorization
        params,
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.items)
          ? res.data.items
          : [];
        setItems(data);
      } else {
        console.warn("GET notifications non OK:", res.status, res.data);
        setItems([]);
      }
    } catch (e) {
      console.error("Erreur GET notifications:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, requestHeaders]);

  const myId = me?.id || me?._id || "";
  const canEditOrDelete = (notif) =>
    me?.role === "superadmin" || String(notif.authorId || "") === String(myId || "");

  const startEdit = (n) => {
    setEditId(n._id);
    setEditForm({ title: n.title || "", message: n.message || "" });
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ title: "", message: "" });
  };

  const saveEdit = async () => {
    try {
      const res = await api.patch(`${NOTIFICATIONS_PATH}/${editId}`, editForm, {
        headers: requestHeaders, // garde Authorization
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        cancelEdit();
        fetchAll();
      } else {
        throw new Error(res?.data?.message || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("Erreur PATCH notification:", e);
      alert(e?.message || "Erreur lors de l’enregistrement");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      const res = await api.delete(`${NOTIFICATIONS_PATH}/${id}`, {
        headers: requestHeaders, // garde Authorization
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        if (editId === id) cancelEdit();
        fetchAll();
      } else {
        throw new Error(res?.data?.message || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("Erreur DELETE notification:", e);
      alert(e?.message || "Erreur lors de la suppression");
    }
  };

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
          {items.map((n) => {
            const editable = canEditOrDelete(n);
            const editing = editId === n._id;
            return (
              <div key={n._id} className="bg-white border rounded p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">
                    {editing ? (
                      <input
                        className="w-full border rounded px-2 py-1"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="Titre"
                      />
                    ) : (
                      n.title
                    )}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                <div className="mb-3">
                  {editing ? (
                    <textarea
                      className="w-full border rounded px-2 py-1 min-h-[100px]"
                      value={editForm.message}
                      onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                      placeholder="Message"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{n.message}</p>
                  )}
                </div>

                {!editing && (
                  <div className="flex gap-2 text-xs mb-3">
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
                    {Array.isArray(n.audienceCommunes) && n.audienceCommunes.length > 0 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">
                        {n.audienceCommunes.join(", ")}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  {editing ? (
                    <>
                      <button onClick={cancelEdit} className="border rounded px-3 py-1">
                        Annuler
                      </button>
                      <button
                        onClick={saveEdit}
                        className="bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700"
                      >
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(n)}
                        disabled={!editable}
                        className={`px-3 py-1 rounded ${
                          editable
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                        title={editable ? "Modifier" : "Édition non autorisée"}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => remove(n._id)}
                        disabled={!editable}
                        className={`px-3 py-1 rounded ${
                          editable
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                        title={editable ? "Suppression" : "Suppression non autorisée"}
                      >
                        🗑️ Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
