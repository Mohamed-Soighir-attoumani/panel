// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import IncidentsChart from "../components/IncidentsChart";
import DevicesTable from "../components/DevicesTable";
import api from "../api";

ChartJS.register(...registerables, ChartDataLabels);

const nf = new Intl.NumberFormat("fr-FR");

// ---------- Utils ---------------------------------------------------------
function canonicalizeLabel(raw) {
  if (!raw) return { key: "inconnu", label: "Inconnu" };
  const s = String(raw).trim();
  const key = s.toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return { key, label };
}

function canonStatus(s) {
  const x = String(s || "").trim().toLowerCase();
  if (x === "en cours" || x === "encours") return "En cours";
  if (x === "résolu" || x === "resolu") return "Résolu";
  if (x === "en attente" || x === "enattente") return "En attente";
  if (x === "rejeté" || x === "rejete" || x === "rejecte") return "Rejeté";
  return s || "Inconnu";
}

function readCachedMe() {
  try {
    const raw = localStorage.getItem("me");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// GET /me avec fallback (/api/me -> /me)
async function tolerantGetMe() {
  try {
    const r1 = await api.get("/api/me", { validateStatus: () => true, timeout: 15000 });
    if ([200, 401, 403].includes(r1.status)) return r1;
  } catch {}
  try {
    const r2 = await api.get("/me", { validateStatus: () => true, timeout: 15000 });
    return r2;
  } catch {
    return { status: 0, data: null };
  }
}

// Essaie plusieurs chemins (gère projets où baseURL = '/api' ou '/')
async function multiTryGet(paths, { headers, query = "" }) {
  const q = query ? (paths[0]?.includes("?") ? `&${query}` : `?${query}`) : "";
  for (const p of paths) {
    try {
      const res = await api.get(`${p}${q}`, { headers, validateStatus: () => true });
      if (res.status === 200) return res;
    } catch {}
  }
  return null;
}

/* ---------- pick commune admin ---------- */
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());
const pickCommuneFromUser = (u) =>
  norm(
    u?.communeId ??
      u?.commune ??
      u?.communeSlug ??
      u?.commune_code ??
      u?.communeCode ??
      u?.communeName ??
      ""
  );

// Construit un querystring robuste commune + extras (period, etc.)
function buildQuery(me, selectedCommuneId, extra = {}) {
  const params = new URLSearchParams();
  // Superadmin : commune optionnelle (toutes si vide)
  if (me?.role === "superadmin" && selectedCommuneId) {
    params.set("communeId", norm(selectedCommuneId));
  }
  // Admin : commune OBLIGATOIRE
  if (me?.role === "admin" && me?.communeId) {
    params.set("communeId", norm(me.communeId));
  }
  // Extra params (period, etc.)
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && String(v).length) params.set(k, String(v));
  }
  return params.toString();
}

// -------------------------------------------------------------------------

const DashboardPage = () => {
  // ---- session / rôle
  const cachedMe = readCachedMe();
  const [me, setMe] = useState(cachedMe);
  const [loadingMe, setLoadingMe] = useState(!cachedMe);

  // ---- incidents pour la PÉRIODE (graphiques)
  const [incidentsPeriod, setIncidentsPeriod] = useState([]);

  // ---- incidents TOTAUX (KPI)
  const [kpiTotal, setKpiTotal] = useState(0);
  const [kpiOpen, setKpiOpen] = useState(0);
  const [kpiResolved, setKpiResolved] = useState(0);

  // ---- autres données
  const [notifications, setNotifications] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [activity, setActivity] = useState([]);

  // ---- UI/état
  const [period, setPeriod] = useState("7");
  const [bannerError, setBannerError] = useState("");

  // ---- superadmin : communes
  const [communes, setCommunes] = useState([]);
  const [selectedCommuneId, setSelectedCommuneId] = useState(
    (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || ""
  );

  // ---- anti-clignotement
  const lastGoodIncidentsPeriodRef = useRef([]);
  const lastGoodKpisRef = useRef({ total: 0, open: 0, resolved: 0 });
  const lastGoodNotifsRef = useRef([]);
  const lastGoodDevicesRef = useRef(0);

  // ---- annuler réponses lentes
  const periodFetchIdRef = useRef(0);
  const kpiFetchIdRef = useRef(0);
  const devicesFetchIdRef = useRef(0);
  const notifsFetchIdRef = useRef(0);

  // ---------- session ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await tolerantGetMe();
      if (cancelled) return;

      try {
        if (res.status === 200) {
          const user = res?.data?.user || res?.data || null;
          if (user) {
            // ✅ normalise commune côté admin
            const normalized = { ...user, communeId: pickCommuneFromUser(user) || user.communeId || "" };
            setMe(normalized);
            localStorage.setItem("me", JSON.stringify(normalized));
            setBannerError("");
          } else {
            setBannerError("Réponse /me inattendue.");
          }
        } else if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("token_orig");
          localStorage.removeItem("me");
          window.location.href = "/login";
          return;
        } else if (res.status === 403) {
          setBannerError("Accès restreint : vérifiez le filtre de commune.");
        } else if (res.status === 0) {
          setBannerError("Erreur réseau/CORS lors de la vérification de session.");
        } else {
          setBannerError(`Impossible de vérifier la session (HTTP ${res.status}).`);
        }
      } finally {
        setLoadingMe(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------- communes (superadmin) ----------
  useEffect(() => {
    if (!loadingMe && me?.role === "superadmin") {
      (async () => {
        const r =
          (await multiTryGet(["/api/communes", "communes"], { headers: {}, query: "" })) || null;
        if (!r) { setCommunes([]); return; }
        const arr = Array.isArray(r.data)
          ? r.data
          : Array.isArray(r.data?.items)
          ? r.data.items
          : Array.isArray(r.data?.data)
          ? r.data.data
          : [];
        const normalized = (arr || [])
          .map((c) => ({
            id: String(c.id ?? c._id ?? c.slug ?? c.code ?? "").trim().toLowerCase(),
            name: String(c.name ?? c.label ?? c.communeName ?? "Commune").trim(),
          }))
          .filter((c) => c.id)
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        setCommunes(normalized);
      })();
    }
  }, [loadingMe, me]);

  // ---------- headers ----------
  const buildHeaders = useCallback(() => {
    const h = {};
    // Auth (au cas où l'instance axios n'injecte pas)
    try {
      const token = localStorage.getItem("token") || "";
      if (token) h.Authorization = `Bearer ${token}`;
    } catch {}
    // ⬇️ IMPORTANT : on envoie aussi la commune côté panel pour que le backend scope bien
    if (me?.role === "superadmin" && selectedCommuneId) {
      h["x-commune-id"] = norm(selectedCommuneId);
    } else if (me?.role === "admin" && me?.communeId) {
      h["x-commune-id"] = norm(me.communeId);
    }
    return h;
  }, [me?.role, me?.communeId, selectedCommuneId]);

  // ---------- auth error ----------
  const handleAuthError = useCallback((err) => {
    const status = err?.response?.status;
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      localStorage.removeItem("me");
      window.location.href = "/login";
      return true;
    }
    return false;
  }, []);

  // ---------- Fetch incidents POUR LA PÉRIODE ----------
  const fetchIncidentsForPeriod = useCallback(async () => {
    if (!me) return;

    // Si admin sans commune → rien à afficher
    if (me.role === "admin" && !me.communeId) return;

    const headers = buildHeaders();
    const qs = period === "all"
      ? buildQuery(me, selectedCommuneId, {})
      : buildQuery(me, selectedCommuneId, { period });

    const id = ++periodFetchIdRef.current;

    try {
      const resp =
        (await multiTryGet(["/api/incidents", "incidents"], { headers, query: qs })) || null;

      if (id !== periodFetchIdRef.current) return; // réponse obsolète

      if (resp?.status === 200) {
        const d = resp.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setIncidentsPeriod(arr);
        lastGoodIncidentsPeriodRef.current = arr;
      } else if (lastGoodIncidentsPeriodRef.current.length) {
        setIncidentsPeriod(lastGoodIncidentsPeriodRef.current);
      }
    } catch (err) {
      if (!handleAuthError(err) && lastGoodIncidentsPeriodRef.current.length) {
        setIncidentsPeriod(lastGoodIncidentsPeriodRef.current);
      }
    }
  }, [me, period, selectedCommuneId, buildHeaders, handleAuthError]);

  // ---------- Fetch incidents TOTAUX (KPI) ----------
  const fetchKpisAllIncidents = useCallback(async () => {
    if (!me) return;
    if (me.role === "admin" && !me.communeId) return;

    const headers = buildHeaders();
    const qs = buildQuery(me, selectedCommuneId, {});
    const id = ++kpiFetchIdRef.current;

    try {
      const resp =
        (await multiTryGet(["/api/incidents", "incidents"], { headers, query: qs })) || null;

      if (id !== kpiFetchIdRef.current) return;

      if (resp?.status === 200) {
        const d = resp.data;
        const all = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];

        let total = all.length;
        let open = 0;
        let resolved = 0;
        for (const it of all) {
          const st = canonStatus(it?.status);
          if (st === "En cours") open += 1;
          else if (st === "Résolu") resolved += 1;
        }

        setKpiTotal(total);
        setKpiOpen(open);
        setKpiResolved(resolved);
        lastGoodKpisRef.current = { total, open, resolved };
      } else {
        const last = lastGoodKpisRef.current;
        setKpiTotal(last.total);
        setKpiOpen(last.open);
        setKpiResolved(last.resolved);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        const last = lastGoodKpisRef.current;
        setKpiTotal(last.total);
        setKpiOpen(last.open);
        setKpiResolved(last.resolved);
      }
    }
  }, [me, selectedCommuneId, buildHeaders, handleAuthError]);

  // ---------- fetch devices (global) ----------
  const fetchDeviceCount = useCallback(async () => {
    if (!me) return;

    const id = ++devicesFetchIdRef.current;

    try {
      const resp =
        (await multiTryGet(["/api/devices/count", "devices/count"], {
          headers: {}, // global
          query: "activeDays=30",
        })) || null;

      if (id !== devicesFetchIdRef.current) return;

      if (resp?.status === 200 && resp.data) {
        const total =
          typeof resp.data.countAll === "number"
            ? resp.data.countAll
            : typeof resp.data.count === "number"
            ? resp.data.count
            : 0;
        setDeviceCount(total);
        lastGoodDevicesRef.current = total;
      } else if (lastGoodDevicesRef.current) {
        setDeviceCount(lastGoodDevicesRef.current);
      }
    } catch (err) {
      if (!handleAuthError(err) && lastGoodDevicesRef.current) {
        setDeviceCount(lastGoodDevicesRef.current);
      }
    }
  }, [me, handleAuthError]);

  // ---------- fetch notifications ----------
  const fetchNotifications = useCallback(async () => {
    if (!me) return;
    if (me.role === "admin" && !me.communeId) return;

    const headers = buildHeaders();
    const qs = buildQuery(me, selectedCommuneId, {});
    const id = ++notifsFetchIdRef.current;

    try {
      const resp =
        (await multiTryGet(["/api/notifications", "notifications"], { headers, query: qs })) || null;

      if (id !== notifsFetchIdRef.current) return;

      if (resp?.status === 200) {
        const d = resp.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setNotifications(arr);
        lastGoodNotifsRef.current = arr;
      } else if (Array.isArray(lastGoodNotifsRef.current)) {
        setNotifications(lastGoodNotifsRef.current);
      }
    } catch (err) {
      if (!handleAuthError(err) && Array.isArray(lastGoodNotifsRef.current)) {
        setNotifications(lastGoodNotifsRef.current);
      }
    }
  }, [me, selectedCommuneId, buildHeaders, handleAuthError]);

  // ---------- bootstrap + polling ----------
  useEffect(() => {
    if (!loadingMe && me) {
      fetchIncidentsForPeriod();
      fetchKpisAllIncidents();
      fetchNotifications();
      fetchDeviceCount();
      const i = setInterval(() => {
        fetchIncidentsForPeriod();
        fetchKpisAllIncidents();
        fetchNotifications();
        fetchDeviceCount();
      }, 30000);
      return () => clearInterval(i);
    }
  }, [
    loadingMe,
    me,
    period,
    selectedCommuneId,
    fetchIncidentsForPeriod,
    fetchKpisAllIncidents,
    fetchNotifications,
    fetchDeviceCount,
  ]);

  // ---------- activité dérivée ----------
  useEffect(() => {
    const next = [
      ...incidentsPeriod.slice(0, 3).map((inc) => ({
        type: "incident",
        text: `Incident "${inc?.type || inc?.title || "Inconnu"}" signalé`,
        time: inc?.createdAt ? new Date(inc.createdAt).toLocaleString("fr-FR") : "Date inconnue",
      })),
      ...notifications.slice(0, 3).map((n) => ({
        type: "notification",
        text: `Notification: ${n?.title || n?.message || "Sans titre"}`,
        time: n?.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : "Date inconnue",
      })),
    ];
    setActivity(next);
  }, [incidentsPeriod, notifications]);

  // ---------- répartition types (période) ----------
  const { typeLabels, typeCounts } = useMemo(() => {
    const map = new Map();
    for (const inc of incidentsPeriod) {
      const raw = inc?.type || inc?.title || "Inconnu";
      const { key, label } = canonicalizeLabel(raw);
      const e = map.get(key) || { label, count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return { typeLabels: arr.map((x) => x.label), typeCounts: arr.map((x) => x.count) };
  }, [incidentsPeriod]);

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true, callbacks: { label: (ctx) => nf.format(ctx.parsed.y ?? 0) } },
      datalabels: {
        anchor: "end",
        align: "top",
        color: "#000",
        font: { weight: "bold", size: 12 },
        formatter: (value) => nf.format(value),
      },
    },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 40, minRotation: 0 } },
      y: { beginAtZero: true, precision: 0, ticks: { callback: (v) => nf.format(v) } },
    },
  };

  const palette = [
    "rgba(75, 192, 192, 0.5)",
    "rgba(255, 99, 132, 0.5)",
    "rgba(54, 162, 235, 0.5)",
    "rgba(255, 206, 86, 0.5)",
    "rgba(153, 102, 255, 0.5)",
    "rgba(255, 159, 64, 0.5)",
    "rgba(201, 203, 207, 0.5)",
  ];
  const bgColors = typeLabels.map((_, i) => palette[i % palette.length]);
  const borderColors = bgColors.map((c) => c.replace("0.5", "1"));

  const barChartData = {
    labels: typeLabels,
    datasets: [
      {
        label: "Répartition des incidents (période)",
        data: typeCounts,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          color: "#000",
          font: { weight: "bold", size: 12 },
          formatter: (value) => nf.format(value),
        },
      },
    ],
  };

  const KpiCard = ({ icon, label, value, color }) => (
    <div className="bg-white p-3 sm:p-4 rounded shadow text-center hover:shadow-lg transition duration-300 text-sm sm:text-base">
      <div className="text-2xl sm:text-3xl mb-1">{icon}</div>
      <p className="text-gray-500 text-xs sm:text-sm">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${color}`}>{nf.format(value)}</p>
    </div>
  );

  const ActivityItem = ({ type, text, time }) => (
    <li className="py-2 flex items-center gap-2">
      <span className="text-lg">{type === "incident" ? "🚨" : "🔔"}</span>
      <div>
        <p className="font-medium">{text}</p>
        <p className="text-sm text-gray-500">{time}</p>
      </div>
    </li>
  );

  if (loadingMe && !me) return <div className="p-6">Chargement…</div>;

  const needsCommune = me?.role === "admin" && !me?.communeId;

  return (
    <div className="p-4 sm:p-6">
      {(bannerError || needsCommune) && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 text-amber-800 p-3">
          {needsCommune
            ? "Votre compte administrateur n’est rattaché à aucune commune. Demandez à un superadmin de vous assigner une commune."
            : bannerError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left">📊 Tableau de bord</h1>

        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <label className="font-medium">📅 Période :</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border px-2 py-1 rounded w-full sm:w-auto"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="all">Tous</option>
          </select>

          {me?.role === "superadmin" && (
            <>
              <select
                className="border px-2 py-1 rounded w-full sm:w-72"
                value={selectedCommuneId}
                onChange={(e) => {
                  const v = e.target.value.trim().toLowerCase();
                  setSelectedCommuneId(v);
                  if (v) localStorage.setItem("selectedCommuneId", v);
                  else localStorage.removeItem("selectedCommuneId");
                  // rafraîchir ciblé
                  fetchIncidentsForPeriod();
                  fetchKpisAllIncidents();
                }}
                title="Filtrer par commune (laisser vide = toutes)"
              >
                <option value="">Toutes les communes</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
              {selectedCommuneId && (
                <button
                  onClick={() => {
                    setSelectedCommuneId("");
                    localStorage.removeItem("selectedCommuneId");
                    fetchIncidentsForPeriod();
                    fetchKpisAllIncidents();
                  }}
                  className="border px-3 py-1 rounded hover:bg-gray-50"
                  title="Réinitialiser le filtre commune"
                >
                  Réinitialiser
                </button>
              )}
            </>
          )}

          <button
            onClick={() => {
              fetchIncidentsForPeriod();
              fetchKpisAllIncidents();
              fetchNotifications();
              fetchDeviceCount();
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full sm:w-auto transition"
          >
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      {/* KPIs (calculés sur TOUS les incidents de la commune, hors période) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard icon="🚨" label="Incidents EN COURS" value={kpiOpen} color="text-red-600" />
        <KpiCard icon="✅" label="Incidents RÉSOLUS" value={kpiResolved} color="text-green-600" />
        <KpiCard icon="📋" label="Incidents TOTAL" value={kpiTotal} color="text-blue-600" />
        <KpiCard icon="🔔" label="Notifications" value={notifications.length} color="text-purple-600" />
        <KpiCard icon="👥" label="Utilisateurs" value={deviceCount} color="text-gray-800" />
      </div>

      {/* Courbe (période) */}
      <IncidentsChart incidents={incidentsPeriod} period={period} />

      {/* Répartition par types (période) */}
      <div className="bg-white p-4 rounded shadow mb-8" style={{ height: 420 }}>
        <h3 className="text-lg sm:text-xl font-semibold mb-4">🧭 Répartition par types</h3>
        {typeLabels.length === 0 ? (
          <p className="text-gray-500">Aucun incident pour la période choisie.</p>
        ) : (
          <Bar data={barChartData} options={barChartOptions} plugins={[ChartDataLabels]} />
        )}
      </div>

      {/* Table devices */}
      <div className="mt-6">
        <DevicesTable />
      </div>

      {/* Activité récente (période) */}
      <div className="bg-white p-4 shadow rounded mt-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">📜 Activité Récente</h3>
        {activity.length === 0 ? (
          <p className="text-gray-500">Aucune activité récente.</p>
        ) : (
          <ul className="divide-y">
            {activity.map((act, index) => (
              <ActivityItem key={index} {...act} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
