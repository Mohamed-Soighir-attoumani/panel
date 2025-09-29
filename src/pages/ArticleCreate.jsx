// src/pages/ArticleCreate.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import VisibilityControls from "../components/VisibilityControls";
import { API_URL } from "../config";

function buildAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

// ---- axios instance avec baseURL BACKEND ----
const api = axios.create({
  baseURL: API_URL, // ex: https://backend-admin-tygd.onrender.com/api
  timeout: 20000,
  validateStatus: () => true,
});

export default function ArticleCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);

  const [form, setForm] = useState({
    title: "",
    content: "",
    imageFile: null,
    authorName: "",
    publisher: "Association Bellevue Dembeni",
    sourceUrl: "",
    status: "published",
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
      setLoadingMe(true);
      try {
        const res = await api.get("/me", { headers: buildAuthHeaders() });
        if (res.status === 200) {
          const user = res.data?.user || (res.data?.role ? res.data : null);
          setMe(user || null);
          if (user?.role === "admin") {
            setVisibility((v) => ({ ...v, communeId: user.communeId || "", visibility: "local" }));
          }
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          window.location.assign("/login");
          return;
        }
      } catch (e) {
        // silencieux, on laisse l'utilisateur retenter
        console.warn("GET /me failed:", e?.message || e);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, imageFile: file }));
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) return alert("Titre et contenu requis");
    if (form.sourceUrl && !isHttpUrl(form.sourceUrl)) {
      return alert("L’URL de la source doit commencer par http(s)://");
    }
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

      if (form.authorName) fd.append("authorName", form.authorName);
      if (form.publisher) fd.append("publisher", form.publisher);
      if (form.sourceUrl) fd.append("sourceUrl", form.sourceUrl);
      fd.append("status", form.status);

      // >>> ICI on utilise l'instance axios baseURL=API_URL
      const res = await api.post("/articles", fd, { headers: buildAuthHeaders() });

      if (res.status === 201 || (res.status >= 200 && res.status < 300)) {
        alert("Article créé ✅");
        setForm({
          title: "",
          content: "",
          imageFile: null,
          authorName: "",
          publisher: "Association Bellevue Dembeni",
          sourceUrl: "",
          status: "published",
        });
        setPreview(null);
      } else if (res.status === 401 || res.status === 403) {
        alert("Votre session a expiré. Veuillez vous reconnecter.");
        localStorage.removeItem("token");
        window.location.assign("/login");
      } else {
        const msg = res?.data?.message || res?.statusText || `Erreur (HTTP ${res.status})`;
        alert(`❌ ${msg}`);
        console.error("POST /articles error:", res.status, msg, res.data);
      }
    } catch (err) {
      const msg = err?.message || "Erreur réseau/CORS.";
      alert(`❌ ${msg}`);
      console.error("POST /articles exception:", err);
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
            <input type="file" accept="image/*" onChange={onFileChange} />
            {preview && (
              <img
                src={preview}
                alt="Aperçu"
                className="mt-3 rounded-lg border max-h-56 object-cover"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Auteur (affiché)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder="Ex: Service Communication"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Éditeur</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.publisher}
                onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                placeholder="Association Bellevue Dembeni"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">URL de la source (si reprise)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                placeholder="https://... (obligatoire pour contenu gouvernemental repris)"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Statut</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="published">Publié</option>
                <option value="draft">Brouillon</option>
              </select>
            </div>
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
            onClick={() => {
              setForm({
                title: "",
                content: "",
                imageFile: null,
                authorName: "",
                publisher: "Association Bellevue Dembeni",
                sourceUrl: "",
                status: "published",
              });
              setPreview(null);
            }}
          >
            Réinitialiser
          </button>
        </div>
      </form>
    </div>
  );
}
