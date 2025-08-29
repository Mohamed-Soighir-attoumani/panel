import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";

ChartJS.register(...registerables);

const nf = new Intl.NumberFormat("fr-FR");
const dfDay = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
const dfMonthName = new Intl.DateTimeFormat("fr-FR", { month: "long" });

/** Génère les 12 clés YYYY-MM pour l'année donnée */
function yearMonthKeys(year) {
  const arr = [];
  for (let m = 1; m <= 12; m++) {
    arr.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return arr;
}

/** Construit une série temporelle :
 * - period === '7' ou '30' -> par jour (sans remplissage)
 * - period === 'all'       -> 12 mois Jan→Déc de l'année courante (remplissage à 0)
 */
function buildTimeSeries(incidents, period) {
  if (period === "all") {
    const now = new Date();
    const year = now.getFullYear();

    // Dictionnaire mois de l’année courante initialisé à 0
    const monthMap = new Map(yearMonthKeys(year).map((k) => [k, 0]));

    // On n’incrémente que pour les incidents de l’année courante
    for (const inc of incidents) {
      if (!inc?.createdAt) continue;
      const d = new Date(inc.createdAt);
      if (d.getFullYear() !== year) continue;
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }

    const keys = Array.from(monthMap.keys()); // déjà Jan→Déc
    const displayLabels = keys.map((k) => {
      const [, m] = k.split("-").map(Number);
      return dfMonthName.format(new Date(year, m - 1, 1)); // "janvier", ...
    });
    const data = keys.map((k) => monthMap.get(k) || 0);
    return { keys, displayLabels, data, unit: "mois" };
  }

  // Cas '7' | '30' -> groupement par jour (sans remplissage)
  const dayMap = new Map(); // YYYY-MM-DD -> count
  for (const inc of incidents) {
    if (!inc?.createdAt) continue;
    const d = new Date(inc.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const keys = Array.from(dayMap.keys()).sort();
  const displayLabels = keys.map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return dfDay.format(new Date(y, m - 1, d));
  });
  const data = keys.map((k) => dayMap.get(k));
  return { keys, displayLabels, data, unit: "jour" };
}

export default function IncidentsChart({ incidents = [], period = "7" }) {
  const { displayLabels, data, unit } = useMemo(
    () => buildTimeSeries(incidents, period),
    [incidents, period]
  );

  const chartData = useMemo(
    () => ({
      labels: displayLabels,
      datasets: [
        {
          label: `Incidents par ${unit}`,
          data,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
      ],
    }),
    [displayLabels, data, unit]
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
        ticks: { callback: (v) => nf.format(v) },
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
