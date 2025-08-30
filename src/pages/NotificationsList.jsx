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

  // ⚙️ édition
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    message: "",
    visibility: "local", // local | global | custom (superadmin uniquement)
    communeId: "",
    audienceCommunes: "", // CSV
    priority: "normal",   // normal | pinned | urgent
    startAt: "",          // ISO (optionnel)
    endAt: "",            // ISO (optionnel)
  });

  // qui suis-je ?
  const [me] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("me") || "null");
    } catch {
      return null;
    }
  });

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

  // 🔐 qui peut éditer ?
  const canEdit = (n) => {
    if (me?.role === "superadmin") return true;
    if (me?.role === "admin") {
      return n?.visibility === "local" && n?.communeId && me?.communeId && n.communeId === me.communeId;
    }
    return false;
  };

  const startEdit = (n) => {
    setEditingId(n._id);
    setEditForm({
      title: n.title || "",
      message: n.message || "",
      visibility: n.visibility || "local",
      communeId: n.communeId || "",
      audienceCommunes: Array.isArray(n.audienceCommunes) ? n.audienceCommunes.join(",") : "",
      priority: n.priority || "normal",
      startAt: n.startAt ? new Date(n.startAt).toISOString().slice(0, 16) : "", // pour input type=datetime-local
      endAt: n.endAt ? new Date(n.endAt).toISOString().slice(0, 16) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: "",
      message: "",
      visibility: "local",
      communeId: "",
      audienceCommunes: "",
      priority: "normal",
      startAt: "",
      endAt: "",
    });
  };

  const saveEdit = async () => {
    try {
      const payload = {
        title: editForm.title,
        message: editForm.message,
        priority: editForm.priority,
      };

      // Dates optionnelles
      if (editForm.startAt) payload.startAt = new Date(editForm.startAt).toISOString();
      else payload.startAt = null;
      if (editForm.endAt) payload.endAt = new Date(editForm.endAt).toISOString();
      else payload.endAt = null;

      if (me?.role === "superadmin") {
        payload.visibility = editForm.visibility;
        if (editForm.visibility === "local") {
          payload.communeId = (editForm.communeId || "").trim();
          payload.audienceCommunes = [];
        } else if (editForm.visibility === "global") {
          payload.communeId = "";
          payload.audienceCommunes = [];
        } else if (editForm.visibility === "custom") {
          payload.communeId = "";
          payload.audienceCommunes = (editForm.audienceCommunes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      await axios.patch(`${API_URL}/api/notifications/${editingId}`, payload, { headers });
      cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur PATCH notification:", e);
      alert(e?.response?.data?.message || "Échec de la modification");
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, { headers });
      if (editingId === id) cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur DELETE notification:", e);
      alert(e?.response?.data?.message || "Échec de la suppression");
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
            const editable = canEdit(n);
            const isEditing = editingId === n._id;

            return (
              <div key={n._id} className="bg-white border rounded p-4 shadow-sm">
                {/* En-tête + date */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">
                    {isEditing ? (
                      <input
                        type="text"
                        className="border rounded px-2 py-1 w-full"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="Titre"
                      />
                    ) : (
                      n.title
                    )}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                {/* Message */}
                <div className="mb-3">
                  {isEditing ? (
                    <textarea
                      className="border rounded px-2 py-1 w-full"
                      rows={4}
                      value={editForm.message}
                      onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                      placeholder="Message"
                    />
                  ) : (
                    <p className="text-gray-700">{n.message}</p>
                  )}
                </div>

                {/* Champs avancés (édition) */}
                {isEditing && (
                  <div className="space-y-2 mb-3">
                    {/* priorité */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Priorité</label>
                      <select
                        className="border rounded px-2 py-1"
                        value={editForm.priority}
                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      >
                        <option value="normal">normal</option>
                        <option value="pinned">pinned</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>

                    {/* dates (optionnelles) */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Début</label>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={editForm.startAt}
                        onChange={(e) => setEditForm({ ...editForm, startAt: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Fin</label>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={editForm.endAt}
                        onChange={(e) => setEditForm({ ...editForm, endAt: e.target.value })}
                      />
                    </div>

                    {/* visibilité (superadmin uniquement) */}
                    {me?.role === "superadmin" && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-28">Visibilité</label>
                          <select
                            className="border rounded px-2 py-1"
                            value={editForm.visibility}
                            onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                          >
                            <option value="local">local</option>
                            <option value="global">global</option>
                            <option value="custom">custom</option>
                          </select>
                        </div>

                        {editForm.visibility === "local" && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-28">communeId</label>
                            <input
                              type="text"
                              className="border rounded px-2 py-1"
                              value={editForm.communeId}
                              onChange={(e) => setEditForm({ ...editForm, communeId: e.target.value })}
                              placeholder="ex: dembeni"
                            />
                          </div>
                        )}

                        {editForm.visibility === "custom" && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-28">Communes</label>
                            <input
                              type="text"
                              className="border rounded px-2 py-1 w-full"
                              value={editForm.audienceCommunes}
                              onChange={(e) =>
                                setEditForm({ ...editForm, audienceCommunes: e.target.value })
                              }
                              placeholder="cid1,cid2,cid3"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Badges visibilité (affichage) */}
                {!isEditing && (
                  <div className="flex flex-wrap gap-2 text-xs mb-3">
                    {n.visibility && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">{n.visibility}</span>
                    )}
                    {n.communeId && n.visibility === "local" && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">{n.communeId}</span>
                    )}
                    {Array.isArray(n.audienceCommunes) && n.audienceCommunes.length > 0 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">
                        {n.audienceCommunes.join(", ")}
                      </span>
                    )}
                    {n.priority && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">{n.priority}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                      >
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(n)}
                        disabled={!editable}
                        title={editable ? "Modifier" : "Édition non autorisée"}
                        className={`px-3 py-1 rounded ${
                          editable
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => deleteItem(n._id)}
                        disabled={!editable}
                        title={editable ? "Supprimer" : "Suppression non autorisée"}
                        className={`px-3 py-1 rounded ${
                          editable
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
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
