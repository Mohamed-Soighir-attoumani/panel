import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";

ChartJS.register(...registerables);

const nf = new Intl.NumberFormat("fr-FR");
const dfDay = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
const dfMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** Construit une série temporelle :
 * - par jour si period === '7' ou '30'
 * - par mois si period === 'all'
 * Retourne aussi des labels affichés localisés en français.
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

  const keys = Array.from(map.keys()).sort();

  // Labels localisés
  const displayLabels = keys.map((k) => {
    if (k.length === 7) {
      // YYYY-MM
      const [y, m] = k.split("-").map(Number);
      return dfMonth.format(new Date(y, m - 1, 1));
    } else {
      // YYYY-MM-DD
      const [y, m, d] = k.split("-").map(Number);
      return dfDay.format(new Date(y, m - 1, d));
    }
  });

  const data = keys.map((k) => map.get(k));
  return { keys, displayLabels, data };
}

export default function IncidentsChart({ incidents = [], period = "7" }) {
  const { displayLabels, data } = useMemo(
    () => buildTimeSeries(incidents, period),
    [incidents, period]
  );

  const chartData = useMemo(
    () => ({
      labels: displayLabels,
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
    [displayLabels, data, period]
  );

  const options = {
    maintainAspectRatio: false,
    animation: { duration: 600, easing: "easeInOutQuart" },
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y ?? 0;
            return `${ctx.dataset.label}: ${nf.format(v)}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { autoSkip: true, maxRotation: 0 } },
      y: {
        beginAtZero: true,
        precision: 0,
        ticks: {
          callback: (v) => nf.format(v),
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-8" style={{ height: 360 }}>
      <h3 className="text-lg sm:text-xl font-semibold mb-4">📈 Évolution des incidents</h3>
      {displayLabels.length === 0 ? (
        <p className="text-gray-500">Aucune donnée pour la période choisie.</p>
      ) : (
        <Line data={chartData} options={options} />
      )}
    </div>
  );
}
