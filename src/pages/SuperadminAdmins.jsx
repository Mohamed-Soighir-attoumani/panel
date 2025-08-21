import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_URL = process.env.REACT_APP_API_URL || "";

export default function SuperadminAdmins() {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const mountedRef = useRef(true);

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [admins, setAdmins] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [communeFilter, setCommuneFilter] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    communeId: "",
    communeName: "",
    photo: "",
  });
  const [creating, setCreating] = useState(false);

  // Helper pour setState safe
  const safeSet = (setter) => (...args) => {
    if (!mountedRef.current) return;
    setter(...args);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ------------- charge /api/me pour connaître le rôle -------------
  useEffect(() => {
    (async () => {
      try {
        if (!API_URL) {
          toast.error("REACT_APP_API_URL manquant");
          safeSet(setLoadingMe)(false);
          return;
        }
        if (!token) {
          toast.error("Non connecté");
          window.location.href = "/login";
          return;
        }

        const res = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        safeSet(setMe)(res.data?.user || null);
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || "Erreur /api/me";
        toast.error(msg);
      } finally {
        safeSet(setLoadingMe)(false);
      }
    })();
  }, [token]);

  // ------------- liste des admins -------------
  const fetchAdmins = async (q = "") => {
    try {
      if (!API_URL || !token) return;
      safeSet(setLoadingList)(true);

      const url = q
        ? `${API_URL}/api/admins?communeId=${encodeURIComponent(q)}`
        : `${API_URL}/api/admins`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });
      safeSet(setAdmins)(res.data?.admins || []);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur /api/admins";
      toast.error(msg);
    } finally {
      safeSet(setLoadingList)(false);
    }
  };

  useEffect(() => {
    if (me?.role === "superadmin") {
      fetchAdmins("");
    }
  }, [me?.role]);

  // ------------- création d’un admin -------------
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Email et mot de passe sont requis.");
      return;
    }
    try {
      safeSet(setCreating)(true);
      await axios.post(`${API_URL}/api/admins`, form, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });
      toast.success("Administrateur créé ✅");
      safeSet(setForm)({
        email: "",
        password: "",
        name: "",
        communeId: "",
        communeName: "",
        photo: "",
      });
      fetchAdmins(communeFilter);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur lors de la création";
      toast.error(msg);
    } finally {
      safeSet(setCreating)(false);
    }
  };

  // ------------- actions superadmin -------------
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet administrateur ?")) return;
    try {
      await axios.delete(`${API_URL}/api/admins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });
      toast.success("Administrateur supprimé ✅");
      fetchAdmins(communeFilter);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur suppression";
      toast.error(msg);
    }
  };

  const handleReset = async (id) => {
    const np = window.prompt("Nouveau mot de passe ?");
    if (!np) return;
    try {
      await axios.post(`${API_URL}/api/admins/${id}/reset-password`, { newPassword: np }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });
      toast.success("Mot de passe réinitialisé ✅");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur reset password";
      toast.error(msg);
    }
  };

  const handleImpersonate = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/api/admins/${id}/impersonate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      });
      const impersonatedToken = res.data?.token;
      if (!impersonatedToken) throw new Error("Token impersonation manquant");
      // garder l’original
      localStorage.setItem("token_orig", token);
      localStorage.setItem("token", impersonatedToken);
      toast.success("Vous utilisez maintenant ce compte (impersonation).");
      setTimeout(() => window.location.assign("/dashboard"), 300);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur d’impersonation";
      toast.error(msg);
    }
  };

  // ------------- rendu -------------
  if (loadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Chargement…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Non connecté</h2>
          <p className="text-gray-600">Veuillez vous reconnecter.</p>
          <button
            className="mt-4 bg-blue-600 text-white py-2 px-4 rounded"
            onClick={() => (window.location.href = "/login")}
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    );
  }

  if (me.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Titre */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Gestion des administrateurs (communes)
          </h1>
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

            {/* Champ “username” caché pour password managers */}
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
                  {admins.map((a) => (
                    <tr key={a._id || a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b text-sm">{a.email}</td>
                      <td className="px-4 py-2 border-b text-sm">{a.name || "-"}</td>
                      <td className="px-4 py-2 border-b text-sm">{a.role}</td>
                      <td className="px-4 py-2 border-b text-sm">{a.communeId || "-"}</td>
                      <td className="px-4 py-2 border-b text-sm">{a.communeName || "-"}</td>
                      <td className="px-4 py-2 border-b text-sm">
                        {a.photo ? (
                          <img src={a.photo} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 border-b text-sm space-x-2">
                        <button
                          onClick={() => handleReset(a._id || a.id)}
                          className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                          title="Réinitialiser le mot de passe"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => handleImpersonate(a._id || a.id)}
                          className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          title="Se connecter en tant que"
                        >
                          Utiliser
                        </button>
                        <button
                          onClick={() => handleDelete(a._id || a.id)}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          title="Supprimer"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
