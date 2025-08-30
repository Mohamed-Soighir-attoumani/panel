// src/pages/NotificationsList.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [period, setPeriod] = useState(""); // "", "7", "30"
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", message: "" });

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("me") || "null");
      setMe(cached);
    } catch { setMe(null); }
  }, []);

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

  const canEditOrDelete = (notif) => {
    if (!me) return false;
    if (me.role === "superadmin") return true;
    const myId = me.id || me._id || "";
    return String(notif.authorId || "") === String(myId || "");
  };

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
      await axios.patch(`${API_URL}/api/notifications/${editId}`, editForm, { headers });
      cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur PATCH notification:", e);
      alert(e?.response?.data?.message || "Erreur lors de l’enregistrement");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, { headers });
      if (editId === id) cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur DELETE notification:", e);
      alert(e?.response?.data?.message || "Erreur lors de la suppression");
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
                        title={editable ? "Supprimer" : "Suppression non autorisée"}
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
