// src/pages/SuperadminAdmins.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL;

const SuperadminAdmins = () => {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [admins, setAdmins] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [communeFilter, setCommuneFilter] = useState("");

  // Form création
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    communeId: "",
    communeName: "",
    photo: "",
  });
  const [creating, setCreating] = useState(false);

  // Edition inline
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({
    name: "",
    communeId: "",
    communeName: "",
    photo: "",
    role: "admin",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset password
  const [pwdId, setPwdId] = useState(null);
  const [pwdNew, setPwdNew] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

  const token = useMemo(() => localStorage.getItem("token") || "", []);

  // ===================== Me (rôle) =====================
  useEffect(() => {
    if (!API_URL) {
      toast.error("REACT_APP_API_URL manquant");
      return;
    }
    if (!token) {
      toast.error("Non connecté");
      window.location.href = "/login";
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMe(res.data.user);
      } catch (e) {
        toast.error(e?.response?.data?.message || "Erreur /api/me");
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [token]);

  // ===================== List =====================
  const fetchAdmins = async (q = "") => {
    if (!API_URL || !token) return;
    setLoadingList(true);
    try {
      const url = q ? `${API_URL}/api/admins?communeId=${encodeURIComponent(q)}` : `${API_URL}/api/admins`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setAdmins(res.data.admins || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur /api/admins");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (me?.role === "superadmin") {
      fetchAdmins("");
    }
  }, [me?.role]);

  // ===================== Create =====================
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!API_URL || !token) return;
    if (!form.email || !form.password) {
      toast.error("Email et mot de passe sont requis.");
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API_URL}/api/admins`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Administrateur créé ✅");
      setForm({
        email: "",
        password: "",
        name: "",
        communeId: "",
        communeName: "",
        photo: "",
      });
      fetchAdmins(communeFilter);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // ===================== Edit (inline) =====================
  const startEdit = (a) => {
    setEditingId(a._id || a.id);
    setEditBuffer({
      name: a.name || "",
      communeId: a.communeId || "",
      communeName: a.communeName || "",
      photo: a.photo || "",
      role: a.role || "admin",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBuffer({
      name: "",
      communeId: "",
      communeName: "",
      photo: "",
      role: "admin",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await axios.patch(`${API_URL}/api/admins/${editingId}`, editBuffer, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Administrateur mis à jour ✅");
      cancelEdit();
      fetchAdmins(communeFilter);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur lors de la mise à jour");
    } finally {
      setSavingEdit(false);
    }
  };

  // ===================== Reset password =====================
  const openResetPwd = (id) => {
    setPwdId(id);
    setPwdNew("");
  };
  const cancelResetPwd = () => {
    setPwdId(null);
    setPwdNew("");
  };
  const doResetPwd = async () => {
    if (!pwdId || !pwdNew) {
      toast.error("Nouveau mot de passe requis");
      return;
    }
    setResettingPwd(true);
    try {
      await axios.patch(
        `${API_URL}/api/admins/${pwdId}/password`,
        { password: pwdNew },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Mot de passe réinitialisé ✅");
      cancelResetPwd();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur reset mot de passe");
    } finally {
      setResettingPwd(false);
    }
  };

  // ===================== Delete =====================
  const deleteAdmin = async (id, email) => {
    if (!window.confirm(`Supprimer l'administrateur ${email || id} ?`)) return;
    try {
      await axios.delete(`${API_URL}/api/admins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Administrateur supprimé ✅");
      fetchAdmins(communeFilter);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur lors de la suppression");
    }
  };

  if (loadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        <ToastContainer />
        Chargement…
      </div>
    );
  }

  if (!me || me.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <ToastContainer />
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
          <p className="text-gray-600">
            Cette page est réservée au <strong>superadmin</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <ToastContainer />
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Titre */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Gestion des administrateurs (communes)</h1>
        </div>

        {/* Formulaire de création */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Créer un administrateur</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mot de passe *</label>
              <input
                type="password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Admin Dembeni"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">communeId</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.communeId}
                onChange={(e) => setForm({ ...form, communeId: e.target.value })}
                placeholder="Ex: dembeni"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">communeName</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.communeName}
                onChange={(e) => setForm({ ...form, communeName: e.target.value })}
                placeholder="Ex: Dembeni"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Photo (URL)</label>
              <input
                type="url"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={form.photo}
                onChange={(e) => setForm({ ...form, photo: e.target.value })}
                placeholder="/uploads/avatars/xxx.jpg"
                autoComplete="photo"
              />
            </div>
            {/* username hidden pour l’accessibilité */}
            <input type="text" name="username" autoComplete="username" hidden readOnly />
            <div className="md:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={creating}
                className="w-full md:w-auto bg-purple-600 text-white py-2 px-6 rounded hover:bg-purple-700 transition"
              >
                {creating ? "Création…" : "Créer l’administrateur"}
              </button>
            </div>
          </form>
        </div>

        {/* Filtres + liste */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Liste des administrateurs</h2>
            <div className="flex gap-2">
              <input
                type="text"
                className="w-full sm:w-64 border border-gray-300 rounded px-3 py-2"
                value={communeFilter}
                onChange={(e) => setCommuneFilter(e.target.value)}
                placeholder="Filtrer par communeId (ex: dembeni)"
              />
              <button
                onClick={() => fetchAdmins(communeFilter)}
                className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 transition"
              >
                Filtrer
              </button>
            </div>
          </div>

          {loadingList ? (
            <p className="text-gray-500">Chargement…</p>
          ) : admins.length === 0 ? (
            <p className="text-gray-500">Aucun administrateur trouvé.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">Email</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">Nom</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">Rôle</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">communeId</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">communeName</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">Photo</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const id = a._id || a.id;
                    const isEditing = editingId === id;

                    return (
                      <tr key={id} className="hover:bg-gray-50 align-top">
                        {/* Email */}
                        <td className="px-4 py-2 border-b text-sm">{a.email}</td>

                        {/* Nom */}
                        <td className="px-4 py-2 border-b text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded px-2 py-1"
                              value={editBuffer.name}
                              onChange={(e) => setEditBuffer({ ...editBuffer, name: e.target.value })}
                            />
                          ) : (
                            a.name || "—"
                          )}
                        </td>

                        {/* Rôle */}
                        <td className="px-4 py-2 border-b text-sm">
                          {isEditing ? (
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1"
                              value={editBuffer.role}
                              onChange={(e) => setEditBuffer({ ...editBuffer, role: e.target.value })}
                            >
                              <option value="admin">admin</option>
                              <option value="superadmin">superadmin</option>
                            </select>
                          ) : (
                            a.role
                          )}
                        </td>

                        {/* communeId */}
                        <td className="px-4 py-2 border-b text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded px-2 py-1"
                              value={editBuffer.communeId}
                              onChange={(e) => setEditBuffer({ ...editBuffer, communeId: e.target.value })}
                            />
                          ) : (
                            a.communeId || "—"
                          )}
                        </td>

                        {/* communeName */}
                        <td className="px-4 py-2 border-b text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded px-2 py-1"
                              value={editBuffer.communeName}
                              onChange={(e) => setEditBuffer({ ...editBuffer, communeName: e.target.value })}
                            />
                          ) : (
                            a.communeName || "—"
                          )}
                        </td>

                        {/* Photo */}
                        <td className="px-4 py-2 border-b text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded px-2 py-1"
                              placeholder="/uploads/avatars/xxx.jpg"
                              value={editBuffer.photo}
                              onChange={(e) => setEditBuffer({ ...editBuffer, photo: e.target.value })}
                            />
                          ) : a.photo ? (
                            <img src={a.photo} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2 border-b text-sm">
                          {!isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => startEdit(a)}
                                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Éditer
                              </button>
                              <button
                                onClick={() => openResetPwd(id)}
                                className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                              >
                                Réinit. MDP
                              </button>
                              <button
                                onClick={() => deleteAdmin(id, a.email)}
                                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                              >
                                Supprimer
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={savingEdit}
                                className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {savingEdit ? "Enregistrement…" : "Enregistrer"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
                              >
                                Annuler
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modale simple de reset mot de passe (sans changer ton CSS global) */}
        {pwdId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Réinitialiser le mot de passe</h3>
              <label className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
              <input
                type="password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                autoComplete="new-password"
              />
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={cancelResetPwd}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={doResetPwd}
                  disabled={resettingPwd}
                  className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {resettingPwd ? "Validation…" : "Valider"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SuperadminAdmins;
