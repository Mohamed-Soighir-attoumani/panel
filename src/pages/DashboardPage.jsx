// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import IncidentsChart from "../components/IncidentsChart";
import DevicesTable from "../components/DevicesTable";
import { API_URL } from "../config";

ChartJS.register(...registerables, ChartDataLabels);

// Normalise les libellés de type (déduplication insensible à la casse/espaces)
function canonicalizeLabel(raw) {
  if (!raw) return { key: "inconnu", label: "Inconnu" };
  const s = String(raw).trim();
  const key = s.toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return { key, label };
}

const DashboardPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [period, setPeriod] = useState("7"); // "7" | "30" | "all"
  const [activity, setActivity] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [incidentTotal, setIncidentTotal] = useState(0);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const handleAuthError = (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      window.location.href = "/login";
      return true;
    }
    return false;
  };

  const fetchData = async () => {
    try {
      // si "all", on ne filtre pas; sinon on passe ?period=7|30
      const qs = period === "all" ? "" : `?period=${period}`;

      const [incidentRes, notifRes, totalRes] = await Promise.all([
        axios.get(`${API_URL}/api/incidents${qs}`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/notifications`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/incidents/count${qs}`, {
          headers: authHeaders,
        }),
      ]);

      const realIncidents = Array.isArray(incidentRes.data)
        ? incidentRes.data
        : [];
      const realNotifications = Array.isArray(notifRes.data)
        ? notifRes.data
        : [];
      const total = totalRes.data?.total || 0;

      setIncidents(realIncidents);
      setNotifications(realNotifications);
      setIncidentTotal(total);

      setActivity([
        ...realIncidents.slice(0, 3).map((inc) => {
          const t = inc.type || inc.title || "Inconnu";
          return {
            type: "incident",
            text: `Incident "${t}" signalé`,
            time: inc.createdAt
              ? new Date(inc.createdAt).toLocaleString()
              : "Date inconnue",
          };
        }),
        ...realNotifications.slice(0, 3).map((notif) => ({
          type: "notification",
          text: `Notification: ${notif.title || notif.message || "Sans titre"}`,
          time: notif.createdAt
            ? new Date(notif.createdAt).toLocaleString()
            : "Date inconnue",
        })),
      ]);
    } catch (err) {
      if (!handleAuthError(err)) {
        console.error("Erreur fetchData:", err);
      }
    }
  };

  const fetchDeviceCount = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/devices/count`, {
        headers: authHeaders,
      });
      if (res.data && typeof res.data.count === "number") {
        setDeviceCount(res.data.count);
      } else {
        console.warn("Réponse device count inattendue:", res.data);
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        console.error("Erreur fetchDeviceCount:", err);
      }
    }
  };

  useEffect(() => {
    fetchData();
    fetchDeviceCount();
    const interval = setInterval(() => {
      fetchData();
      fetchDeviceCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [period, token]);

  // ==== Série temporelle
  const dynamicChartData = useMemo(() => {
    const monthMap = {};
    incidents.forEach((inc) => {
      if (inc.createdAt) {
        const d = new Date(inc.createdAt);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        monthMap[k] = (monthMap[k] || 0) + 1;
      }
    });
    const labels = Object.keys(monthMap).sort();
    const data = labels.map((k) => monthMap[k]);
    return { labels, data };
  }, [incidents]);

  const lineChartOptions = {
    animation: { duration: 1000, easing: "easeInOutQuart" },
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
  };

  // ==== Répartition par types (vraies catégories dynamiques)
  const { typeLabels, typeCounts } = useMemo(() => {
    const map = new Map(); // key -> { label, count }
    for (const inc of incidents) {
      const raw = inc.type || inc.title || "Inconnu";
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
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      datalabels: {
        anchor: "end",
        align: "top",
        color: "#000",
        font: { weight: "bold", size: 12 },
        formatter: (value) => value,
      },
    },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 40, minRotation: 0 } },
      y: { beginAtZero: true, precision: 0 },
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
          formatter: (value) => value,
        },
      },
    ],
  };

  const KpiCard = ({ icon, label, value, color }) => (
    <div className="bg-white p-3 sm:p-4 rounded shadow text-center hover:shadow-lg transition duration-300 text-sm sm:text-base">
      <div className="text-2xl sm:text-3xl mb-1">{icon}</div>
      <p className="text-gray-500 text-xs sm:text-sm">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
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

  return (
    <div className="p-4 sm:p-6">
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
          <button
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full sm:w-auto transition"
          >
            🔄 Rafraîchir
          </button>
        </div>
      </div>

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
        <KpiCard
          icon="📋"
          label="Incidents TOTAL"
          value={incidents.length}
          color="text-blue-600"
        />
        <KpiCard
          icon="🔔"
          label="Notifications"
          value={notifications.length}
          color="text-purple-600"
        />
        <KpiCard
          icon="👥"
          label="Utilisateurs"
          value={deviceCount}
          color="text-gray-800"
        />
      </div>

      <IncidentsChart />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">


          {typeLabels.length === 0 ? (
            <p className="text-gray-500">Aucun incident pour la période choisie.</p>
          ) : (
            <Bar data={barChartData} options={barChartOptions} plugins={[ChartDataLabels]} />
          )}
        </div>
  

      <div className="mt-6">
        <DevicesTable />
      </div>

      <div className="bg-white p-4 shadow rounded">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">
          📜 Activité Récente
        </h3>
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
