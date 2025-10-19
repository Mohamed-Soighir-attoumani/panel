import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/* ========================= Config & API ========================= */
const API_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  validateStatus: (s) => s >= 200 && s < 500,
});

// injecte un token TOUJOURS frais
api.interceptors.request.use((config) => {
  const token = (localStorage.getItem('token') || '').trim();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ========================= UI Helpers ========================= */
const Badge = ({ children, tone = 'neutral' }) => {
  const map = {
    success: 'bg-green-100 text-green-800 ring-1 ring-green-200',
    warning: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    danger:  'bg-red-100 text-red-800 ring-1 ring-red-200',
    info:    'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
    neutral: 'bg-gray-100 text-gray-800 ring-1 ring-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

/* ========================= Formatters ========================= */
const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d, withTime = false) => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', withTime
      ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
};

const fmtMoney = (amount, currency = 'EUR') => {
  if (amount == null || Number.isNaN(Number(amount))) return `0,00 ${currency}`;
  return `${nf.format(Number(amount))} ${currency}`;
};

/* ========================= Page ========================= */
export default function MonAbonnement() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({ renew: false, cancel: false });
  const isSuperadmin = me?.role === 'superadmin' || me?.isSuperadmin === true;
  const mountedRef = useRef(true);

  const guardAuth = useCallback((res) => {
    if (res?.status === 401) {
      toast.error(res.data?.message || 'Session expirée');
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('token_orig');
        localStorage.removeItem('me');
      } catch {}
      setTimeout(() => (window.location.href = '/login'), 600);
      return true;
    }
    if (res?.status === 403) {
      toast.error(res.data?.message || 'Accès refusé');
      return true;
    }
    return false;
  }, []);

  const loadAll = useCallback(async () => {
    if (!API_URL) {
      toast.error('REACT_APP_API_URL manquant');
      setLoading(false);
      return;
    }

    setRefreshing(true);
    const ctrl = new AbortController();

    try {
      /* ---- 1) Profil ---- */
      const meRes = await api.get(`/api/me`, { signal: ctrl.signal });
      if (guardAuth(meRes)) return;

      // backend => { user: {...} }
      const user = meRes.data?.user || meRes.data || null;
      setMe(user);

      /* ---- 2) Abonnement ---- */
      const subRes = await api.get(`/api/my-subscription`, { signal: ctrl.signal });
      if (guardAuth(subRes)) return;
      setSub(subRes.data || null);

      /* ---- 3) Factures ---- */
      const invRes = await api.get(`/api/my-invoices`, { signal: ctrl.signal });
      if (guardAuth(invRes)) return;
      const list = Array.isArray(invRes.data?.invoices)
        ? invRes.data.invoices
        : Array.isArray(invRes.data?.items)
        ? invRes.data.items
        : Array.isArray(invRes.data)
        ? invRes.data
        : [];
      // tri descendant par date
      list.sort((a, b) => {
        const ta = new Date(a?.invoiceDate || a?.createdAt || 0).getTime();
        const tb = new Date(b?.invoiceDate || b?.createdAt || 0).getTime();
        return tb - ta;
      });
      setInvoices(list);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.message === 'canceled') return;
      toast.error(e?.response?.data?.message || e?.message || 'Erreur de chargement');
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }

    return () => ctrl.abort();
  }, [guardAuth]);

  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    return () => { mountedRef.current = false; };
  }, [loadAll]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => loadAll(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, loadAll]);

  /* ---- Download (blob) ---- */
  const downloadInvoice = async (number) => {
    try {
      const res = await api.get(`/api/my-invoices/${encodeURIComponent(number)}/pdf`, {
        responseType: 'blob',
      });
      if (guardAuth(res)) return;
      if (res.status >= 400 || !res.data) throw new Error('Téléchargement impossible');

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e?.message || 'Erreur de téléchargement');
    }
  };

  /* ---- Dérivés ---- */
  const statusTone = useMemo(() => {
    const s = (sub?.status || '').toLowerCase();
    if (!s) return 'neutral';
    if (['active', 'trialing'].includes(s)) return 'success';
    if (['past_due', 'incomplete', 'canceled', 'unpaid'].includes(s)) return 'warning';
    if (['expired'].includes(s)) return 'danger';
    return 'neutral';
  }, [sub?.status]);

  const expiresSoon = useMemo(() => {
    if (!sub?.endAt) return false;
    const ms = new Date(sub.endAt).getTime() - Date.now();
    return ms > 0 && ms < 7 * 24 * 60 * 60 * 1000;
  }, [sub?.endAt]);

  const filteredInvoices = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((f) => `${f.number || ''}`.toLowerCase().includes(q));
  }, [invoices, search]);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="w-full max-w-3xl mx-auto p-6">
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full mt-2" />
          </div>
        </div>
      </div>
    );
  }

  const priceLine = fmtMoney(sub?.price ?? 0, sub?.currency || 'EUR') + (sub?.method ? ` — Règlement : ${sub.method}` : '');

  /* ========================= Render ========================= */
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* En-tête + actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mon abonnement</h1>
              <p className="text-gray-600 mt-1">
                Gérez votre offre, vos paiements et vos documents de facturation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAll}
                disabled={refreshing}
                className="px-3 py-2 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                title="Actualiser"
                aria-busy={refreshing}
              >
                {refreshing ? 'Actualisation…' : 'Actualiser'}
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh
              </label>
            </div>
          </div>

          {/* Infos clés */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="text-xs uppercase text-gray-500">Statut</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={statusTone}>{sub?.status ? sub.status : '—'}</Badge>
                {expiresSoon && <Badge tone="warning">Expire bientôt</Badge>}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="text-xs uppercase text-gray-500">Début</div>
              <div className="mt-1 text-gray-800">{fmtDate(sub?.startAt)}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="text-xs uppercase text-gray-500">Fin</div>
              <div className="mt-1 text-gray-800">{fmtDate(sub?.endAt)}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="text-xs uppercase text-gray-500">Montant</div>
              <div className="mt-1 text-gray-800">{priceLine}</div>
            </div>
          </div>

          {/* (Boutons Renouveler / Résilier supprimés comme demandé) */}
        </div>

        {/* Bloc identité / facturation */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes informations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Nom</div>
              <div className="font-medium text-gray-900">{me?.name || '—'}</div>
            </div>
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium text-gray-900">{me?.email || '—'}</div>
            </div>

            {/* ✅ Infos de la commune ajoutées */}
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Commune (nom)</div>
              <div className="font-medium text-gray-900">{me?.communeName || '—'}</div>
            </div>
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Commune (identifiant)</div>
              <div className="font-medium text-gray-900">{me?.communeId || '—'}</div>
            </div>

            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Entreprise</div>
              <div className="font-medium text-gray-900">{me?.company || sub?.company || '—'}</div>
            </div>
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Adresse de facturation</div>
              <div className="font-medium text-gray-900">{sub?.billingAddress || '—'}</div>
            </div>
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">TVA intracommunautaire</div>
              <div className="font-medium text-gray-900">{sub?.vatNumber || '—'}</div>
            </div>
            <div className="border rounded p-4">
              <div className="text-sm text-gray-500">Moyen de paiement</div>
              <div className="font-medium text-gray-900">
                {sub?.pmBrand
                  ? `${sub.pmBrand} •••• ${sub.pmLast4 || ''}`
                  : (sub?.method || '—')}
              </div>
            </div>
          </div>
        </div>

        {/* Factures */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mes factures</h2>
            <input
              type="search"
              placeholder="Rechercher un numéro…"
              className="px-3 py-2 rounded border w-60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {(!filteredInvoices || filteredInvoices.length === 0) ? (
            <p className="text-gray-500">Aucune facture disponible.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Numéro</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Montant</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((f, i) => (
                    <tr key={`${f.number}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">{f.number}</td>
                      <td className="py-2 pr-3 text-gray-700">
                        {f.invoiceDateFormatted || fmtDate(f.invoiceDate || f.createdAt)}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">
                        {fmtMoney(f.amountTTC ?? f.amount ?? 0, f.currency || 'EUR')}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={f.status === 'paid' ? 'success' : 'warning'}>
                          {f.status === 'paid' ? 'Payée' : 'À payer'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button
                          onClick={() => downloadInvoice(f.number)}
                          className="px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                          title="Télécharger la facture (PDF)"
                        >
                          Télécharger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Outils Superadmin */}
        {isSuperadmin && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Superadmin — Outils de support</h2>
              <Badge tone="info">Visibles seulement pour superadmin</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border rounded p-4">
                <div className="text-sm text-gray-500">Utilisateur</div>
                <div className="font-medium text-gray-900">{me?.name} ({me?.email})</div>
                <div className="text-xs text-gray-500 mt-1">ID: {me?.id || me?._id || '—'}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-sm text-gray-500">ID Abonnement</div>
                <div className="font-medium text-gray-900">{sub?.id || sub?.subscriptionId || '—'}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-sm text-gray-500">Prochain renouvellement</div>
                <div className="font-medium text-gray-900">{fmtDate(sub?.currentPeriodEnd, true)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="px-3 py-2 rounded border hover:bg-gray-50" onClick={() => toast.info('Simulation : synchroniser avec PSP')}>
                Synchroniser PSP
              </button>
              <button className="px-3 py-2 rounded border hover:bg-gray-50" onClick={() => toast.info('Simulation : appliquer geste commercial')}>
                Geste commercial
              </button>
              <button className="px-3 py-2 rounded border hover:bg-gray-50" onClick={() => toast.info('Simulation : renvoyer facture par email')}>
                Renvoyer facture
              </button>
            </div>
          </div>
        )}

        {/* Aide & conformité */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aide</h2>
          <p className="text-gray-600">
            Besoin d’aide ? Contactez le support à{' '}
            <a className="text-purple-700 underline" href="mailto:contact@asso-bellevue-dembeni.yt">contact@asso-bellevue-dembeni.yt</a>.
            Pour les demandes de facture, indiquez le numéro de facture.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Mentions légales : les factures sont conformes aux exigences fiscales françaises. TVA intracommunautaire si applicable.
          </p>
        </div>
      </div>
    </div>
  );
}
