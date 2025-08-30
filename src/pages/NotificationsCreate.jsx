// src/pages/NotificationsCreate.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import VisibilityControls from "../components/VisibilityControls";
import { API_URL } from "../config";

function buildAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function NotificationsCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [form, setForm] = useState({
    title: "",
    message: "",
  });

  const [visibility, setVisibility] = useState({
    visibility: "local",
    communeId: "",
    audienceCommunes: [],
    priority: "normal",
    startAt: "",
    endAt: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Charger /api/me
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/me`, { headers: buildAuthHeaders() });
        const user = res?.data?.user || null;
        setMe(user);
        if (user?.role === "admin") {
          // verrouille par défaut la commune de l’admin
          setVisibility((v) => ({ ...v, communeId: user.communeId || "", visibility: "local" }));
        }
      } catch {
        localStorage.removeItem("token");
        window.location.assign("/login");
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return alert("Titre et message sont requis");
    setSubmitting(true);
    try {
      // prépare payload JSON
      const payload = {
        title: form.title,
        message: form.message,
        visibility: visibility.visibility,
        communeId: visibility.communeId,
        audienceCommunes: visibility.audienceCommunes,
        priority: visibility.priority,
        startAt: visibility.startAt || null,
        endAt: visibility.endAt || null,
      };

      const res = await axios.post(`${API_URL}/api/notifications`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
      });

      if (res.status >= 200 && res.status < 300) {
        alert("Notification créée ✅");
        setForm({ title: "", message: "" });
        // on ne reset pas totalement la visibilité pour éviter de re-saisir les mêmes valeurs
      }
    } catch (err) {
      console.error("Erreur création notif:", err);
      alert(err?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer une notification</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded border p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={140}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Message *</label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[120px]"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>
        </div>

        <VisibilityControls me={me} value={visibility} onChange={setVisibility} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Création…" : "Créer la notification"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => setForm({ title: "", message: "" })}
          >
            Réinitialiser
          </button>
        </div>
      </form>
    </div>
  );
}
