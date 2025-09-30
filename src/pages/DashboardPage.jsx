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

// Normalise une chaîne en clé canonique
const canonicalizeLabel = (raw) => {
  if (!raw) return { key: "inconnu", label: "Inconnu" };
  const s = String(raw).trim();
  const key = s.toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return { key, label };
};

const normCid = (id) => String(id || "").trim().toLowerCase();

// Commune à utiliser pour les requêtes
function getSelectedCommuneId(me) {
  if (!me) return "";
  if (me.role === "admin") return normCid(me.communeId);
  if (me.role === "superadmin") {
    const v = (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || "";
    return normCid(v);
  }
  return "";
}

function buildHeaders(me) {
  const headers = {};
  const cid = getSelectedCommuneId(me);
  if (cid) headers["x-commune-id"] = cid;
  return headers;
}

const DashboardPage = () => {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [period, setPeriod] = useState("7"); // "7" | "30" | "all"
  const [activity, setActivity] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);

  const [bannerError, setBannerError] = useState("");

  // Pour éviter les setState après un unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // charge /me depuis l'API (tolérant /api doublé)
  useEffect(() => {
    (async () => {
      try {
        let res = await api.get("/api/me", { timeout: 15000, validateStatus: () => true });
        if (res.status === 404) {
          try {
            res = await api.get("/me", { timeout: 15000, validateStatus: () => true });
          } catch (_) {}
        }
        if (res.status === 200) {
          const user = res?.data?.user || res?.data || null;
          if (!user) throw new Error("Réponse /me inattendue");
          if (!mountedRef.current) return;
          setMe(user);
          localStorage.setItem("me", JSON.stringify(user));
          setBannerError("");
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("token_orig");
          window.location.href = "/login";
          return;
        } else {
          const cached = localStorage.getItem("me");
          if (cached) setMe(JSON.parse(cached));
          setBannerError(`Impossible de vérifier la session (HTTP ${res.status}).`);
        }
      } catch (e) {
        const cached = localStorage.getItem("me");
        if (cached) setMe(JSON.parse(cached));
        setBannerError("Erreur réseau/CORS lors de la vérification de session.");
      } finally {
        if (mountedRef.current) setLoadingMe(false);
      }
    })();
  }, []);

  const handleAuthError = useCallback((err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      window.location.href = "/login";
      return true;
    }
    return false;
  }, []);

  // --- Récupération incidents + notifications (stable)
  const fetchData = useCallback(async () => {
    if (loadingMe) return;

    const headers = buildHeaders(me);
    const cid = getSelectedCommuneId(me);
    const qsPeriod = period === "all" ? "" : `period=${period}`;
    const qsCid = cid ? `communeId=${encodeURIComponent(cid)}` : "";
    const query = [qsPeriod, qsCid].filter(Boolean).join("&");
    const suffix = query ? `?${query}` : "";

    let incOk = false;
    let notifOk = false;

    // On récupère TOUT en parallèle
    try {
      const [incidentRes, notifRes] = await Promise.all([
        api.get(`/api/incidents${suffix}`, { headers, validateStatus: () => true }),
        api.get(`/api/notifications${cid ? `?communeId=${encodeURIComponent(cid)}` : ""}`, {
          headers,
          validateStatus: () => true,
        }),
      ]);

      // --- Incidents
      if (incidentRes.status === 200) {
        const d = incidentRes.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        if (mountedRef.current) setIncidents(arr);
        incOk = true;
      } else if (incidentRes.status === 404) {
        // fail-soft si endpoint absent
        if (mountedRef.current) setIncidents([]);
        incOk = true;
      } else if (!handleAuthError({ response: { status: incidentRes.status } })) {
        console.warn("[dashboard] incidents HTTP", incidentRes.status, incidentRes.data);
        if (mountedRef.current) setIncidents([]);
      }

      // --- Notifications
      if (notifRes.status === 200) {
        const d = notifRes.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        if (mountedRef.current) setNotifications(arr);
        notifOk = true;
      } else if (notifRes.status === 404) {
        if (mountedRef.current) setNotifications([]);
        notifOk = true;
      } else if (!handleAuthError({ response: { status: notifRes.status } })) {
        console.warn("[dashboard] notifications HTTP", notifRes.status, notifRes.data);
        if (mountedRef.current) setNotifications([]);
      }

      // Construire l'activité directement à partir des réponses (pas du state)
      const incForActivity =
        incidentRes?.status === 200
          ? (Array.isArray(incidentRes.data) ? incidentRes.data : incidentRes.data?.items) || []
          : [];
      const notifForActivity =
        notifRes?.status === 200
          ? (Array.isArray(notifRes.data) ? notifRes.data : notifRes.data?.items) || []
          : [];

      const nextActivity = [
        ...incForActivity.slice(0, 3).map((inc) => {
          const t = inc?.type || inc?.title || "Inconnu";
          return {
            type: "incident",
            text: `Incident "${t}" signalé`,
            time: inc?.createdAt ? new Date(inc.createdAt).toLocaleString("fr-FR") : "Date inconnue",
          };
        }),
        ...notifForActivity.slice(0, 3).map((notif) => ({
          type: "notification",
          text: `Notification: ${notif?.title || notif?.message || "Sans titre"}`,
          time: notif?.createdAt ? new Date(notif.createdAt).toLocaleString("fr-FR") : "Date inconnue",
        })),
      ];
      if (mountedRef.current) setActivity(nextActivity);
    } catch (err) {
      if (!handleAuthError(err)) {
        console.error("Erreur fetchData:", err);
        if (mountedRef.current) {
          setIncidents([]);
          setNotifications([]);
          setActivity([]);
        }
      }
    }

    // Bannière: afficher seulement si les 2 ont VRAIMENT échoué
    if (mountedRef.current) {
      if (!incOk && !notifOk) {
        setBannerError("Erreur lors du chargement des données.");
      } else {
        setBannerError((prev) => (prev && prev.includes("chargement des données") ? "" : prev));
      }
    }
  }, [handleAuthError, loadingMe, me, period]);

  // --- Compteur d'utilisateurs (robuste pour admin ET superadmin)
  const fetchDeviceCount = useCallback(async () => {
    if (loadingMe) return;
    const headers = buildHeaders(me);
    const cid = getSelectedCommuneId(me);

    // 1) Essai endpoint moderne count (avec header ET query pour maximiser la compatibilité)
    try {
      const url = `/api/devices/count?activeDays=30${cid ? `&communeId=${encodeURIComponent(cid)}` : ""}`;
      const res = await api.get(url, { headers, validateStatus: () => true });

      if (res.status === 200 && res.data && typeof res.data.count === "number") {
        if (mountedRef.current) setDeviceCount(res.data.count);
        if (mountedRef.current) {
          setBannerError((prev) => (prev?.includes("utilisateurs") ? "" : prev));
        }
        return;
      }

      // 2) Fallback si 404 ou 501/403 → pagination minimale pour lire "total"
      if ([404, 501, 403].includes(res.status)) {
        const url2 = `/api/devices?page=1&pageSize=1${cid ? `&communeId=${encodeURIComponent(cid)}` : ""}`;
        const fallback = await api.get(url2, { headers, validateStatus: () => true });
        if (fallback.status === 200 && typeof fallback.data?.total === "number") {
          if (mountedRef.current) setDeviceCount(fallback.data.total);
          if (mountedRef.current) {
            setBannerError((prev) => (prev?.includes("utilisateurs") ? "" : prev));
          }
          return;
        }

        // 3) Fallback absolu: si l’API renvoie une liste directe
        if (fallback.status === 200 && Array.isArray(fallback.data)) {
          if (mountedRef.current) setDeviceCount(fallback.data.length);
          return;
        }
      }

      if (!handleAuthError({ response: { status: res.status } })) {
        console.warn("devices/count indisponible, code:", res.status);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        console.error("Erreur fetchDeviceCount (count):", err);
      }
    }
  }, [handleAuthError, loadingMe, me]);

  // Lancer les fetchs + rafraîchissement périodique
  useEffect(() => {
    fetchData();
    fetchDeviceCount();

    const interval = setInterval(() => {
      fetchData();
      fetchDeviceCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, fetchDeviceCount]);

  // ==== Répartition par types (à partir du state incidents)
  const { typeLabels, typeCounts } = useMemo(() => {
    const map = new Map();
    for (const inc of incidents) {
      const raw = inc?.type || inc?.title || "Inconnu";
      const { key, label } = canonicalizeLabel(raw);
      const entry = map.get(key) || { label, count: 0 };
      entry.count += 1;
      map.set(key, entry);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return { typeLabels: arr.map((x) => x.label), typeCounts: arr.map((x) => x.count) };
  }, [incidents]);

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: { label: (ctx) => nf.format(ctx.parsed.y ?? 0) },
      },
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
      y: {
        beginAtZero: true,
        precision: 0,
        ticks: { callback: (v) => nf.format(v) },
      },
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

  if (loadingMe) {
    return <div className="p-6">Chargement…</div>;
  }

  const isSuperadmin = me?.role === "superadmin";
  const selectedCid = getSelectedCommuneId(me);

  return (
    <div className="p-4 sm:p-6">
      {bannerError && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 text-amber-800 p-3">
          {bannerError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left">
          📊 Tableau de bord
        </h1>

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

          {/* Sélecteur commune pour superadmin */}
          {isSuperadmin && (
            <input
              placeholder="Filtrer communeId (laisser vide = toutes)"
              className="border px-2 py-1 rounded w-full sm:w-64"
              defaultValue={selectedCid}
              onBlur={(e) => {
                const v = normCid(e.target.value);
                if (v) localStorage.setItem("selectedCommuneId", v);
                else localStorage.removeItem("selectedCommuneId");
                // rechargements ciblés
                fetchData();
                fetchDeviceCount();
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

      {/* 📈 Courbe du fil de temps */}
      <IncidentsChart incidents={incidents} period={period} />

      {/* 🧭 Répartition par types */}
      <div className="bg-white p-4 rounded shadow mb-8" style={{ height: 420 }}>
        <h3 className="text-lg sm:text-xl font-semibold mb-4">🧭 Répartition par types</h3>
        {typeLabels.length === 0 ? (
          <p className="text-gray-500">Aucun incident pour la période choisie.</p>
        ) : (
          <Bar data={barChartData} options={barChartOptions} plugins={[ChartDataLabels]} />
        )}
      </div>

      {/* Table des devices */}
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
