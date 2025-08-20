// src/pages/SuperadminAdmins.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

const API_URL = process.env.REACT_APP_API_URL;

const SuperadminAdmins = () => {
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

  const token = useMemo(() => localStorage.getItem("token") || "", []);

  // Fetch /api/me pour vérifier le rôle
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

  const fetchAdmins = async (q = "") => {
    if (!API_URL || !token) return;
    setLoadingList(true);
    try {
      const url = q ? `${API_URL}/api/admins?communeId=${encodeURIComponent(q)}` : `${API_URL}/api/admins`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // L’API renvoie {admins: [...]}
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!API_URL || !token) return;
    if (!form.email || !form.password) {
      toast.error("Email et mot de passe sont requis.");
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API_URL}/api/admins`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Administrateur créé ✅");
      // Reset form minimal
      setForm({
        email: "",
        password: "",
        name: "",
        communeId: "",
        communeName: "",
        photo: "",
      });
      // Refresh list en gardant le filtre courant
      fetchAdmins(communeFilter);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
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
          <p className="text-gray-600">Cette page est réservée au <strong>superadmin</strong>.</p>
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

            {/* username hidden pour l’accessibilité des password managers */}
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
};

export default SuperadminAdmins;
