import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Check, X, RotateCcw, BadgeCheck, FileText, ShieldBan, ShieldCheck,
  Wallet, CreditCard, Search, Filter, PlusCircle, Loader2, Save, XCircle, X as XIcon,
  RefreshCcw, ArrowUpDown, ChevronLeft, ChevronRight
} from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "";

/* ----------------- Helpers ------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizeErr = (e, fallback = "Erreur inattendue") =>
  e?.response?.data?.message || e?.message || fallback;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (v) => (v || "").toString().trim().toLowerCase();

const DEFAULT_PAGE_SIZE = 15;

/* Small pill */
const Pill = ({ ok, children, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border
      ${ok ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}
  >
    {ok ? <Check size={12}/> : <X size={12}/>} {children}
  </span>
);

/* Dedup util (par _id puis par email) */
function dedupUsers(arr) {
  const byId = new Map();
  for (const u of (arr || [])) {
    const id = u._id || u.id || u.email || Math.random();
    if (!byId.has(id)) byId.set(id, u);
  }
  // seconde passe par email si doublons différents d’ID
  const byEmail = new Map();
  for (const u of byId.values()) {
    const key = (u.email || "").toLowerCase();
    if (!key) { byEmail.set(Math.random(), u); continue; }
    if (!byEmail.has(key)) byEmail.set(key, u);
  }
  return Array.from(byEmail.values());
}

/* Tri client léger en attendant tri serveur */
function sortList(list, sortBy, sortDir) {
  if (!sortBy) return list;
  const dir = sortDir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    let av = (a?.[sortBy] ?? "").toString().toLowerCase();
    let bv = (b?.[sortBy] ?? "").toString().toLowerCase();
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

/* ----------------- Page ------------------ */
export default function Administrateurs() {
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
  const [onlyMine, setOnlyMine] = useState(false); // créés par moi (superadmin)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hasNextPage, setHasNextPage] = useState(false); // fallback quand total inconnu
  const [total, setTotal] = useState(null); // si l’API renvoie un total

  // tri
  const [sortBy, setSortBy] = useState(""); // "email" | "name" | "communeName"
  const [sortDir, setSortDir] = useState("asc");

  // plans / modals
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  const [subUser, setSubUser] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [subPayload, setSubPayload] = useState({ planId: "", periodMonths: 1, method: "card" });
  const [doingAction, setDoingAction] = useState(false);

  const [invUser, setInvUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", name: "", communeId: "", communeName: "", role: "admin",
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
        if (!API_URL) { toast.error("REACT_APP_API_URL manquant"); setLoadingMe(false); return; }
        if (!token) { toast.error("Non connecté"); window.location.href = "/login"; return; }
        const r = await axios.get(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
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
        headers: { Authorization: `Bearer ${token}` }, timeout: 15000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Plans indisponibles");
      safeSet(setPlans)(Array.isArray(r.data?.plans) ? r.data.plans : []);
    } catch {
      // fallback plans
      safeSet(setPlans)([
        { id: "basic",   name: "Basic",   price: 9.9,  currency: "EUR", period: "mois" },
        { id: "pro",     name: "Pro",     price: 19.9, currency: "EUR", period: "mois" },
        { id: "premium", name: "Premium", price: 39.9, currency: "EUR", period: "mois" },
      ]);
    } finally {
      setLoadingPlans(false);
    }
  }, [token]);

  // --------- FETCH LISTE DES ADMINS ----------
  const fetchAdmins = useCallback(async () => {
    if (!API_URL || !token) return;

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
        page,
        pageSize,
        role: "admin",
        createdBy: onlyMine ? (me?._id || me?.id) : undefined, // si backend supporte
        sortBy: ["email","name","communeName"].includes(sortBy) ? sortBy : undefined,
        sortDir: sortDir,
      };

      let list = [];
      let totalFromApi = null;

      // Route dédiée si tu l’as, sinon fallback users
      const r = await axios.get(`${API_URL}/api/admins`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 20000,
        signal: controller.signal,
        validateStatus: (s) => s >= 200 && s < 500,
      });

      if (r.status >= 200 && r.status < 300) {
        list = Array.isArray(r.data?.items) ? r.data.items
             : Array.isArray(r.data?.admins) ? r.data.admins
             : Array.isArray(r.data) ? r.data
             : [];
        totalFromApi = typeof r.data?.total === "number" ? r.data.total : null;
      } else {
        // fallback
        const r2 = await axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
          timeout: 20000,
          signal: controller.signal,
          validateStatus: (s) => s >= 200 && s < 500,
        });
        if (r2.status >= 400) throw new Error(r2.data?.message || `Erreur API (${r2.status})`);
        list = Array.isArray(r2.data?.items) ? r2.data.items
             : Array.isArray(r2.data?.users) ? r2.data.users
             : [];
        totalFromApi = typeof r2.data?.total === "number" ? r2.data.total : null;
      }

      // garde-fou client
      list = (list || []).filter((u) => norm(u.role) === "admin");
      // anti-doublons
      list = dedupUsers(list);
      // tri client si API ne trie pas
      list = sortList(list, sortBy, sortDir);

      safeSet(setUsers)(list);
      safeSet(setTotal)(totalFromApi);

      // si pas de total, on devine s’il y a une page suivante
      safeSet(setHasNextPage)(totalFromApi == null ? list.length >= pageSize : (page * pageSize) < totalFromApi);
    } catch (e) {
      if (e.name === "CanceledError" || e.message === "canceled") return;
      toast.error(normalizeErr(e, "Erreur chargement administrateurs"));
      safeSet(setUsers)([]);
      safeSet(setTotal)(null);
      safeSet(setHasNextPage)(false);
    } finally {
      setLoadingList(false);
    }
  }, [token, debouncedQ, communeId, statusFilter, subFilter, page, pageSize, sortBy, sortDir, onlyMine, me?._id]);

  useEffect(() => {
    if (!loadingMe && me) {
      fetchAdmins();
      loadPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMe, me, fetchAdmins, loadPlans]);

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

  const canManage = norm(me?.role) === "superadmin";

  /* ----------------- Actions ------------------ */

  const exportCSV = () => {
    const rows = [
      ["email","name","communeId","communeName","isActive","subStatus","subEndAt"],
      ...users.map(u => [
        u.email || "", u.name || "", u.communeId || "", u.communeName || "",
        (u.isActive === false ? "inactive" : "active"),
        u.subscriptionStatus || (u.subscriptionEndAt ? "active" : "none"),
        u.subscriptionEndAt || ""
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "administrateurs.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setQ("");
    setDebouncedQ("");
    setCommuneId("");
    setStatusFilter("");
    setSubFilter("");
    setOnlyMine(false);
    setSortBy("");
    setSortDir("asc");
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    fetchAdmins();
  };

  const openEdit = (u) => { setEditUser({ ...u, role: "admin" }); setShowEdit(true); };
  const saveEdit = async () => {
    if (!editUser) return;
    if (editUser.email && !EMAIL_RE.test(editUser.email)) {
      toast.error("Email invalide");
      return;
    }
    try {
      setDoingAction(true);
      const payload = { ...editUser, role: "admin" };
      const r = await axios.put(`${API_URL}/api/users/${editUser._id || editUser.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Échec de la mise à jour");
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
    try {
      const next = !(u.isActive !== false);
      const r = await axios.post(`${API_URL}/api/users/${u._id || u.id}/toggle-active`, { active: next }, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Échec activation");
      toast.success(next ? "Compte activé" : "Compte désactivé");
      await sleep(120);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur activation"));
    }
  };

  const openSub = (u) => { setSubUser(u); setSubPayload({ planId: plans[0]?.id || "", periodMonths: 1, method: "card" }); setShowSub(true); };

  const startOrRenew = async (mode = "start") => {
    if (!subUser) return;
    const endpoint = mode === "renew" ? "renew" : "start";
    try {
      setDoingAction(true);
      const r = await axios.post(`${API_URL}/api/subscriptions/${subUser._id || subUser.id}/${endpoint}`, subPayload, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || `Échec ${mode}`);
      toast.success(mode === "renew" ? "Abonnement renouvelé ✅" : "Abonnement démarré ✅");
      setShowSub(false);
      await sleep(150);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, `Erreur ${mode}`));
    } finally {
      setDoingAction(false);
    }
  };

  const cancelSub = async () => {
    if (!subUser) return;
    try {
      setDoingAction(true);
      const r = await axios.post(`${API_URL}/api/subscriptions/${subUser._id || subUser.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Échec annulation");
      toast.success("Abonnement annulé ✅");
      setShowSub(false);
      await sleep(150);
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur annulation"));
    } finally {
      setDoingAction(false);
    }
  };

  const openInvoices = async (u) => {
    setInvUser(u);
    setShowInvoices(true);
    setLoadingInvoices(true);
    try {
      const r = await axios.get(`${API_URL}/api/users/${u._id || u.id}/invoices`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Factures indisponibles");
      const arr = Array.isArray(r.data?.invoices) ? r.data.invoices : [];
      setInvoices(arr);
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur factures"));
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) { toast.error("Email & mot de passe requis"); return; }
    if (!EMAIL_RE.test(createForm.email)) { toast.error("Email invalide"); return; }
    try {
      setCreating(true);
      const payload = { ...createForm, role: "admin", createdBy: me?._id || me?.id };
      const r = await axios.post(`${API_URL}/api/users`, payload, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000, validateStatus: s => s >= 200 && s < 500
      });
      if (r.status >= 400) throw new Error(r.data?.message || "Création refusée");
      toast.success("Administrateur créé ✅");
      setCreateForm({ email: "", password: "", name: "", communeId: "", communeName: "", role: "admin" });
      await sleep(120);
      // si “créés par moi” activé, l’admin créé apparaîtra
      fetchAdmins();
    } catch (e) {
      toast.error(normalizeErr(e, "Erreur création"));
    } finally {
      setCreating(false);
    }
  };

  const toggleSort = (key) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  /* ----------------- UI ------------------ */

  if (loadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer/>
        <div className="bg-white shadow rounded px-6 py-4 text-gray-600 flex items-center gap-2">
          <Loader2 className="animate-spin" size={18}/> Chargement…
        </div>
      </div>
    );
  }

  if (!me || norm(me.role) !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer/>
        <div className="bg-white shadow rounded px-6 py-4 text-gray-700">
          Accès restreint : réservé au <strong>superadmin</strong>.
        </div>
      </div>
    );
  }

  const totalLabel = total ?? users.length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Administrateurs (créés dans la page superadmin)</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fetchAdmins()} className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2">
              <RefreshCcw size={16}/> Actualiser
            </button>
            <button onClick={exportCSV} className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2">
              <FileText size={16}/> Export CSV
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-600">Recherche</label>
                <div className="relative">
                  <input
                    className="w-full border rounded px-3 py-2 pr-8"
                    placeholder="email, nom…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <Search className="absolute right-2 top-2.5 text-gray-400" size={16}/>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Commune</label>
                <select className="w-full border rounded px-3 py-2"
                        value={communeId}
                        onChange={(e) => { setCommuneId(e.target.value); setPage(1); }}>
                  <option value="">Toutes</option>
                  {communes.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
                </select>
              </div>

              {/* Rôle verrouillé */}
              <div>
                <label className="text-xs text-gray-600">Rôle</label>
                <input className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500"
                       value="Admin (filtre imposé)" disabled />
              </div>

              <div>
                <label className="text-xs text-gray-600">Statut</label>
                <select className="w-full border rounded px-3 py-2"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">—</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600">Abonnement</label>
                <select className="w-full border rounded px-3 py-2"
                        value={subFilter}
                        onChange={(e) => { setSubFilter(e.target.value); setPage(1); }}>
                  <option value="">—</option>
                  <option value="active">Actif</option>
                  <option value="expired">Expiré</option>
                  <option value="none">Aucun</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 border rounded px-3 py-2">
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => { setOnlyMine(e.target.checked); setPage(1); }}
                />
                Créés par moi
              </label>
              <button
                onClick={() => { setPage(1); fetchAdmins(); }}
                className="px-4 py-2 bg-gray-900 text-white rounded flex items-center gap-2"
              >
                <Filter size={16}/> Filtrer
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 border rounded flex items-center gap-2"
              >
                <XIcon size={16}/> Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Création rapide d’un administrateur */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Créer un administrateur</h2>
          <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Email *" type="email"
                   value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required/>
            <input className="border rounded px-3 py-2" placeholder="Mot de passe *" type="password"
                   value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} required/>
            <input className="border rounded px-3 py-2" placeholder="Nom"
                   value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}/>
            <input className="border rounded px-3 py-2" placeholder="communeId"
                   value={createForm.communeId} onChange={e => setCreateForm({ ...createForm, communeId: e.target.value })}/>
            <input className="border rounded px-3 py-2" placeholder="communeName"
                   value={createForm.communeName} onChange={e => setCreateForm({ ...createForm, communeName: e.target.value })}/>
            <input className="border rounded px-3 py-2 bg-gray-50 text-gray-500" value="admin" disabled/>

            <div className="lg:col-span-6">
              <button disabled={creating}
                      className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50">
                <PlusCircle size={16}/>{creating ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        </div>

        {/* Liste */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">Administrateurs</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">{totalLabel} admin(s)</div>
              <label className="text-xs text-gray-600 flex items-center gap-2">
                Taille page
                <select
                  className="border rounded px-2 py-1"
                  value={pageSize}
                  onChange={(e) => { setPageSize(parseInt(e.target.value, 10) || DEFAULT_PAGE_SIZE); setPage(1); }}
                >
                  {[10,15,25,50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </div>

          {loadingList ? (
            <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Chargement…</div>
          ) : users.length === 0 ? (
            <div className="text-gray-500">
              Aucun administrateur trouvé.
              <button onClick={() => fetchAdmins()} className="ml-2 underline">Réessayer</button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                  <tr>
                    {[
                      {key:"email", label:"Email"},
                      {key:"name", label:"Nom"},
                      {key:"communeName", label:"Commune"},
                      {key:"__statut", label:"Statut"},
                      {key:"__abo", label:"Abonnement"},
                      {key:"__actions", label:"Actions"},
                    ].map(col => (
                      <th key={col.key} className="text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b">
                        <div className="inline-flex items-center gap-1">
                          {["email","name","communeName"].includes(col.key) ? (
                            <button
                              className="inline-flex items-center gap-1 hover:underline"
                              onClick={() => toggleSort(col.key)}
                              title="Trier"
                            >
                              {col.label}
                              <ArrowUpDown size={14} className={`${sortBy===col.key ? "text-gray-900" : "text-gray-400"}`}/>
                            </button>
                          ) : (
                            col.label
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                  </thead>
                  <tbody>
                  {users.map(u => {
                    const id = u._id || u.id;
                    const commune = u.communeName || u.communeId || "—";
                    const active = !(u.isActive === false);
                    const subStatus = u.subscriptionStatus || (u.subscriptionEndAt ? "active" : "none");
                    const subEnd = u.subscriptionEndAt ? new Date(u.subscriptionEndAt).toLocaleDateString() : null;
                    return (
                      <tr key={id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border-b text-sm">{u.email}</td>
                        <td className="px-4 py-2 border-b text-sm">{u.name || "—"}</td>
                        <td className="px-4 py-2 border-b text-sm">{commune}</td>
                        <td className="px-4 py-2 border-b text-sm">
                          <Pill ok={active}>{active ? "Actif" : "Inactif"}</Pill>
                        </td>
                        <td className="px-4 py-2 border-b text-sm">
                          <div className="flex items-center gap-2">
                            <Pill ok={subStatus === "active"} title={subEnd ? `Jusqu'au ${subEnd}` : ""}>
                              {subStatus === "active" ? "Actif" : subStatus === "expired" ? "Expiré" : "Aucun"}
                            </Pill>
                            {subEnd && <span className="text-xs text-gray-500">({subEnd})</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2 border-b text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button className="px-2 py-1 border rounded hover:bg-gray-50"
                                    onClick={() => openEdit(u)} title="Éditer infos">
                              Éditer
                            </button>
                            <button className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1"
                                    onClick={() => toggleActive(u)} title="Activer/Désactiver">
                              {active ? <ShieldBan size={14}/> : <ShieldCheck size={14}/>} {active ? "Désactiver" : "Activer"}
                            </button>
                            <button className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1"
                                    onClick={() => openSub(u)} title="Gérer l'abonnement">
                              <Wallet size={14}/> {subStatus === "active" ? "Renouveler / Annuler" : "Démarrer"}
                            </button>
                            <button className="px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1"
                                    onClick={() => openInvoices(u)} title="Factures">
                              <CreditCard size={14}/> Factures
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Page {page}{total ? ` / ${Math.max(1, Math.ceil(total / pageSize))}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 flex items-center gap-1"
                    onClick={() => { setPage(p => Math.max(1, p - 1)); }}
                    disabled={page <= 1}
                  >
                    <ChevronLeft size={16}/> Précédent
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 flex items-center gap-1"
                    onClick={() => { setPage(p => p + 1); }}
                    disabled={total != null ? (page * pageSize) >= total : !hasNextPage}
                  >
                    Suivant <ChevronRight size={16}/>
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
              <input className="w-full border rounded px-3 py-2" value={editUser.email || ""}
                     onChange={e => setEditUser({ ...editUser, email: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">Nom</label>
              <input className="w-full border rounded px-3 py-2" value={editUser.name || ""}
                     onChange={e => setEditUser({ ...editUser, name: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">communeId</label>
              <input className="w-full border rounded px-3 py-2" value={editUser.communeId || ""}
                     onChange={e => setEditUser({ ...editUser, communeId: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">communeName</label>
              <input className="w-full border rounded px-3 py-2" value={editUser.communeName || ""}
                     onChange={e => setEditUser({ ...editUser, communeName: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">Rôle</label>
              <input className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500" value="admin" disabled/>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => setShowEdit(false)}>
              <XCircle size={16}/> Annuler
            </button>
            <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                    onClick={saveEdit} disabled={doingAction}>
              <Save size={16}/> {doingAction ? "Enregistrement…" : "Enregistrer"}
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
              <select className="w-full border rounded px-3 py-2"
                      value={subPayload.planId}
                      onChange={e => setSubPayload({ ...subPayload, planId: e.target.value })}>
                {loadingPlans && <option>Chargement…</option>}
                {!loadingPlans && plans.length === 0 && <option>Aucun plan</option>}
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {p.price} {p.currency}/{p.period}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Durée (mois)</label>
              <input type="number" min={1} className="w-full border rounded px-3 py-2"
                     value={subPayload.periodMonths}
                     onChange={e => setSubPayload({ ...subPayload, periodMonths: Math.max(1, Number(e.target.value)||1) })}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">Méthode</label>
              <select className="w-full border rounded px-3 py-2"
                      value={subPayload.method}
                      onChange={e => setSubPayload({ ...subPayload, method: e.target.value })}>
                <option value="card">Carte</option>
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => setShowSub(false)}>
              <XIcon size={16}/> Fermer
            </button>
            <button className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => startOrRenew(subUser.subscriptionStatus === "active" ? "renew" : "start")}
                    disabled={doingAction}>
              <BadgeCheck size={16}/> {doingAction ? "Traitement…" : (subUser.subscriptionStatus === "active" ? "Renouveler" : "Démarrer")}
            </button>
            {subUser.subscriptionStatus === "active" && (
              <button className="px-3 py-2 border rounded hover:bg-red-600 text-red-600 hover:text-white flex items-center gap-1"
                      onClick={cancelSub} disabled={doingAction}>
                <RotateCcw size={16}/> Annuler
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL INVOICES */}
      {showInvoices && invUser && (
        <Modal onClose={() => setShowInvoices(false)} title={`Factures – ${invUser.email}`}>
          {loadingInvoices ? (
            <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Chargement…</div>
          ) : invoices.length === 0 ? (
            <div className="text-gray-500">Aucune facture.</div>
          ) : (
            <div className="space-y-2">
              {invoices.map((f, i) => (
                <div key={i} className="border rounded px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{f.number || f.id}</div>
                    <div className="text-xs text-gray-500">
                      {f.amount} {f.currency} – {f.status} – {f.date ? new Date(f.date).toLocaleDateString() : ""}
                    </div>
                  </div>
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">
                      Voir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-right">
            <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={() => setShowInvoices(false)}>
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose}/>
      <div className="relative bg-white rounded-lg shadow-xl w-[95vw] max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XIcon size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
