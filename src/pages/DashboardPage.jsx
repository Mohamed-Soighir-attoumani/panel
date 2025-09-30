// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import IncidentsChart from "../components/IncidentsChart";
import DevicesTable from "../components/DevicesTable";
import api from "../api";

ChartJS.register(...registerables, ChartDataLabels);

const nf = new Intl.NumberFormat("fr-FR");

// Normalise les libellés de type
function canonicalizeLabel(raw) {
  if (!raw) return { key: "inconnu", label: "Inconnu" };
  const s = String(raw).trim();
  const key = s.toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return { key, label };
}

function buildHeaders(me) {
  const headers = {};
  if (me?.role === "admin" && me?.communeId) {
    headers["x-commune-id"] = me.communeId;
  }
  if (me?.role === "superadmin") {
    const selectedCid =
      (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || "";
    if (selectedCid) headers["x-commune-id"] = selectedCid;
  }
  return headers;
}

// 🔥 Lecture instantanée du cache utilisateur
function readCachedMe() {
  try {
    const raw = localStorage.getItem("me");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const DashboardPage = () => {
  // 👉 me est immédiatement rempli si présent en cache (donc rendu instantané)
  const cached = readCachedMe();
  const [me, setMe] = useState(cached);
  const [loadingMe, setLoadingMe] = useState(!cached);

  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [period, setPeriod] = useState("7"); // "7" | "30" | "all"
  const [activity, setActivity] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);

  const [bannerError, setBannerError] = useState("");

  // Revalidation silencieuse de /me en arrière-plan
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("me", { timeout: 15000, validateStatus: () => true });
        if (cancelled) return;

        if (res.status === 200) {
          const user = res?.data?.user || res?.data || null;
          if (user) {
            setMe(user);
            localStorage.setItem("me", JSON.stringify(user));
            setBannerError("");
          } else {
            throw new Error("Réponse /me inattendue");
          }
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("token_orig");
          localStorage.removeItem("me");
          window.location.href = "/login";
          return;
        } else {
          // on garde me du cache si dispo, on signale juste l’erreur
          setBannerError(`Impossible de vérifier la session (HTTP ${res.status}).`);
        }
      } catch (e) {
        // pas de redirection si on a déjà me en cache
        if (!cached) {
          setBannerError("Erreur réseau/CORS lors de la vérification de session.");
        }
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // une seule fois au montage

  const handleAuthError = useCallback((err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      localStorage.removeItem("me");
      window.location.href = "/login";
      return true;
    }
    return false;
  }, []);

  const fetchData = useCallback(async () => {
    if (!me) return; // on a besoin de me (cache ou réseau)
    const headers = buildHeaders(me);
    const qs = period === "all" ? "" : `?period=${period}`;

    let incOk = false;
    let notifOk = false;

    try {
      const incidentRes = await api.get(`incidents${qs}`, {
        headers,
        validateStatus: () => true,
      });
      if (incidentRes.status === 200) {
        const d = incidentRes.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setIncidents(arr);
        incOk = true;
      } else if (incidentRes.status === 404) {
        setIncidents([]);
        incOk = true;
      } else if (!handleAuthError({ response: { status: incidentRes.status } })) {
        setIncidents([]);
      }
    } catch (err) {
      if (!handleAuthError(err)) setIncidents([]);
    }

    try {
      const notifRes = await api.get(`notifications`, {
        headers,
        validateStatus: () => true,
      });
      if (notifRes.status === 200) {
        const d = notifRes.data;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setNotifications(arr);
        notifOk = true;
      } else if (notifRes.status === 404) {
        setNotifications([]);
        notifOk = true;
      } else if (!handleAuthError({ response: { status: notifRes.status } })) {
        setNotifications([]);
      }
    } catch (err) {
      if (!handleAuthError(err)) setNotifications([]);
    }

    try {
      const nextActivity = [
        ...(incOk ? incidents : []).slice(0, 3).map((inc) => {
          const t = inc?.type || inc?.title || "Inconnu";
          return {
            type: "incident",
            text: `Incident "${t}" signalé`,
            time: inc?.createdAt ? new Date(inc.createdAt).toLocaleString("fr-FR") : "Date inconnue",
          };
        }),
        ...(notifOk ? notifications : []).slice(0, 3).map((notif) => ({
          type: "notification",
          text: `Notification: ${notif?.title || notif?.message || "Sans titre"}`,
          time: notif?.createdAt ? new Date(notif.createdAt).toLocaleString("fr-FR") : "Date inconnue",
        })),
      ];
      setActivity(nextActivity);
    } catch {
      setActivity([]);
    }

    if (!incOk && !notifOk) {
      setBannerError("Erreur lors du chargement des données.");
    } else {
      setBannerError((prev) =>
        prev && prev.includes("chargement des données") ? "" : prev
      );
    }
  }, [handleAuthError, me, period, incidents, notifications]);

  const fetchDeviceCount = useCallback(async () => {
    if (!me) return;
    try {
      const headers = buildHeaders(me);

      const res = await api.get(`devices/count?activeDays=30`, {
        headers,
        validateStatus: () => true,
      });

      if (res.status === 200 && res.data && typeof res.data.count === "number") {
        setDeviceCount(res.data.count);
        setBannerError((prev) => (prev?.includes("utilisateurs") ? "" : prev));
        return;
      }

      if (res.status === 404) {
        const fallback = await api.get(`devices?page=1&pageSize=1`, {
          headers,
          validateStatus: () => true,
        });
        if (fallback.status === 200 && typeof fallback.data?.total === "number") {
          setDeviceCount(fallback.data.total);
          setBannerError((prev) => (prev?.includes("utilisateurs") ? "" : prev));
          return;
        }
      }

      if (!handleAuthError({ response: { status: res.status } })) {
        // silencieux
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        // silencieux
      }
    }
  }, [handleAuthError, me]);

  // ⚡ Si on a me en cache, on peut lancer tout de suite les fetchs (pas d’attente)
  useEffect(() => {
    if (!loadingMe && me) {
      fetchData();
      fetchDeviceCount();
      const interval = setInterval(() => {
        fetchData();
        fetchDeviceCount();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [loadingMe, me, fetchData, fetchDeviceCount]);

  // ==== Répartition par types
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

  // 💡 On n’affiche plus d’écran “Chargement…” si on a un cache.
  //    Au pire (premier chargement sans cache), on garde l’ancien fallback.
  if (loadingMe && !me) {
    return <div className="p-6">Chargement…</div>;
  }

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
          {me?.role === "superadmin" && (
            <input
              placeholder="Filtrer communeId (laisser vide = toutes)"
              className="border px-2 py-1 rounded w-full sm:w-64"
              defaultValue={localStorage.getItem("selectedCommuneId") || ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) localStorage.setItem("selectedCommuneId", v);
                else localStorage.removeItem("selectedCommuneId");
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
