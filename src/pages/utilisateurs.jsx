// src/pages/utilisateurs.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Check,
  X as XIcon,
  RotateCcw,
  BadgeCheck,
  FileText,
  ShieldBan,
  ShieldCheck,
  Wallet,
  CreditCard,
  Search,
  Filter,
  PlusCircle,
  Loader2,
  Save,
  XCircle,
  RefreshCw,
} from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "";

/* ----------------- Helpers ------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizeErr = (e, fallback = "Erreur inattendue") =>
  e?.response?.data?.message || e?.message || fallback;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (v) => (v || "").toString().trim().toLowerCase();

const PAGE_SIZE = 15;

/** Extraction d'ObjectId vers string (gère $oid, objets, etc.) */
const objIdToString = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (v.$oid) return v.$oid;
    if (typeof v.toHexString === "function") return v.toHexString();
    if (typeof v.toString === "function") {
      const s = v.toString();
      const m = s.match(/[a-f0-9]{24}/i);
      if (m) return m[0];
      return s;
    }
  }
  return "";
};

/** ID canonique, priorité à _idString renvoyé par l'API */
const getId = (u) =>
  (u && (u._idString || objIdToString(u._id) || u.id || u.userId || u.email || "")).toString();

/* Small pill */
const Pill = ({ ok, children, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
      ok
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-gray-100 text-gray-600 border-gray-200"
    }`}
  >
    {ok ? <Check size={12} /> : <XIcon size={12} />} {children}
  </span>
);

/* ----------------- Page ------------------ */
export default function Utilisateurs() {
  // ⚠️ On affiche ici UNIQUEMENT les administrateurs (rôle "admin")
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const mountedRef = useRef(true);
  const listAbort = useRef(null);

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // listing
  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // active|inactive
  const [subFilter, setSubFilter] = useState(""); // active|expired|none
  const [page, setPage] = useState(1);
  const [serverHasMore, setServerHasMore] = useState(false);

  // per-row busy state
  const [rowBusyId, setRowBusyId] = useState(null);
  const [rowBusyAction, setRowBusyAction] = useState("");

  // plans / modals
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  const [subUser, setSubUser] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [subPayload, setSubPayload] = useState({
    planId: "",
    periodMonths: 1,
    method: "card",
  });
  const [doingAction, setDoingAction] = useState(false);

  const [invUser, setInvUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    communeId: "",
    communeName: "",
  });

  // lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = (setter) => (...args) => {
    if (!mountedRef.current) return;
    setter(...args);
  };

  // debounce q
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // load me
  useEffect(() => {
    (async () => {
      try {
        if (!API_URL) {
          toast.error("REACT_APP_API_URL manquant");
          setLoadingMe(false);
          return;
        }
        if (!token) {
          toast.error("Non connecté");
          window.location.href = "/login";
          return;
        }
        const r = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        safeSet(setMe)(r.data?.user || null);
      } catch (e) {
        toast.error(normalizeErr(e, "Erreur /api/me"));
        localStorage.removeItem("token");
        setTimeout(() => (window.location.href = "/login"), 600);
      } finally {
        safeSet(setLoadingMe)(false);
      }
    })();
  }, [token]);

  // load plans (best effort)
  const loadPlans = useCallback(async () => {
    if (!API_URL || !token) return;
    try {
      setLoadingPlans(true);
      const r = await axios.get(`${API_URL}/api/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status >= 400)
        throw new Error(r.data?.message || "Plans indisponibles");
      safeSet(setPlans)(Array.isArray(r.data?.plans) ? r.data.plans : []);
    } catch {
      // fallback plans si l'API n'existe pas encore
      safeSet(setPlans)([
        { id: "basic", name: "Basic", price: 9.9, currency: "EUR", period: "mois" },
        { id: "pro", name: "Pro", price: 19.9, currency: "EUR", period: "mois" },
        { id: "premium", name: "Premium", price: 39.9, currency: "EUR", period: "mois" },
      ]);
    } finally {
      setLoadingPlans(false);
    }
  }, [token]);

  // --------- FETCH LISTE DES ADMINS ----------
  const fetchAdmins = useCallback(async (opts = {}) => {
    if (!API_URL || !token) return;

    const currentPage = opts.page || page;

    // cancel previous
    if (listAbort.current) listAbort.current.abort();
    const controller = new AbortController();
    listAbort.current = controller;

    setLoadingList(true);
    try {
      const params = {
        q: debouncedQ || undefined,
        communeId: communeId || undefined,
        status: statusFilter || undefined,
        sub: subFilter || undefined,
        role: "admin", // on force côté API
        page: currentPage,
        pageSize: PAGE_SIZE,
      };

      let list = [];
      let hasMore = false;

      // 1) route dédiée si dispo
      const r1 = await axios.get(`${API_URL}/api/admins`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 20000,
        signal: controller.signal,
        validateStatus: (s) => s >= 200 && s < 500,
      });

      if (r1.status >= 200 && r1.status < 300) {
        const items =
          Array.isArray(r1.data?.items)
            ? r1.data.items
            : Array.isArray(r1.data?.admins)
            ? r1.data.admins
            : Array.isArray(r1.data)
            ? r1.data
            : [];

        // ✅ normalise l'ID pour le front
        list = items.map((u) => ({
          ...u,
          _idString: u._idString || objIdToString(u._id),
        }));
        const total = Number(r1.data?.total || 0);
        hasMore = total ? currentPage * PAGE_SIZE < total : items.length === PAGE_SIZE;
      } else {
        // 2) fallback -> /api/users
        const r2 = await axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
          timeout: 20000,
          signal: controller.signal,
          validateStatus: (s) => s >= 200 && s < 500,
        });
        if (r2.status >= 400)
          throw new Error(r2.data?.message || `Erreur API (${r2.status})`);
        const items =
          Array.isArray(r2.data?.items)
            ? r2.data.items
            : Array.isArray(r2.data?.users)
            ? r2.data.users
            : Array.isArray(r2.data)
            ? r2.data
            : [];

        list = items.map((u) => ({
          ...u,
          _idString: u._idString || objIdToString(u._id),
        }));
        const total = Number(r2.data?.total || 0);
        hasMore = total ? currentPage * PAGE_SIZE < total : items.length === PAGE_SIZE;
      }

      // garde-fou client : conserve uniquement role=admin
      list = list.filter((u) => norm(u.role) === "admin");

      safeSet(setUsers)(list);
      safeSet(setServerHasMore)(hasMore);
    } catch (e) {
      if (e.name === "CanceledError" || e.message === "canceled") return;
      toast.error(normalizeErr(e, "Erreur chargement administrateurs"));
      safeSet(setUsers)([]);
      safeSet(setServerHasMore)(false);
    } finally {
      setLoadingList(false);
    }
  }, [API_URL, token, debouncedQ, communeId, statusFilter, subFilter, page]);

  // auto refresh when filters change
  useEffect(() => {
    if (!loadingMe && me) {
      setPage(1);
      fetchAdmins({ page: 1 });
      loadPlans();
    }
  }, [loadingMe, me, debouncedQ, communeId, statusFilter, subFilter, fetchAdmins, loadPlans]);

  // communes list (à partir des admins filtrés)
  const communes = useMemo(() => {
    const set = new Map();
    for (const u of users) {
      const id = (u.communeId || "").trim();
      const name = (u.communeName || "").trim();
      if (id) set.set(id, name || id);
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

  // derived
  const total = users.length;

  /* ----------------- Actions ------------------ */

  const exportCSV = () => {
    const rows = [
      ["email", "name", "role", "communeId", "communeName", "isActive", "subStatus", "subEndAt"],
      ...users.map((u) => [
        u.email || "",
        u.name || "",
        u.role || "",
        u.communeId || "",
        u.communeName || "",
        u.isActive === false ? "inactive" : "active",
        u.subscriptionStatus || "",
        u.subscriptionEndAt || "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "administrateurs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (u) => {
    setEditUser({ ...u });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    if (editUser.email && !EMAIL_RE.test(editUser.email)) {
      toast.error("Email invalide");
      return;
    }
    try {
      setDoingAction(true);
      const id = getId(editUser);
      const payload = { ...editUser, role: "admin" }; // éviter de sortir de la liste
      const r = await axios.put(`${API_URL}/api/users/${encodeURIComponent(id)}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status >= 400)
        throw new Error(r.data?.message || "Échec de la mise à jour");
      toast.success("Administrateur mis à jour ✅");
      setShowEdit(false);
      await sleep(150);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur mise à jour"));
    } finally {
      setDoingAction(false);
    }
  };

  const toggleActive = async (u) => {
    const id = getId(u);
    try {
      setRowBusyId(id);
      setRowBusyAction("toggle");
      const next = !(u.isActive !== false);
      const r = await axios.post(
        `${API_URL}/api/users/${encodeURIComponent(id)}/toggle-active`,
        { active: next },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
          validateStatus: (s) => s >= 200 && s < 500,
        }
      );
      if (r.status >= 400)
        throw new Error(r.data?.message || "Échec activation");
      toast.success(next ? "Compte activé" : "Compte désactivé");
      await sleep(120);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur activation"));
    } finally {
      setRowBusyId(null);
      setRowBusyAction("");
    }
  };

  const openSub = (u) => {
    setSubUser(u);
    setSubPayload({
      planId: plans[0]?.id || "",
      periodMonths: 1,
      method: "card",
    });
    setShowSub(true);
  };

  const startOrRenew = async (mode = "start") => {
    if (!subUser) return;
    if (!subPayload.planId) {
      toast.error("Choisis un plan avant de continuer.");
      return;
    }
    const endpoint = mode === "renew" ? "renew" : "start";
    const id = getId(subUser);
    try {
      setDoingAction(true);
      setRowBusyId(id);
      setRowBusyAction(`sub-${endpoint}`);
      const r = await axios.post(
        `${API_URL}/api/subscriptions/${encodeURIComponent(id)}/${endpoint}`,
        subPayload,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
          validateStatus: (s) => s >= 200 && s < 500,
        }
      );
      if (r.status >= 400)
        throw new Error(r.data?.message || `Échec ${mode}`);
      toast.success(
        mode === "renew" ? "Abonnement renouvelé ✅" : "Abonnement démarré ✅"
      );
      setShowSub(false);
      await sleep(150);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, `Erreur ${mode}`));
    } finally {
      setDoingAction(false);
      setRowBusyId(null);
      setRowBusyAction("");
    }
  };

  const cancelSub = async () => {
    if (!subUser) return;
    const id = getId(subUser);
    try {
      setDoingAction(true);
      setRowBusyId(id);
      setRowBusyAction("sub-cancel");
      const r = await axios.post(
        `${API_URL}/api/subscriptions/${encodeURIComponent(id)}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
          validateStatus: (s) => s >= 200 && s < 500,
        }
      );
      if (r.status >= 400)
        throw new Error(r.data?.message || "Échec annulation");
      toast.success("Abonnement annulé ✅");
      setShowSub(false);
      await sleep(150);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur annulation"));
    } finally {
      setDoingAction(false);
      setRowBusyId(null);
      setRowBusyAction("");
    }
  };

  const openInvoices = async (u) => {
    const id = getId(u);
    setInvUser(u);
    setShowInvoices(true);
    setLoadingInvoices(true);
    try {
      const r = await axios.get(`${API_URL}/api/users/${encodeURIComponent(id)}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status >= 400)
        throw new Error(r.data?.message || "Factures indisponibles");
      const arr = Array.isArray(r.data?.invoices) ? r.data.invoices : [];
      setInvoices(arr);
    } catch (e) {
      toast.error(
        normalizeErr(
          e,
          "Erreur factures (vérifie que la route /api/users/:id/invoices existe)"
        )
      );
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) {
      toast.error("Email & mot de passe requis");
      return;
    }
    if (!EMAIL_RE.test(createForm.email)) {
      toast.error("Email invalide");
      return;
    }
    try {
      setCreating(true);
      const payload = {
        ...createForm,
        role: "admin",
        createdBy: me?._id || me?.id,
      };
      const r = await axios.post(`${API_URL}/api/users`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status >= 400)
        throw new Error(r.data?.message || "Création refusée");
      toast.success("Administrateur créé ✅");
      setCreateForm({
        email: "",
        password: "",
        name: "",
        communeId: "",
        communeName: "",
      });
      await sleep(120);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur création"));
    } finally {
      setCreating(false);
    }
  };

  /* ----------------- UI ------------------ */

  if (loadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-600 flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Chargement…
        </div>
      </div>
    );
  }

  if (!me || norm(me.role) !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-700">
          Accès restreint : réservé au <strong>superadmin</strong>.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Administrateurs (créés par le superadmin)
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"
            >
              <FileText size={16} /> Export CSV
            </button>
            <button
              onClick={() => fetchAdmins({ page })}
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"
              title="Rafraîchir"
            >
              <RefreshCw size={16} /> Rafraîchir
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-600">Recherche</label>
                <div className="relative">
                  <input
                    className="w-full border rounded px-3 py-2 pr-8"
                    placeholder="email, nom…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPage(1);
                        fetchAdmins({ page: 1 });
                      }
                    }}
                  />
                  <Search
                    className="absolute right-2 top-2.5 text-gray-400"
                    size={16}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Commune</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={communeId}
                  onChange={(e) => {
                    setCommuneId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Toutes</option>
                  {communes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rôle verrouillé à Admin */}
              <div>
                <label className="text-xs text-gray-600">Rôle</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500"
                  value="Admin (filtre imposé)"
                  disabled
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Statut</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">—</option>
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Abonnement</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={subFilter}
                    onChange={(e) => {
                      setSubFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">—</option>
                    <option value="active">Actif</option>
                    <option value="expired">Expiré</option>
                    <option value="none">Aucun</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setPage(1);
                fetchAdmins({ page: 1 });
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded flex items-center gap-2"
            >
              <Filter size={16} /> Filtrer
            </button>
          </div>
        </div>

        {/* Création rapide d’un administrateur */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Créer un administrateur
          </h2>
          <form
            onSubmit={createUser}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
          >
            <input
              className="border rounded px-3 py-2"
              placeholder="Email *"
              type="email"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              required
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Mot de passe *"
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm({ ...createForm, password: e.target.value })
              }
              required
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Nom"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="communeId"
              value={createForm.communeId}
              onChange={(e) =>
                setCreateForm({ ...createForm, communeId: e.target.value })
              }
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="communeName"
              value={createForm.communeName}
              onChange={(e) =>
                setCreateForm({ ...createForm, communeName: e.target.value })
              }
            />
            {/* rôle figé à admin */}
            <input
              className="border rounded px-3 py-2 bg-gray-50 text-gray-500"
              value="admin"
              disabled
            />

            <div className="lg:col-span-6">
              <button
                disabled={creating}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
              >
                <PlusCircle size={16} />
                {creating ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        </div>

        {/* Liste */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">
              Administrateurs
            </h2>
            <div className="text-sm text-gray-500">{total} administrateur(s)</div>
          </div>

          {loadingList ? (
            <div className="text-gray-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Chargement…
            </div>
          ) : users.length === 0 ? (
            <div className="text-gray-500">
              Aucun administrateur trouvé. Ajuste les filtres ou crée un compte.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Email",
                        "Nom",
                        "Commune",
                        "Statut",
                        "Abonnement",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const id = getId(u);
                      const commune = u.communeName || u.communeId || "—";
                      const active = !(u.isActive === false);
                      const subStatus =
                        u.subscriptionStatus ||
                        (u.subscriptionEndAt ? "active" : "none");
                      const subEnd = u.subscriptionEndAt
                        ? new Date(u.subscriptionEndAt).toLocaleDateString()
                        : null;

                      const isRowBusy = rowBusyId === id;

                      return (
                        <tr key={id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border-b text-sm">{u.email}</td>
                          <td className="px-4 py-2 border-b text-sm">
                            {u.name || "—"}
                          </td>
                          <td className="px-4 py-2 border-b text-sm">{commune}</td>
                          <td className="px-4 py-2 border-b text-sm">
                            <div className="flex items-center gap-2">
                              <Pill ok={active}>
                                {active ? "Actif" : "Inactif"}
                              </Pill>
                              {isRowBusy && rowBusyAction === "toggle" && (
                                <Loader2 className="animate-spin text-gray-400" size={14} />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 border-b text-sm">
                            <div className="flex items-center gap-2">
                              <Pill
                                ok={subStatus === "active"}
                                title={subEnd ? `Jusqu'au ${subEnd}` : ""}
                              >
                                {subStatus === "active"
                                  ? "Actif"
                                  : subStatus === "expired"
                                  ? "Expiré"
                                  : "Aucun"}
                              </Pill>
                              {subEnd && (
                                <span className="text-xs text-gray-500">
                                  ({subEnd})
                                </span>
                              )}
                              {isRowBusy &&
                                rowBusyAction.startsWith("sub-") && (
                                  <Loader2 className="animate-spin text-gray-400" size={14} />
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-2 border-b text-sm">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                                onClick={() => openEdit(u)}
                                title="Éditer infos"
                                disabled={isRowBusy}
                              >
                                Éditer
                              </button>

                              <button
                                className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
                                onClick={() => toggleActive(u)}
                                title="Activer/Désactiver"
                                disabled={isRowBusy}
                              >
                                {active ? (
                                  <>
                                    <ShieldBan size={14} /> Désactiver
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck size={14} /> Activer
                                  </>
                                )}
                              </button>

                              <button
                                className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
                                onClick={() => openSub(u)}
                                title="Gérer l'abonnement"
                                disabled={isRowBusy}
                              >
                                <Wallet size={14} /> Abonnement
                              </button>

                              <button
                                className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
                                onClick={() => openInvoices(u)}
                                title="Factures"
                                disabled={isRowBusy}
                              >
                                <CreditCard size={14} /> Factures
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination simple */}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Page {page} • {users.length} élément(s)
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 border rounded disabled:opacity-50"
                    disabled={page <= 1 || loadingList}
                    onClick={() => {
                      const p = Math.max(1, page - 1);
                      setPage(p);
                      fetchAdmins({ page: p });
                    }}
                  >
                    ◀ Précédent
                  </button>
                  <button
                    className="px-3 py-1.5 border rounded disabled:opacity-50"
                    disabled={!serverHasMore || loadingList}
                    onClick={() => {
                      const p = page + 1;
                      setPage(p);
                      fetchAdmins({ page: p });
                    }}
                  >
                    Suivant ▶
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL EDIT */}
      {showEdit && editUser && (
        <Modal onClose={() => setShowEdit(false)} title="Modifier l’administrateur">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Email</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editUser.email || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Nom</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editUser.name || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">communeId</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editUser.communeId || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, communeId: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">communeName</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editUser.communeName || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, communeName: e.target.value })
                }
              />
            </div>
            {/* rôle figé à admin */}
            <div>
              <label className="text-xs text-gray-600">Rôle</label>
              <input
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500"
                value="admin"
                disabled
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
              onClick={() => setShowEdit(false)}
            >
              <XCircle size={16} /> Annuler
            </button>
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
              onClick={saveEdit}
              disabled={doingAction}
            >
              <Save size={16} /> {doingAction ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL SUBSCRIPTION */}
      {showSub && subUser && (
        <Modal onClose={() => setShowSub(false)} title={`Abonnement – ${subUser.email}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-600">Plan</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={subPayload.planId}
                onChange={(e) =>
                  setSubPayload({ ...subPayload, planId: e.target.value })
                }
              >
                {loadingPlans && <option>Chargement…</option>}
                {!loadingPlans && plans.length === 0 && <option>Aucun plan</option>}
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {p.price} {p.currency}/{p.period}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Durée (mois)</label>
              <input
                type="number"
                min={1}
                className="w-full border rounded px-3 py-2"
                value={subPayload.periodMonths}
                onChange={(e) =>
                  setSubPayload({
                    ...subPayload,
                    periodMonths: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Méthode</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={subPayload.method}
                onChange={(e) =>
                  setSubPayload({ ...subPayload, method: e.target.value })
                }
              >
                <option value="card">Carte</option>
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
              onClick={() => setShowSub(false)}
            >
              <XIcon size={16} /> Fermer
            </button>
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
              onClick={() => startOrRenew("start")}
              disabled={doingAction}
            >
              <BadgeCheck size={16} /> {doingAction ? "Traitement…" : "Démarrer"}
            </button>
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
              onClick={() => startOrRenew("renew")}
              disabled={doingAction}
            >
              <RotateCcw size={16} /> Renouveler
            </button>
            <button
              className="px-3 py-2 border rounded hover:bg-red-600 text-red-600 hover:text-white flex items-center gap-1 disabled:opacity-50"
              onClick={cancelSub}
              disabled={doingAction}
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL INVOICES */}
      {showInvoices && invUser && (
        <Modal onClose={() => setShowInvoices(false)} title={`Factures – ${invUser.email}`}>
          {loadingInvoices ? (
            <div className="text-gray-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Chargement…
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-gray-500">Aucune facture.</div>
          ) : (
            <div className="space-y-2">
              {invoices.map((f, i) => (
                <div
                  key={i}
                  className="border rounded px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {f.number || f.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {f.amount} {f.currency} – {f.status} –{" "}
                      {f.date ? new Date(f.date).toLocaleDateString() : ""}
                    </div>
                  </div>
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 text-sm underline"
                    >
                      Voir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-right">
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50"
              onClick={() => setShowInvoices(false)}
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------- Modal component -------------- */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[95vw] max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
