// src/pages/ArticleCreate.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import VisibilityControls from "../components/VisibilityControls";
import { API_URL } from "../config";

function buildAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ArticleCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    imageFile: null,
  });

  const [visibility, setVisibility] = useState({
    visibility: "local",
    communeId: "",
    audienceCommunes: [],
    priority: "normal",
    startAt: "",
    endAt: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/me`, { headers: buildAuthHeaders() });
        const user = res?.data?.user || null;
        setMe(user);
        if (user?.role === "admin") {
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
    if (!form.title || !form.content) return alert("Titre et contenu requis");
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("content", form.content);
      if (form.imageFile) fd.append("image", form.imageFile);

      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach((c) => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

      const res = await axios.post(`${API_URL}/api/articles`, fd, {
        headers: { ...buildAuthHeaders() },
      });

      if (res.status >= 200 && res.status < 300) {
        alert("Article créé ✅");
        setForm({ title: "", content: "", imageFile: null });
      }
    } catch (err) {
      console.error("Erreur création article:", err);
      alert(err?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer un article</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded border p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Contenu *</label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[160px]"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Image (optionnel)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })}
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
            {submitting ? "Création…" : "Créer l’article"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => setForm({ title: "", content: "", imageFile: null })}
          >
            Réinitialiser
          </button>
        </div>
      </form>
    </div>
  );
}
