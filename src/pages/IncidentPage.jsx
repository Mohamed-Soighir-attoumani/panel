import L from "leaflet";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const IncidentMap = ({ latitude, longitude }) => {
  return (
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
};

const IncidentPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editIncidentId, setEditIncidentId] = useState(null);
  const [editedIncident, setEditedIncident] = useState({});
  const lastIncidentIdRef = useRef(null);

  const audioRef = useRef(null);
  const isAudioAllowedRef = useRef(false); // 🚀 nouvelle ref

  useEffect(() => {
    // Précharger le son
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.load();

    // 🚀 Ecoute du premier clic utilisateur
    const handleUserInteraction = () => {
      isAudioAllowedRef.current = true;
      console.log("✅ Audio débloqué par l'utilisateur.");
      document.removeEventListener("click", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);

    fetchIncidents();

    const interval = setInterval(fetchIncidents, 5000);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleUserInteraction);
    };
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current && isAudioAllowedRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => console.log("✅ Son joué"))
        .catch((err) => console.error("Erreur lecture son :", err));
    } else {
      console.warn("⚠️ Son bloqué car aucune interaction utilisateur encore.");
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await axios.get("http://localhost:4000/api/incidents");
      const sortedIncidents = [...response.data].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      if (sortedIncidents.length > 0) {
        const newestId = sortedIncidents[0]._id;

        if (lastIncidentIdRef.current && newestId !== lastIncidentIdRef.current) {
          console.log("🔔 NOUVEAU INCIDENT !");
          playNotificationSound();
        }

        lastIncidentIdRef.current = newestId;
      }

      setIncidents(sortedIncidents);
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
      const res = await axios.delete(`http://localhost:4000/api/incidents/${id}`);
      if (res.status === 200) {
        fetchIncidents();
      }
    } catch (error) {
      console.error("Erreur suppression :", error.response?.data || error.message);
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
      await axios.put(
        `http://localhost:4000/api/incidents/${editIncidentId}`,
        editedIncident,
        { headers: { "Content-Type": "application/json" } }
      );
      setEditIncidentId(null);
      fetchIncidents();
    } catch (error) {
      console.error("Erreur mise à jour :", error.response?.data || error.message);
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

      {incidents.length === 0 ? (
        <p className="text-gray-500">Aucun incident pour le moment.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {incidents.map((incident) => (
            <div key={incident._id} className="bg-white p-5 rounded-xl shadow-md border">
              {editIncidentId === incident._id ? (
                <>
                  <input
                    name="title"
                    value={editedIncident.title}
                    onChange={handleEditChange}
                    className="input mb-2"
                    placeholder="Titre"
                  />
                  <textarea
                    name="description"
                    value={editedIncident.description}
                    onChange={handleEditChange}
                    className="input mb-2"
                    placeholder="Description"
                  />
                  <input
                    name="lieu"
                    value={editedIncident.lieu}
                    onChange={handleEditChange}
                    className="input mb-2"
                    placeholder="Lieu"
                  />
                  <select
                    name="status"
                    value={editedIncident.status}
                    onChange={handleEditChange}
                    className="input mb-2"
                  >
                    <option value="En cours">En cours</option>
                    <option value="En attente">En attente</option>
                    <option value="Résolu">Résolu</option>
                    <option value="Rejeté">Rejeté</option>
                  </select>
                  <textarea
                    name="adminComment"
                    value={editedIncident.adminComment}
                    onChange={handleEditChange}
                    className="input mb-2"
                    placeholder="Commentaire de l'administrateur"
                  />
                  <button
                    onClick={handleUpdate}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md w-full mt-2"
                  >
                    💾 Enregistrer
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold mb-1">{incident.title}</h2>
                  <p className="text-gray-700 mb-2">{incident.description}</p>
                  <p className="text-sm text-gray-500 italic mb-1">📍 {incident.lieu}</p>

                  <p className="text-sm text-gray-600 mb-2">
                    📫 <span className="font-medium">Adresse détectée :</span>{" "}
                    {incident.adresse ? incident.adresse : "Non disponible"}
                  </p>

                  <p className="text-sm font-medium text-blue-600 mb-1">📌 {incident.status}</p>
                  <p className="text-xs text-gray-400">
                    🕒 {new Date(incident.createdAt).toLocaleString()}
                  </p>

                  {incident.latitude && incident.longitude && (
                    <>
                      <p className="text-sm text-gray-600 mb-2">
                        📡 <span className="font-medium">Coordonnées :</span>{" "}
                        {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
                      </p>
                      <IncidentMap latitude={incident.latitude} longitude={incident.longitude} />
                    </>
                  )}

                  <p className="text-sm text-gray-700 mb-2">
                    📝 <span className="font-medium">Commentaire admin :</span>{" "}
                    {incident.adminComment || (
                      <span className="italic text-gray-400">Aucun</span>
                    )}
                  </p>

                  <div className="mt-3">
                    {incident.photoUri ? (
                      <a
                        href={incident.photoUri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={incident.photoUri}
                          alt="photo"
                          className="w-full h-40 object-cover rounded-lg border"
                        />
                      </a>
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-sm">
                        Pas de photo
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between gap-2 mt-4">
                    <button
                      onClick={() => handleEditClick(incident)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md w-full"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(incident._id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md w-full"
                    >
                      🗑️ Supprimer
                    </button>
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
