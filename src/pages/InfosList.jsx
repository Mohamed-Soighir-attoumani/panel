// src/pages/InfosList.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../config";

/* ------------------ helpers ------------------ */
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());
const arrayify = (v) =>
  Array.isArray(v)
    ? v
    : typeof v === "string"
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

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

/** Vrai si l'info globale est explicitement créée par un superadmin (selon champs possibles) */
const isGlobalFromSuperadmin = (it) => {
  const r1 = norm(it?.authorRole) === "superadmin";
  const r2 = it?.authorIsSuperAdmin === true || it?.createdBySuperadmin === true;
  const r3 = norm(it?.creatorRole) === "superadmin" || norm(it?.createdByRole) === "superadmin";
  return r1 || r2 || r3;
};

/** Vrai si l'élément est visible pour l'utilisateur courant */
const isVisibleForUser = (it, me) => {
  if (!me) return false;
  const meCid = norm(me.communeId);
  const vis = norm(it?.visibility || "local");

  if (me.role === "superadmin") return true;

  // admins : visibilité stricte
  if (vis === "local") {
    return norm(it?.communeId) === meCid;
  }
  if (vis === "custom") {
    const list = arrayify(it?.audienceCommunes).map(norm);
    return list.includes(meCid);
  }
  if (vis === "global") {
    // Ne montrer que si ça vient d'un superadmin
    return isGlobalFromSuperadmin(it);
  }
  // fallback: rien
  return false;
};

/** Un admin peut éditer/supprimer UNIQUEMENT ce qu'il a créé lui-même, et dans sa commune. */
const canEditOrDelete = (it, me) => {
  if (!me) return false;
  if (me.role === "superadmin") return true;

  if (me.role === "admin") {
    // Auteur : par id OU par email en fallback (selon ce que renvoie le backend)
    const isAuthorById = it?.authorId && String(it.authorId) === String(me.id);
    const isAuthorByEmail =
      it?.authorEmail &&
      me?.email &&
      norm(it.authorEmail) === norm(me.email);
    const isAuthor = !!(isAuthorById || isAuthorByEmail);
    if (!isAuthor) return false;

    // Hors de question de toucher aux globales
    const vis = norm(it?.visibility || "local");
    if (vis === "global") return false;

    // Et seulement si c'est bien dans le scope de sa commune
    if (vis === "local") return norm(it?.communeId) === norm(me.communeId);
    if (vis === "custom") {
      const list = arrayify(it?.audienceCommunes).map(norm);
      return list.includes(norm(me.communeId));
    }
  }
  return false;
};

export default function InfosList() {
  const [rawItems, setRawItems] = useState([]);
  const [period, setPeriod] = useState("");     // "", "7", "30"
  const [category, setCategory] = useState(""); // "", "sante", "proprete", "autres"
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    category: "sante",
    priority: "normal",
    startAt: "",
    endAt: "",
    visibility: "local",
    communeId: "",
    audienceCommunes: ""
  });

  const [me] = useState(() => {
    try { return JSON.parse(localStorage.getItem("me") || "null"); } catch { return null; }
  });

  // ⚠️ useMemo ne réagit pas automatiquement à localStorage ; suffisant ici.
  const headers = useMemo(buildHeaders, [
    localStorage.getItem("token"),
    localStorage.getItem("me"),
    localStorage.getItem("selectedCommuneId"),
  ]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (period) params.period = period;
      if (category) params.category = category;

      const res = await axios.get(`${API_URL}/api/infos`, { headers, params });
      const arr = Array.isArray(res.data) ? res.data : [];

      // tri desc par date si dispo
      arr.sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.startAt || 0).getTime();
        const tb = new Date(b?.createdAt || b?.startAt || 0).getTime();
        return tb - ta;
      });

      setRawItems(arr);
    } catch (e) {
      console.error("Erreur /api/infos:", e);
      setRawItems([]);
    } finally {
      setLoading(false);
    }
  }, [period, category, headers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Filtrage strict côté client (admin = sa commune, global si superadmin)
  const items = useMemo(() => {
    if (!me) return [];
    if (me.role === "superadmin") return rawItems;
    return rawItems.filter((it) => isVisibleForUser(it, me));
  }, [rawItems, me]);

  const startEdit = (it) => {
    if (!canEditOrDelete(it, me)) {
      return alert("Édition non autorisée pour cet élément.");
    }
    setEditingId(it._id);
    setEditForm({
      title: it.title || "",
      content: it.content || "",
      category: it.category || "sante",
      priority: it.priority || "normal",
      startAt: it.startAt ? new Date(it.startAt).toISOString().slice(0,16) : "",
      endAt:   it.endAt   ? new Date(it.endAt).toISOString().slice(0,16)   : "",
      visibility: it.visibility || "local",
      communeId: it.communeId || "",
      audienceCommunes: Array.isArray(it.audienceCommunes) ? it.audienceCommunes.join(",") : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: "", content: "", category: "sante",
      priority: "normal", startAt: "", endAt: "",
      visibility: "local", communeId: "", audienceCommunes: ""
    });
  };

  const saveEdit = async () => {
    try {
      const current = rawItems.find((x) => x._id === editingId);
      if (!current) throw new Error("Élément introuvable");
      if (!canEditOrDelete(current, me)) {
        return alert("Modification non autorisée.");
      }

      const payload = {
        title: editForm.title,
        content: editForm.content,
        category: editForm.category,
        priority: editForm.priority,
        startAt: editForm.startAt ? new Date(editForm.startAt).toISOString() : null,
        endAt:   editForm.endAt   ? new Date(editForm.endAt).toISOString()   : null,
      };

      // Seul le superadmin peut changer la portée
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
            .split(",").map((s) => s.trim()).filter(Boolean);
        }
      }

      await axios.patch(`${API_URL}/api/infos/${editingId}`, payload, { headers });
      cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur PATCH info:", e);
      alert(e?.response?.data?.message || "Échec de la modification");
    }
  };

  const deleteItem = async (id) => {
    const it = rawItems.find((x) => x._id === id);
    if (!it) return;

    if (!canEditOrDelete(it, me)) {
      return alert("Suppression non autorisée pour cet élément.");
    }
    if (!window.confirm("Supprimer cette information ?")) return;

    try {
      await axios.delete(`${API_URL}/api/infos/${id}`, { headers });
      if (editingId === id) cancelEdit();
      fetchAll();
    } catch (e) {
      console.error("Erreur DELETE info:", e);
      alert(e?.response?.data?.message || "Échec de la suppression");
    }
  };

  return (
    <div className="pt-[80px] px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">🩺 Santé & Propreté</h1>
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Toutes catégories</option>
            <option value="sante">Santé</option>
            <option value="proprete">Propreté</option>
            <option value="autres">Autres</option>
          </select>
          <select className="border rounded px-2 py-1" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="">Toute période</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
          </select>
          <button onClick={fetchAll} className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">
            Rafraîchir
          </button>
        </div>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Aucune information.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const editable = canEditOrDelete(it, me);
            const isEditing = editingId === it._id;

            return (
              <div key={it._id} className="bg-white border rounded p-4 shadow-sm">
                {/* header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      />
                    ) : (
                      it.title
                    )}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2">
                    {it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                {/* badges */}
                {!isEditing && (
                  <div className="flex flex-wrap gap-2 text-xs mb-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 border">{it.category}</span>
                    {it.visibility && <span className="rounded bg-gray-100 px-2 py-0.5 border">{it.visibility}</span>}
                    {it.communeId && it.visibility === "local" && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">{it.communeId}</span>
                    )}
                    {Array.isArray(it.audienceCommunes) && it.audienceCommunes.length > 0 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">
                        {it.audienceCommunes.join(", ")}
                      </span>
                    )}
                    {it.priority && <span className="rounded bg-gray-100 px-2 py-0.5 border">{it.priority}</span>}
                    {/* Affiche l'auteur pour transparence (si dispo) */}
                    {it.authorName && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 border">
                        par {it.authorName}{it.authorRole ? ` (${it.authorRole})` : ""}
                      </span>
                    )}
                  </div>
                )}

                {/* image */}
                {it.imageUrl && !isEditing && (
                  <div className="mb-3">
                    <img src={it.imageUrl} alt="" className="w-full h-40 object-cover rounded border" />
                  </div>
                )}

                {/* content */}
                <div className="mb-3">
                  {isEditing ? (
                    <textarea
                      className="border rounded px-2 py-1 w-full min-h-[120px]"
                      value={editForm.content}
                      onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{it.content}</p>
                  )}
                </div>

                {/* édition avancée */}
                {isEditing && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Catégorie</label>
                      <select
                        className="border rounded px-2 py-1"
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                      >
                        <option value="sante">sante</option>
                        <option value="proprete">proprete</option>
                        <option value="autres">autres</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Priorité</label>
                      <select
                        className="border rounded px-2 py-1"
                        value={editForm.priority}
                        onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                      >
                        <option value="normal">normal</option>
                        <option value="pinned">pinned</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Début</label>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={editForm.startAt}
                        onChange={e => setEditForm({ ...editForm, startAt: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-28">Fin</label>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={editForm.endAt}
                        onChange={e => setEditForm({ ...editForm, endAt: e.target.value })}
                      />
                    </div>

                    {me?.role === "superadmin" && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-28">Visibilité</label>
                          <select
                            className="border rounded px-2 py-1"
                            value={editForm.visibility}
                            onChange={e => setEditForm({ ...editForm, visibility: e.target.value })}
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
                              className="border rounded px-2 py-1"
                              value={editForm.communeId}
                              onChange={e => setEditForm({ ...editForm, communeId: e.target.value })}
                              placeholder="ex: dembeni"
                            />
                          </div>
                        )}

                        {editForm.visibility === "custom" && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-28">Communes</label>
                            <input
                              className="border rounded px-2 py-1 w-full"
                              value={editForm.audienceCommunes}
                              onChange={e => setEditForm({ ...editForm, audienceCommunes: e.target.value })}
                              placeholder="cid1,cid2,cid3"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* actions */}
                <div className="flex items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={cancelEdit} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
                        Annuler
                      </button>
                      <button onClick={saveEdit} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(it)}
                        disabled={!editable}
                        className={`px-3 py-1 rounded ${
                          editable ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                        title={editable ? "Modifier" : "Édition non autorisée"}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => deleteItem(it._id)}
                        disabled={!editable}
                        className={`px-3 py-1 rounded ${
                          editable ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                        title={editable ? "Suppression autorisée" : "Suppression non autorisée"}
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
