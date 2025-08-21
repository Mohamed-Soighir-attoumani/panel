// src/pages/SuperadminAdmins.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL || "";

// Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const normalizeErr = (e, fallback = "Erreur inattendue") =>
  e?.response?.data?.message || e?.message || fallback;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperadminAdmins() {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const mountedRef = useRef(true);
  const cancelRef = useRef(null); // pour annuler les listes en rafale

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [admins, setAdmins] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [communeFilter, setCommuneFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");

  // tri/pagination
  const [sortKey, setSortKey] = useState("email");
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    communeId: "",
    communeName: "",
    photo: "",
  });
  const [creating, setCreating] = useState(false);

  // helper setState safe
  const safeSet = (setter) => (...args) => {
    if (!mountedRef.current) return;
    setter(...args);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Debounce du filtre (évite rafales d'appels)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(communeFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [communeFilter]);

  // Charger /api/me
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
        toast.error(normalizeErr(e, "Erreur /api/me"));
      } finally {
        safeSet(setLoadingMe)(false);
      }
    })();
  }, [token]);

  // Liste des admins
  const fetchAdmins = async (q = "") => {
    if (!API_URL || !token) return;

    // Annule la requête précédente si elle est en cours
    if (cancelRef.current) {
      cancelRef.current.abort();
    }
    const controller = new AbortController();
    cancelRef.current = controller;

    safeSet(setLoadingList)(true);
    try {
      const url = q
        ? `${API_URL}/api/admins?communeId=${encodeURIComponent(q)}`
        : `${API_URL}/api/admins`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        signal: controller.signal,
        validateStatus: (s) => s >= 200 && s < 500, // capter 4xx/5xx proprement
      });

      if (res.status >= 400) {
        throw new Error(res.data?.message || `Erreur API (${res.status})`);
      }

      safeSet(setAdmins)(Array.isArray(res.data?.admins) ? res.data.admins : []);
      // reset pagination si filtre change beaucoup
      safeSet(setPage)(1);
    } catch (e) {
      if (e.name === "CanceledError" || e.message === "canceled") return;
      toast.error(normalizeErr(e, "Erreur /api/admins"));
    } finally {
      safeSet(setLoadingList)(false);
    }
  };

  // Charge la liste si superadmin
  useEffect(() => {
    if (me?.role === "superadmin") {
      fetchAdmins(debouncedFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, debouncedFilter]);

  // Création d’un admin
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Email et mot de passe sont requis.");
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      toast.error("Email invalide.");
      return;
    }
    try {
      safeSet(setCreating)(true);
      const res = await axios.post(`${API_URL}/api/admins`, form, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (res.status >= 400) throw new Error(res.data?.message || "Création refusée");
      toast.success("Administrateur créé ✅");

      safeSet(setForm)({
        email: "",
        password: "",
        name: "",
        communeId: "",
        communeName: "",
        photo: "",
      });
      await sleep(150);
      fetchAdmins(debouncedFilter);
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur lors de la création"));
    } finally {
      safeSet(setCreating)(false);
    }
  };

  // Actions superadmin
  const handleDelete = async (id, role, email) => {
    if (me && (id === (me._id || me.id))) {
      toast.warn("Vous ne pouvez pas vous supprimer vous-même.");
      return;
    }
    if (String(role).toLowerCase() === "superadmin") {
      toast.warn("Suppression d’un superadmin interdite.");
      return;
    }
    if (!window.confirm(`Supprimer l’administrateur ${email || id} ?`)) return;

    try {
      const res = await axios.delete(`${API_URL}/api/admins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (res.status >= 400) throw new Error(res.data?.message || "Suppression refusée");
      toast.success("Administrateur supprimé ✅");
      await sleep(150);
      fetchAdmins(debouncedFilter);
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur suppression"));
    }
  };

  const handleReset = async (id) => {
    const np = window.prompt("Nouveau mot de passe ?");
    if (!np) return;
    try {
      const res = await axios.post(`${API_URL}/api/admins/${id}/reset-password`, { newPassword: np }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (res.status >= 400) throw new Error(res.data?.message || "Réinitialisation refusée");
      toast.success("Mot de passe réinitialisé ✅");
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur reset password"));
    }
  };

  const handleImpersonate = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/api/admins/${id}/impersonate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (res.status >= 400) throw new Error(res.data?.message || "Impersonation refusée");

      const impersonatedToken = res.data?.token;
      if (!impersonatedToken) throw new Error("Token d’impersonation manquant");

      localStorage.setItem("token_orig", token);
      localStorage.setItem("token", impersonatedToken);
      toast.success("Vous utilisez maintenant ce compte (impersonation).");
      setTimeout(() => window.location.assign("/dashboard"), 300);
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur d’impersonation"));
    }
  };

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ["email", "name", "role", "communeId", "communeName", "photo"],
      ...admins.map(a => [
        a.email || "",
        a.name || "",
        a.role || "",
        a.communeId || "",
        a.communeName || "",
        a.photo || "",
      ]),
    ];
    const csv = rows.map(r =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admins.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tri + pagination (client)
  const sorted = [...admins].sort((a, b) => {
    const va = String(a[sortKey] ?? "").toLowerCase();
    const vb = String(b[sortKey] ?? "").toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // --------- rendu ----------
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <ToastContainer />
      {loadingMe ? (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white shadow-md rounded-lg p-6 text-gray-600">Chargement…</div>
        </div>
      ) : !me ? (
        <div className="min-h-[60vh] flex items-center justify-center">
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
      ) : me.role !== "superadmin" ? (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
            <p className="text-gray-600">Cette page est réservée au <strong>superadmin</strong>.</p>
          </div>
        </div>
      ) : (
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
                {!EMAIL_RE.test(form.email || "") && form.email && (
                  <p className="text-xs text-red-500 mt-1">Format d'email invalide.</p>
                )}
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
                {form.password && form.password.length < 8 && (
                  <p className="text-xs text-amber-600 mt-1">8 caractères minimum recommandés.</p>
                )}
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

              {/* Champ username caché pour les password managers */}
              <input type="text" name="username" autoComplete="username" hidden readOnly />

              <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-2 items-center">
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-purple-600 text-white py-2 px-6 rounded hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {creating ? "Création…" : "Créer l’administrateur"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ email: "", password: "", name: "", communeId: "", communeName: "", photo: "" })}
                  className="py-2 px-4 rounded border border-gray-300 hover:bg-gray-50 transition"
                >
                  Réinitialiser le formulaire
                </button>
              </div>
            </form>
          </div>

          {/* Filtres + liste */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
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
                  onClick={() => fetchAdmins(debouncedFilter)}
                  className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 transition"
                >
                  Filtrer
                </button>
                <button
                  onClick={exportCSV}
                  className="py-2 px-4 rounded border border-gray-300 hover:bg-gray-50 transition"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {loadingList ? (
              <p className="text-gray-500">Chargement…</p>
            ) : admins.length === 0 ? (
              <p className="text-gray-500">Aucun administrateur trouvé.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          { k: "email", label: "Email" },
                          { k: "name", label: "Nom" },
                          { k: "role", label: "Rôle" },
                          { k: "communeId", label: "communeId" },
                          { k: "communeName", label: "communeName" },
                          { k: "photo", label: "Photo" },
                          { k: "_actions", label: "Actions" },
                        ].map((col) => (
                          <th
                            key={col.k}
                            className="text-left text-sm font-medium text-gray-600 px-4 py-2 border-b select-none"
                            onClick={() => col.k !== "_actions" && setSort(col.k)}
                            style={{ cursor: col.k !== "_actions" ? "pointer" : "default" }}
                            title={col.k !== "_actions" ? "Cliquer pour trier" : ""}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {col.k === sortKey && (
                                <span className="text-xs text-gray-400">
                                  {sortDir === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((a) => {
                        const id = a._id || a.id;
                        const isTargetSuper = String(a.role || "").toLowerCase() === "superadmin";
                        const isSelf = me && (id === (me._id || me.id));
                        return (
                          <tr key={id} className="hover:bg-gray-50">
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
                            <td className="px-4 py-2 border-b text-sm space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => handleReset(id)}
                                className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                                title="Réinitialiser le mot de passe"
                                disabled={isTargetSuper} // ne pas reset superadmin par défaut
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => handleImpersonate(id)}
                                className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                title="Se connecter en tant que"
                              >
                                Utiliser
                              </button>
                              <button
                                onClick={() => handleDelete(id, a.role, a.email)}
                                className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                title="Supprimer"
                                disabled={isTargetSuper || isSelf}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    {admins.length} administrateur(s) • Page {currentPage}/{totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                      disabled={currentPage <= 1}
                    >
                      « Préc.
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                      disabled={currentPage >= totalPages}
                    >
                      Suiv. »
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
