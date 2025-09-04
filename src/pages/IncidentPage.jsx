import L from "leaflet";
import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { API_URL } from "../config"; // 🔗 backend

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

// === helper headers ===
function buildHeaders(me, selectedCommuneId) {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  // Admin => impose sa commune
  if (me?.role === "admin" && me?.communeId) {
    headers["x-commune-id"] = me.communeId;
  }
  // Superadmin => applique le filtre s'il est choisi
  if (me?.role === "superadmin" && selectedCommuneId) {
    headers["x-commune-id"] = selectedCommuneId;
  }
  return headers;
}

const IncidentPage = () => {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editIncidentId, setEditIncidentId] = useState(null);
  const [editedIncident, setEditedIncident] = useState({});
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [periodFilter, setPeriodFilter] = useState(""); // "", "7", "30"

  // 🔽 communes list pour le superadmin
  const [communes, setCommunes] = useState([]);
  const [selectedCommuneId, setSelectedCommuneId] = useState(
    (typeof window !== "undefined" &&
      localStorage.getItem("selectedCommuneId")) ||
      ""
  );

  const lastIncidentIdRef = useRef(null);

  // --- Gestion du son ---
  const SOUND_URL = `${window.location.origin}/sounds/notification.mp3`;
  const audioRef = useRef(null);
  const isAudioAllowedRef = useRef(false);
  const pendingPlayRef = useRef(false);

  // charge /api/me pour connaître le rôle/commune
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await axios.get(`${API_URL}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 15000,
        });
        const user = res?.data?.user || null;
        setMe(user);
        localStorage.setItem("me", JSON.stringify(user));
      } catch {
        localStorage.removeItem("token");
        window.location.href = "/login";
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  // si superadmin, charger les communes depuis /api/admins
  useEffect(() => {
    if (!loadingMe && me?.role === "superadmin") {
      (async () => {
        try {
          const headers = buildHeaders(me, ""); // pas de filtre ici
          const r = await axios.get(`${API_URL}/api/admins`, { headers });
          const list = Array.isArray(r.data?.admins)
            ? r.data.admins
            : Array.isArray(r.data?.items)
            ? r.data.items
            : [];
          const map = new Map();
          for (const a of list) {
            const id = (a.communeId || "").trim();
            if (!id) continue;
            const name = (a.communeName || a.communeId || "").trim();
            map.set(id, name || id);
          }
          const arr = Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr"));
          setCommunes(arr);
        } catch (e) {
          console.warn(
            "Impossible de charger la liste des communes:",
            e?.message || e
          );
          setCommunes([]);
        }
      })();
    }
  }, [loadingMe, me]);

  // Init audio
  useEffect(() => {
    audioRef.current = new Audio(SOUND_URL);
    audioRef.current.preload = "auto";

    const unlock = async () => {
      try {
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        isAudioAllowedRef.current = true;

        if (pendingPlayRef.current && document.visibilityState === "visible") {
          pendingPlayRef.current = false;
          await audioRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn("Audio unlock failed:", e?.message || e);
      } finally {
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
        document.removeEventListener("touchstart", unlock);
      }
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });

    const onVisible = async () => {
      if (
        isAudioAllowedRef.current &&
        pendingPlayRef.current &&
        document.visibilityState === "visible"
      ) {
        pendingPlayRef.current = false;
        try {
          await audioRef.current.play();
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const playNotificationSound = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isAudioAllowedRef.current) {
      pendingPlayRef.current = true;
      return;
    }

    if (document.visibilityState !== "visible") {
      pendingPlayRef.current = true;
      return;
    }

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      console.error("Erreur lecture son :", err);
      pendingPlayRef.current = true;
    }
  };

  const fetchIncidents = useCallback(async () => {
    if (loadingMe) return;
    try {
      const headers = buildHeaders(me, selectedCommuneId);
      const params = {};
      if (periodFilter) params.period = periodFilter;

      const response = await axios.get(`${API_URL}/api/incidents`, {
        headers,
        params,
      });

      let data = Array.isArray(response.data) ? response.data : [];
      data = data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      if (statusFilter !== "Tous") {
        data = data.filter((item) => item.status === statusFilter);
      }

      if (data.length > 0) {
        const newestId = data[0]?._id;
        if (
          lastIncidentIdRef.current &&
          newestId &&
          newestId !== lastIncidentIdRef.current
        ) {
          playNotificationSound();
        }
        if (!lastIncidentIdRef.current && newestId) {
          lastIncidentIdRef.current = newestId;
        } else if (newestId && newestId !== lastIncidentIdRef.current) {
          lastIncidentIdRef.current = newestId;
        }
      }

      setIncidents(data);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement incidents :", error);
      setError("Impossible de charger les incidents.");
      setLoading(false);
    }
  }, [me, loadingMe, statusFilter, periodFilter, selectedCommuneId]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet incident ?")) return;
    try {
      const headers = buildHeaders(me, selectedCommuneId);
      await axios.delete(`${API_URL}/api/incidents/${id}`, { headers });
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
      const headers = {
        ...buildHeaders(me, selectedCommuneId),
        "Content-Type": "application/json",
      };
      await axios.put(
        `${API_URL}/api/incidents/${editIncidentId}`,
        editedIncident,
        { headers }
      );
      setEditIncidentId(null);
      fetchIncidents();
    } catch (error) {
      console.error("Erreur mise à jour :", error);
      alert("Erreur lors de la mise à jour.");
    }
  };

  // persist selection commune (superadmin)
  useEffect(() => {
    if (me?.role === "superadmin") {
      if (selectedCommuneId) {
        localStorage.setItem("selectedCommuneId", selectedCommuneId);
      } else {
        localStorage.removeItem("selectedCommuneId");
      }
    }
  }, [me?.role, selectedCommuneId]);

  if (loading || loadingMe) return <div className="p-6">Chargement...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="pt-[80px] px-6 pb-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">
        🛠️ Incidents signalés
      </h1>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <select
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
          value={statusFilter}
        >
          <option value="Tous">Tous les statuts</option>
          <option value="En cours">En cours</option>
          <option value="En attente">En attente</option>
          <option value="Résolu">Résolu</option>
          <option value="Rejeté">Rejeté</option>
        </select>

        <select
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="input"
          value={periodFilter}
        >
          <option value="">Toute période</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>

        {/* Sélecteur visible uniquement pour superadmin */}
        {me?.role === "superadmin" && (
          <select
            className="input"
            value={selectedCommuneId}
            onChange={(e) => setSelectedCommuneId(e.target.value)}
            title="Filtrer par commune (laisser vide pour toutes)"
          >
            <option value="">Toutes les communes</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={fetchIncidents}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition"
        >
          🔄 Rafraîchir
        </button>
      </div>

      {incidents.length === 0 ? (
        <p className="text-gray-500">Aucun incident pour le moment.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {incidents.map((incident) => (
            <div
              key={incident._id}
              className="bg-white p-5 rounded-xl shadow-md border"
            >
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
                    placeholder="Commentaire"
                  />
                  <button
                    onClick={handleUpdate}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md w-full mt-2"
                  >
                    📂 Enregistrer
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold mb-1">{incident.title}</h2>
                  <p className="text-gray-700 mb-2">{incident.description}</p>
                  <p className="text-sm text-gray-500 italic mb-1">
                    📍 {incident.lieu}
                  </p>
                  <p className="text-sm text-blue-600 font-medium mb-1">
                    📌 {incident.status}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    📬 {incident.adresse || "Adresse inconnue"}
                  </p>
                  <p className="text-xs text-gray-400">
                    🕒{" "}
                    {incident.createdAt
                      ? new Date(incident.createdAt).toLocaleString("fr-FR")
                      : ""}
                  </p>
                  {incident.latitude && incident.longitude && (
                    <>
                      <p className="text-sm text-gray-600 mb-2">
                        🛱️ {incident.latitude.toFixed(5)},{" "}
                        {incident.longitude.toFixed(5)}
                      </p>
                      <IncidentMap
                        latitude={incident.latitude}
                        longitude={incident.longitude}
                      />
                    </>
                  )}
                  <p className="text-sm text-gray-700 mb-2">
                    📝{" "}
                    {incident.adminComment || (
                      <em className="text-gray-400">Aucun commentaire</em>
                    )}
                  </p>

                  <div className="mt-3">
                    {incident.mediaUrl ? (
                      incident.mediaType === "video" ? (
                        <video
                          controls
                          className="w-full h-40 rounded-lg border object-cover"
                        >
                          <source src={incident.mediaUrl} type="video/mp4" />
                          Votre navigateur ne prend pas en charge les vidéos.
                        </video>
                      ) : (
                        <a
                          href={incident.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={incident.mediaUrl}
                            alt="media"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                        </a>
                      )
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-sm">
                        Pas de média
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
