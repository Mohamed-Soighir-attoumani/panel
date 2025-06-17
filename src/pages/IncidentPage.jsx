// ✅ Version Améliorée : IncidentPage.jsx avec filtres + carte globale + notification sonore

import L from "leaflet";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const IncidentMap = ({ latitude, longitude }) => (
  <MapContainer
    center={[latitude, longitude]}
    zoom={13}
    style={{ height: 200, zIndex: 1 }}
    className="rounded-md mb-3"
  >
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Marker position={[latitude, longitude]}>
      <Popup>Incident signalé ici</Popup>
    </Marker>
  </MapContainer>
);

const GlobalIncidentMap = ({ incidents }) => {
  if (!incidents || incidents.length === 0) return null;
  const center = [incidents[0].latitude || 0, incidents[0].longitude || 0];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "400px", marginBottom: "2rem" }}
      className="rounded-md"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {incidents.map((incident) =>
        incident.latitude && incident.longitude ? (
          <Marker
            key={incident._id}
            position={[incident.latitude, incident.longitude]}
          >
            <Popup>
              <strong>{incident.title}</strong>
              <br />
              {incident.lieu}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
};

const IncidentPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editIncidentId, setEditIncidentId] = useState(null);
  const [editedIncident, setEditedIncident] = useState({});
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [periodFilter, setPeriodFilter] = useState("");

  const lastIncidentIdRef = useRef(null);
  const audioRef = useRef(null);
  const isAudioAllowedRef = useRef(false);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.load();

    const handleUserInteraction = () => {
      isAudioAllowedRef.current = true;
      document.removeEventListener("click", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);
    fetchIncidents();

    const interval = setInterval(fetchIncidents, 5000);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleUserInteraction);
    };
  }, [statusFilter, periodFilter]);

  const playNotificationSound = () => {
    if (audioRef.current && isAudioAllowedRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => console.error("Erreur lecture son :", err));
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await axios.get("https://backend-admin-tygd.onrender.com/api/incidents", {
        params: { period: periodFilter },
      });
      let data = [...response.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (statusFilter !== "Tous") {
        data = data.filter((item) => item.status === statusFilter);
      }

      if (data.length > 0) {
        const newestId = data[0]._id;
        if (lastIncidentIdRef.current && newestId !== lastIncidentIdRef.current) {
          playNotificationSound();
        }
        lastIncidentIdRef.current = newestId;
      }

      setIncidents(data);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement incidents :", error);
      setError("Impossible de charger les incidents.");
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet incident ?")) return;
    try {
      await axios.delete(`https://backend-admin-tygd.onrender.com/api/incidents/${id}`);
      fetchIncidents();
    } catch (error) {
      console.error("Erreur suppression :", error);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleEditClick = (incident) => {
    setEditIncidentId(incident._id);
    setEditedIncident({
      title: incident.title,
      description: incident.description,
      lieu: incident.lieu,
      status: incident.status,
      adminComment: incident.adminComment || "",
    });
  };

  const handleEditChange = (e) => {
    setEditedIncident({ ...editedIncident, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`https://backend-admin-tygd.onrender.com/api/incidents/${editIncidentId}`,
        editedIncident,
        { headers: { "Content-Type": "application/json" } }
      );
      setEditIncidentId(null);
      fetchIncidents();
    } catch (error) {
      console.error("Erreur mise à jour :", error);
      alert("Erreur lors de la mise à jour.");
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">
        🛠️ Incidents signalés
      </h1>

      {/* Filtres */}
      <div className="flex gap-4 mb-6">
        <select onChange={(e) => setStatusFilter(e.target.value)} className="input">
          <option value="Tous">Tous les statuts</option>
          <option value="En cours">En cours</option>
          <option value="En attente">En attente</option>
          <option value="Résolu">Résolu</option>
          <option value="Rejeté">Rejeté</option>
        </select>

        <select onChange={(e) => setPeriodFilter(e.target.value)} className="input">
          <option value="">Toute période</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>
      </div>

      {/* Carte globale */}
      <GlobalIncidentMap incidents={incidents} />

      {/* Liste des incidents */}
      {incidents.length === 0 ? (
        <p className="text-gray-500">Aucun incident pour le moment.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {incidents.map((incident) => (
            <div key={incident._id} className="bg-white p-5 rounded-xl shadow-md border">
              {editIncidentId === incident._id ? (
                <>
                  <input name="title" value={editedIncident.title} onChange={handleEditChange} className="input mb-2" placeholder="Titre" />
                  <textarea name="description" value={editedIncident.description} onChange={handleEditChange} className="input mb-2" placeholder="Description" />
                  <input name="lieu" value={editedIncident.lieu} onChange={handleEditChange} className="input mb-2" placeholder="Lieu" />
                  <select name="status" value={editedIncident.status} onChange={handleEditChange} className="input mb-2">
                    <option value="En cours">En cours</option>
                    <option value="En attente">En attente</option>
                    <option value="Résolu">Résolu</option>
                    <option value="Rejeté">Rejeté</option>
                  </select>
                  <textarea name="adminComment" value={editedIncident.adminComment} onChange={handleEditChange} className="input mb-2" placeholder="Commentaire" />
                  <button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md w-full mt-2">💾 Enregistrer</button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold mb-1">{incident.title}</h2>
                  <p className="text-gray-700 mb-2">{incident.description}</p>
                  <p className="text-sm text-gray-500 italic mb-1">📍 {incident.lieu}</p>
                  <p className="text-sm text-blue-600 font-medium mb-1">📌 {incident.status}</p>
                  <p className="text-sm text-gray-600 mb-1">📫 {incident.adresse || "Adresse inconnue"}</p>
                  <p className="text-xs text-gray-400">🕒 {new Date(incident.createdAt).toLocaleString()}</p>
                  {incident.latitude && incident.longitude && (
                    <>
                      <p className="text-sm text-gray-600 mb-2">📡 {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</p>
                      <IncidentMap latitude={incident.latitude} longitude={incident.longitude} />
                    </>
                  )}
                  <p className="text-sm text-gray-700 mb-2">📝 {incident.adminComment || <em className="text-gray-400">Aucun commentaire</em>}</p>
                  <div className="mt-3">
                    {incident.photoUri ? (
                      <a href={incident.photoUri} target="_blank" rel="noopener noreferrer">
                        <img src={incident.photoUri} alt="photo" className="w-full h-40 object-cover rounded-lg border" />
                      </a>
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-sm">Pas de photo</div>
                    )}
                  </div>
                  <div className="flex justify-between gap-2 mt-4">
                    <button onClick={() => handleEditClick(incident)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md w-full">✏️ Modifier</button>
                    <button onClick={() => handleDelete(incident._id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md w-full">🗑️ Supprimer</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncidentPage;
