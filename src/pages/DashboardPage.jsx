import React, { useState, useEffect } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";
import IncidentsChart from "../components/IncidentsChart";

const DashboardPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [period, setPeriod] = useState("7");
  const [activity, setActivity] = useState([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [incidentTotal, setIncidentTotal] = useState(0);

  const fetchData = async () => {
    try {
      const incidentRes = await axios.get(`http://localhost:4000/api/incidents?period=${period}`);
      const realIncidents = Array.isArray(incidentRes.data) ? incidentRes.data : [];

      const notifRes = await axios.get(`http://localhost:4000/api/notifications?period=${period}`);
      const realNotifications = Array.isArray(notifRes.data) ? notifRes.data : [];

      const totalRes = await axios.get(`http://localhost:4000/api/incidents/count?period=${period}`);
      const total = totalRes.data?.total || 0;

      setIncidents(realIncidents);
      setNotifications(realNotifications);
      setIncidentTotal(total);

      setActivity([
        ...realIncidents.slice(0, 3).map(inc => ({
          type: "incident",
          text: `Incident \"${inc.type}\" signalé`,
          time: inc.createdAt ? new Date(inc.createdAt).toLocaleString() : "Date inconnue"
        })),
        ...realNotifications.slice(0, 3).map(notif => ({
          type: "notification",
          text: `Notification: ${notif.title || notif.message || "Sans titre"}`,
          time: notif.createdAt ? new Date(notif.createdAt).toLocaleString() : "Date inconnue"
        }))
      ]);
    } catch (err) {
      console.error("Erreur fetchData:", err);
    }
  };

  const fetchDeviceCount = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/devices/count");
      if (res.data && typeof res.data.count === "number") {
        setDeviceCount(res.data.count);
      } else {
        console.warn("Réponse device count inattendue:", res.data);
      }
    } catch (err) {
      console.error("Erreur fetchDeviceCount:", err);
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
  }, [period]);

  const groupIncidentsByMonth = () => {
    const monthMap = {};

    incidents.forEach(inc => {
      if (inc.createdAt) {
        const date = new Date(inc.createdAt);
        const monthLabel = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        monthMap[monthLabel] = (monthMap[monthLabel] || 0) + 1;
      }
    });

    const sortedMonths = Object.keys(monthMap).sort();
    const counts = sortedMonths.map(month => monthMap[month]);

    return { labels: sortedMonths, data: counts };
  };

  const dynamicChartData = groupIncidentsByMonth();

  const chartOptions = {
    animation: { duration: 1000, easing: "easeInOutQuart" },
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
  };

  const barChartData = {
    labels: ["Incendie", "Accident", "Vol"],
    datasets: [
      {
        label: "Répartition des incidents",
        data: [
          incidents.filter(i => i.type === "Incendie").length,
          incidents.filter(i => i.type === "Accident").length,
          incidents.filter(i => i.type === "Vol").length,
        ],
        backgroundColor: [
          "rgba(255, 99, 132, 0.5)",
          "rgba(54, 162, 235, 0.5)",
          "rgba(255, 206, 86, 0.5)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const KpiCard = ({ icon, label, value, color }) => (
    <div className="bg-white p-2 sm:p-3 rounded shadow text-center hover:shadow-lg transition duration-300 text-sm sm:text-base">
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
    <div className="p-6">
      {/* Titre et contrôles alignés */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold">📊 Tableau de bord</h1>
        <div className="flex items-center gap-4">
          <label className="font-medium">📅 Période :</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border px-2 py-1 rounded"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
          </select>
          <button
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard icon="🚨" label="Incidents EN COURS" value={incidents.filter(i => i.status === "En cours").length} color="text-red-600" />
        <KpiCard icon="✅" label="Incidents RÉSOLUS" value={incidents.filter(i => i.status === "Résolu").length} color="text-green-600" />
        <KpiCard icon="📋" label="Incidents TOTAL" value={incidents.length} color="text-blue-600" />
        <KpiCard icon="🔔" label="Notifications" value={notifications.length} color="text-purple-600" />
        <KpiCard icon="👥" label="Utilisateurs" value={deviceCount} color="text-gray-800" />
      </div>

      {/* IncidentsChart */}
      <IncidentsChart />

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 shadow rounded col-span-1 xl:col-span-2">
          <h3 className="text-xl font-semibold mb-4">📈 Incidents au Fil du Temps</h3>
          <Line
            data={{
              labels: dynamicChartData.labels,
              datasets: [{
                label: "Nombre d'incidents",
                data: dynamicChartData.data,
                borderColor: "rgba(75, 192, 192, 1)",
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                tension: 0.3,
              }]
            }}
            options={chartOptions}
          />
        </div>

        <div className="bg-white p-4 shadow rounded">
          <h3 className="text-xl font-semibold mb-4">📊 Répartition des Incidents</h3>
          <Bar data={barChartData} options={chartOptions} />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white p-4 shadow rounded">
        <h3 className="text-xl font-semibold mb-4">📜 Activité Récente</h3>
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
