import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";

const IncidentsChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get("https://backend-admin-tygd.onrender.com/api/incidents");

      // Regrouper les incidents par mois
      const incidentsByMonth = Array(12).fill(0); // index 0 = janvier, 11 = décembre

      res.data.forEach((incident) => {
        const date = new Date(incident.createdAt);
        const monthIndex = date.getMonth(); // 0 à 11
        incidentsByMonth[monthIndex]++;
      });

      // Générer les données pour Recharts
      const chartData = incidentsByMonth.map((count, index) => ({
        month: new Date(2025, index).toLocaleString('fr-FR', { month: 'short' }),
        incidents: count,
      }));

      setData(chartData);
    } catch (error) {
      console.error("Erreur chargement incidents :", error);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow mt-6">
      <h2 className="text-xl font-semibold mb-4">📈 Incidents au Fil du Temps</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="incidents"
            name="Nombre d'incidents"
            stroke="#00bcd4"
            strokeWidth={3}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IncidentsChart;
