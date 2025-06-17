import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "https://backend-admin-tygd.onrender.com/api/notifications";

const NotificationPage = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(API_URL);
      setNotifications(res.data);
    } catch (err) {
      console.error("Erreur chargement :", err);
      setFeedback({ type: "error", message: "Erreur de chargement." });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await axios.patch(`${API_URL}/${editingId}`, { title, message });
        setFeedback({ type: "success", message: "Notification modifiée avec succès !" });
      } else {
        await axios.post(API_URL, { title, message });
        setFeedback({ type: "success", message: "Notification envoyée avec succès !" });
      }

      setTitle("");
      setMessage("");
      setEditingId(null);
      fetchNotifications();
    } catch (err) {
      console.error("Erreur :", err);
      setFeedback({ type: "error", message: "Échec de l'envoi." });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
    }
  };

  const handleEdit = (notif) => {
    setTitle(notif.title);
    setMessage(notif.message);
    setEditingId(notif._id);
    setFeedback({ type: "", message: "" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setFeedback({ type: "success", message: "Notification supprimée." });
      fetchNotifications();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Échec de la suppression." });
    } finally {
      setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-xl">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">📣 Gérer les Notifications</h2>

      {feedback.message && (
        <div
          className={`p-3 mb-4 rounded text-sm ${
            feedback.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
          <input
            type="text"
            className="w-full border border-gray-300 p-2 rounded focus:outline-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            className="w-full border border-gray-300 p-2 rounded focus:outline-blue-500"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="4"
            required
          ></textarea>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Traitement..." : editingId ? "💾 Modifier" : "📤 Envoyer"}
        </button>
      </form>

      <h3 className="text-xl font-semibold mb-4">📋 Notifications existantes</h3>
      <ul className="space-y-4">
        {notifications.length === 0 ? (
          <p className="text-gray-500 italic">Aucune notification enregistrée.</p>
        ) : (
          notifications.map((notif) => (
            <li key={notif._id} className="p-4 bg-gray-100 rounded shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-lg">{notif.title}</h4>
                <span className="text-xs text-gray-500">
                  {notif.createdAt
                    ? new Date(notif.createdAt).toLocaleString()
                    : "Date inconnue"}
                </span>
              </div>
              <p className="text-gray-800">{notif.message}</p>

              <div className="mt-3 space-x-2">
                <button
                  onClick={() => handleEdit(notif)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => handleDelete(notif._id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default NotificationPage;
