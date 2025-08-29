import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";

ChartJS.register(...registerables);

/** Construit une série temporelle :
 * - par jour si period === '7' ou '30'
 * - par mois si period === 'all'
 */
function buildTimeSeries(incidents, period) {
  const map = new Map(); // key -> count

  for (const inc of incidents) {
    if (!inc?.createdAt) continue;
    const d = new Date(inc.createdAt);

    let key;
    if (period === "7" || period === "30") {
      // Jour
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    } else {
      // Mois
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    map.set(key, (map.get(key) || 0) + 1);
  }

  const labels = Array.from(map.keys()).sort();
  const data = labels.map((k) => map.get(k));
  return { labels, data };
}

export default function IncidentsChart({ incidents = [], period = "7" }) {
  const { labels, data } = useMemo(
    () => buildTimeSeries(incidents, period),
    [incidents, period]
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: period === "all" ? "Incidents par mois" : "Incidents par jour",
          data,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
      ],
    }),
    [labels, data, period]
  );

  const options = {
    animation: { duration: 600, easing: "easeInOutQuart" },
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { autoSkip: true, maxRotation: 0 } },
      y: { beginAtZero: true, precision: 0 },
    },
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-8">
      <h3 className="text-lg sm:text-xl font-semibold mb-4">📈 Évolution des incidents</h3>
      {labels.length === 0 ? (
        <p className="text-gray-500">Aucune donnée pour la période choisie.</p>
      ) : (
        <Line data={chartData} options={options} />
      )}
    </div>
  );
}
