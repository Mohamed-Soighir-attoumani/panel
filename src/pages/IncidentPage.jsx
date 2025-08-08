import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { API_URL } from "../config";

const IncidentMap = ({ latitude, longitude }) => (
  <div className="mt-3 relative">
    <MapContainer
      center={[latitude, longitude]}
      zoom={13}
      style={{ height: 200, zIndex: 0 }}           // 👈 reste sous la navbar
      className="rounded-md mb-3"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[latitude, longitude]}>
        <Popup>📍 Incident signalé ici</Popup>
      </Marker>
    </MapContainer>
  </div>
);

// Détection robuste du média vidéo (fallback même si mediaType n'est pas fourni)
const isVideo = (incident) => {
  if (incident?.mediaType) return incident.mediaType === "video";
  const url = (incident?.mediaUrl || "").toLowerCase();
  return url.endsWith(".mp4") || url.endsWith(".mov") || url.endsWith(".webm") || url.includes("/video/upload/");
};

const IncidentPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
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

    const handleClick = () => {
      isAudioAllowedRef.current = true;
      document.removeEventListener("click", handleClick);
    };

    document.addEventListener("click", handleClick);
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);

    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, periodFilter]);

  const playNotificationSound = () => {
    if (audioRef.current && isAudioAllowedRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => console.error(err));
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/incidents`, {
        params: { period: periodFilter },
      });
      let data = [...res.data].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      if (statusFilter !== "Tous") {
        data = data.filter((item) => item.status === statusFilter);
      }

      if (data.length > 0 && data[0]._id !== lastIncidentIdRef.current) {
        playNotificationSound();
        lastIncidentIdRef.current = data[0]._id;
      }

      setIncidents(data);
      setLoading(false);
    } catch (err) {
      console.error("Erreur incidents :", err);
      setLoading(false);
    }
  };

  const handleEdit = (incident) => {
    setEditIncidentId(incident._id);
    setEditedIncident({
      title: incident.title,
      description: incident.description,
      lieu: incident.lieu,
      status: incident.status,
      adminComment: incident.adminComment || "",
    });
  };

  const handleChange = (e) => {
    setEditedIncident({ ...editedIncident, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${API_URL}/api/incidents/${editIncidentId}`, editedIncident);
      setEditIncidentId(null);
      fetchIncidents();
    } catch (err) {
      console.error("Erreur update :", err);
      alert("Erreur de mise à jour.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet incident ?")) return;
    try {
      await axios.delete(`${API_URL}/api/incidents/${id}`);
      fetchIncidents();
    } catch (err) {
      console.error("Erreur suppression :", err);
      alert("Erreur lors de la suppression.");
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  const sections = ["En attente", "En cours", "Résolu", "Rejeté"];

  return (
    <div className="pt-[80px] px-6 pb-6">{/* 👆 espace sous la navbar fixe */}
      <h1 className="text-3xl font-bold mb-6 text-gray-800">🛠️ Incidents signalés</h1>

      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="Tous">Tous</option>
          <option value="En attente">En attente</option>
          <option value="En cours">En cours</option>
          <option value="Résolu">Résolu</option>
          <option value="Rejeté">Rejeté</option>
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="input"
        >
          <option value="">Toutes dates</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>
      </div>

      {sections.map((section) => (
        <div key={section} className="mb-10">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">📂 {section}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incidents
              .filter((i) => i.status === section)
              .map((incident) => (
                <div key={incident._id} className="bg-white p-5 rounded-xl shadow-md border">
                  {editIncidentId === incident._id ? (
                    <>
                      <input
                        name="title"
                        value={editedIncident.title}
                        onChange={handleChange}
                        className="input mb-2"
                      />
                      <textarea
                        name="description"
                        value={editedIncident.description}
                        onChange={handleChange}
                        className="input mb-2"
                      />
                      <input
                        name="lieu"
                        value={editedIncident.lieu}
                        onChange={handleChange}
                        className="input mb-2"
                      />
                      <select
                        name="status"
                        value={editedIncident.status}
                        onChange={handleChange}
                        className="input mb-2"
                      >
                        <option value="En attente">En attente</option>
                        <option value="En cours">En cours</option>
                        <option value="Résolu">Résolu</option>
                        <option value="Rejeté">Rejeté</option>
                      </select>
                      <textarea
                        name="adminComment"
                        value={editedIncident.adminComment}
                        onChange={handleChange}
                        className="input mb-2"
                        placeholder="Commentaire"
                      />
                      <button
                        onClick={handleUpdate}
                        className="btn bg-green-600 text-white w-full"
                      >
                        💾 Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold">{incident.title}</h2>
                      <p className="text-gray-700">{incident.description}</p>
                      <p className="text-sm text-gray-500 mb-1">📍 {incident.lieu}</p>
                      <p className="text-sm text-blue-600 font-medium">📌 {incident.status}</p>
                      <p className="text-xs text-gray-500 mb-1">
                        📫 {incident.adresse || "Adresse inconnue"}
                      </p>
                      <p className="text-xs text-gray-400">
                        🕒 {new Date(incident.createdAt).toLocaleString()}
                      </p>

                      {incident.latitude && incident.longitude && (
                        <>
                          <p className="text-xs text-gray-600">
                            📡 {Number(incident.latitude).toFixed(5)},{" "}
                            {Number(incident.longitude).toFixed(5)}
                          </p>
                          <IncidentMap
                            latitude={Number(incident.latitude)}
                            longitude={Number(incident.longitude)}
                          />
                        </>
                      )}

                      <p className="text-sm text-gray-600 italic">
                        📝 {incident.adminComment || "Aucun commentaire"}
                      </p>

                      {/* Média (image/vidéo) */}
                      <div className="mt-3">
                        {incident.mediaUrl ? (
                          isVideo(incident) ? (
                            <video
                              key={incident._id}
                              controls
                              playsInline
                              className="w-full h-52 rounded-lg border"
                              src={incident.mediaUrl}
                            />
                          ) : (
                            <img
                              src={incident.mediaUrl}
                              alt="media"
                              className="w-full h-52 object-cover rounded-lg border"
                            />
                          )
                        ) : (
                          <div className="w-full h-52 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                            Pas de média
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between gap-2 mt-4">
                        <button
                          onClick={() => handleEdit(incident)}
                          className="btn bg-blue-600 text-white w-full"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(incident._id)}
                          className="btn bg-red-600 text-white w-full"
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default IncidentPage;
