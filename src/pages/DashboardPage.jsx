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

// ---------- Helpers --------------------------------------------------------

function canonicalizeLabel(raw) {
  if (!raw) return { key: "inconnu", label: "Inconnu" };
  const s = String(raw).trim();
  const key = s.toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return { key, label };
}

function readCachedMe() {
  try {
    const raw = localStorage.getItem("me");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Commune “courante” utilisée UNIQUEMENT par le superadmin pour filtrer
function selectedCommuneForSuperadmin() {
  const v = (localStorage.getItem("selectedCommuneId") || "").toString().trim().toLowerCase();
  return v;
}

// Headers à envoyer (superadmin uniquement)
function buildHeaders(me) {
  const headers = {};
  if (me?.role === "superadmin") {
    const cid = selectedCommuneForSuperadmin();
    if (cid) headers["x-commune-id"] = cid;
  }
  return headers;
}

// GET /me avec fallback (/api/me -> /me)
async function tolerantGetMe() {
  try {
    const r1 = await api.get("/api/me", { validateStatus: () => true, timeout: 15000 });
    if (r1.status === 200 || r1.status === 401 || r1.status === 403) return r1;
  } catch (_) {}
  try {
    const r2 = await api.get("/me", { validateStatus: () => true, timeout: 15000 });
    return r2;
  } catch {
    return { status: 0, data: null };
  }
}

// Essaie plusieurs chemins + query
async function multiTryGet(basePaths, { headers, query = "" }) {
  const q = query ? (basePaths[0]?.includes("?") ? `&${query}` : `?${query}`) : "";
  for (const p of basePaths) {
    try {
      const res = await api.get(`${p}${q}`, { headers, validateStatus: () => true });
      if (res.status === 200) return res;
    } catch (_) {}
  }
  return null;
}

// --------------------------------------------------------------------------

const DashboardPage = () => {
  const cachedMe = readCachedMe();
  const [me, setMe] = useState(cachedMe);
  const [loadingMe, setLoadingMe] = useState(!cachedMe);

  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const [period, setPeriod] = useState("7");
  const [bannerError, setBannerError] = useState("");

  // Evite d’écraser l’état par des réponses lentes
  const lastFetchIdRef = useRef(0);
  const lastDevicesFetchIdRef = useRef(0);

  // Charge /me (avec cache)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await tolerantGetMe();
      if (cancelled) return;

      try {
        if (res.status === 200) {
          const user = res?.data?.user || res?.data || null;
          if (user) {
            setMe(user);
            localStorage.setItem("me", JSON.stringify(user));
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

  // Ne déconnecte que sur 401
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

  // Fait les requêtes incidents/notifications
  const fetchData = useCallback(async () => {
    if (!me) return;

    // Superadmin : peut filtrer via input ; Admin : AUCUN header/param commune ⇒ backend filtre par token
    const headers = buildHeaders(me);

    // period seulement ; le filtre commune, si superadmin a saisi, est dans header
    const qs = period === "all" ? "" : `period=${period}`;

    const fetchId = ++lastFetchIdRef.current;

    // --- incidents ---
    try {
      const incidentsRes =
        (await multiTryGet(["incidents", "/api/incidents"], { headers, query: qs })) ||
        (await multiTryGet(["incidents", "/api/incidents"], { headers: {}, query: qs })) ||
        null;

      if (fetchId !== lastFetchIdRef.current) return;

      if (incidentsRes && incidentsRes.status === 200) {
        const d = incidentsRes.data;
        const arr = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []);
        setIncidents(arr);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        // garder l’état existant
      }
    }

    // --- notifications ---
    try {
      const notifsRes =
        (await multiTryGet(["notifications", "/api/notifications"], { headers, query: qs })) ||
        (await multiTryGet(["notifications", "/api/notifications"], { headers: {}, query: qs })) ||
        null;

      if (fetchId !== lastFetchIdRef.current) return;

      if (notifsRes && notifsRes.status === 200) {
        const d = notifsRes.data;
        const arr = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []);
        setNotifications(arr);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        // silencieux
      }
    }
  }, [me, period, handleAuthError]);

  // Compteur d’utilisateurs (devices) — TOUJOURS le total global (countAll si dispo)
  const fetchDeviceCount = useCallback(async () => {
    if (!me) return;

    // Pour le KPI voulu, on ne veut PAS filtrer par commune : total global
    // On n’envoie donc pas x-commune-id ici, même pour superadmin.
    const headersNoFilter = {};
    const baseQuery = `activeDays=30`;
    const fetchId = ++lastDevicesFetchIdRef.current;

    try {
      const countRes =
        (await multiTryGet(["devices/count", "/api/devices/count"], { headers: headersNoFilter, query: baseQuery })) ||
        null;

      if (fetchId !== lastDevicesFetchIdRef.current) return;

      if (countRes && countRes.status === 200 && countRes.data) {
        const total =
          typeof countRes.data.countAll === "number"
            ? countRes.data.countAll
            : (typeof countRes.data.count === "number" ? countRes.data.count : 0);
        setDeviceCount(total);
        return;
      }

      // Fallback à la liste paginée (global)
      const listRes =
        (await multiTryGet(["devices", "/api/devices"], { headers: headersNoFilter, query: "page=1&pageSize=1" })) ||
        null;

      if (fetchId !== lastDevicesFetchIdRef.current) return;

      if (listRes && listRes.status === 200) {
        const total =
          typeof listRes.data?.total === "number"
            ? listRes.data.total
            : Array.isArray(listRes.data)
            ? listRes.data.length
            : 0;
        setDeviceCount(total);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        // ne pas mettre 0 si réseau HS
      }
    }
  }, [me, handleAuthError]);

  // bootstrap + polling
  useEffect(() => {
    if (!loadingMe && me) {
      fetchData();
      fetchDeviceCount();
      const i = setInterval(() => {
        fetchData();
        fetchDeviceCount();
      }, 30000);
      return () => clearInterval(i);
    }
  }, [loadingMe, me, fetchData, fetchDeviceCount]);

  // Activité récente (dérivée)
  useEffect(() => {
    const next = [
      ...incidents.slice(0, 3).map((inc) => ({
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
  }, [incidents, notifications]);

  // ---- Répartition types
  const { typeLabels, typeCounts } = useMemo(() => {
    const map = new Map();
    for (const inc of incidents) {
      const raw = inc?.type || inc?.title || "Inconnu";
      const { key, label } = canonicalizeLabel(raw);
      const e = map.get(key) || { label, count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return { typeLabels: arr.map((x) => x.label), typeCounts: arr.map((x) => x.count) };
  }, [incidents]);

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
        label: "Répartition des incidents (tous types)",
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

  // Bandeau informatif si manque de commune pour l’admin (cas rare)
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
            <input
              placeholder="Filtrer communeId (laisser vide = toutes)"
              className="border px-2 py-1 rounded w-full sm:w-64"
              defaultValue={selectedCommuneForSuperadmin() || ""}
              onBlur={(e) => {
                const v = e.target.value.trim().toLowerCase();
                if (v) localStorage.setItem("selectedCommuneId", v);
                else localStorage.removeItem("selectedCommuneId");
                // incidents/notifications filtrés pour superadmin selon input
                fetchData();
              }}
            />
          )}

          <button
            onClick={() => {
              fetchData();
              fetchDeviceCount();
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full sm:w-auto transition"
          >
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard
          icon="🚨"
          label="Incidents EN COURS"
          value={incidents.filter((i) => i.status === "En cours").length}
          color="text-red-600"
        />
        <KpiCard
          icon="✅"
          label="Incidents RÉSOLUS"
          value={incidents.filter((i) => i.status === "Résolu").length}
          color="text-green-600"
        />
        <KpiCard icon="📋" label="Incidents TOTAL" value={incidents.length} color="text-blue-600" />
        <KpiCard icon="🔔" label="Notifications" value={notifications.length} color="text-purple-600" />
        <KpiCard icon="👥" label="Utilisateurs" value={deviceCount} color="text-gray-800" />
      </div>

      {/* Courbe */}
      <IncidentsChart incidents={incidents} period={period} />

      {/* Répartition par types */}
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

      {/* Activité récente */}
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
