// src/components/IncidentsChart.jsx
import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";

ChartJS.register(...registerables);

const nf = new Intl.NumberFormat("fr-FR");
const dfDay = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
const dfMonthShort = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const dfMonthLong = new Intl.DateTimeFormat("fr-FR", { month: "long" });

/** Renvoie un tableau de dates (locales) entre start et end inclus, pas à pas en jours */
function eachDayInclusive(start, end) {
  const out = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Clé de jour YYYY-MM-DD */
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Clé de mois YYYY-MM */
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Derniers 12 mois glissants (fin = maintenant) */
function last12Months() {
  const arr = [];
  const end = new Date();
  const base = new Date(end.getFullYear(), end.getMonth(), 1); // début du mois courant
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    arr.push(d);
  }
  return arr; // 12 dates au 1er de chaque mois, du plus ancien au plus récent
}

/** Construit une série temporelle prête pour ChartJS */
function buildTimeSeries(incidents, period) {
  // Sécurise : garde uniquement les incidents avec createdAt valide
  const safe = (Array.isArray(incidents) ? incidents : []).filter((it) => {
    const t = it?.createdAt ? Date.parse(it.createdAt) : NaN;
    return Number.isFinite(t);
  });

  if (period === "all") {
    // 12 derniers mois glissants, remplissage à 0
    const months = last12Months();
    const counts = new Map(months.map((d) => [monthKey(d), 0]));

    for (const inc of safe) {
      const d = new Date(inc.createdAt);
      const key = monthKey(d);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    const keys = months.map((d) => monthKey(d));
    const displayLabels = months.map((d, i, arr) => {
      // Ajoute l’année sur le premier mois et quand on change d’année (lisibilité)
      const label = dfMonthLong.format(d); // "janvier", ...
      const prev = i > 0 ? arr[i - 1] : null;
      const showYear = !prev || prev.getFullYear() !== d.getFullYear();
      return showYear ? `${label} ${d.getFullYear()}` : label;
    });
    const data = keys.map((k) => counts.get(k) || 0);
    return { labels: displayLabels, data, unit: "mois" };
  }

  // period = '7' ou '30' -> fenêtre glissante terminant aujourd’hui, remplie jour par jour
  const windowDays = period === "30" ? 30 : 7;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (windowDays - 1));

  const days = eachDayInclusive(start, end);
  const counts = new Map(days.map((d) => [dayKey(d), 0]));

  for (const inc of safe) {
    const d = new Date(inc.createdAt);
    // si dans la fenêtre
    if (d >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
        d <= new Date(end.getFullYear(), end.getMonth(), end.getDate())) {
      const key = dayKey(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const labels = days.map((d) => dfDay.format(d)); // ex: "05 sept."
  const data = days.map((d) => counts.get(dayKey(d)) || 0);
  return { labels, data, unit: "jour" };
}

export default function IncidentsChart({ incidents = [], period = "7" }) {
  const { labels, data, unit } = useMemo(
    () => buildTimeSeries(incidents, period),
    [incidents, period]
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: `Incidents par ${unit}`,
          data,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
        },
      ],
    }),
    [labels, data, unit]
  );

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    animation: { duration: 600, easing: "easeInOutQuart" },
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
      {labels.length === 0 ? (
        <p className="text-gray-500">Aucune donnée pour la période choisie.</p>
      ) : (
        <Line data={chartData} options={options} />
      )}
    </div>
  );
}
