import React, { useEffect, useState } from "react";
import axios from "axios";
import VisibilityControls from "../components/VisibilityControls"; // tu l’as déjà
import { API_URL } from "../config";

function buildAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function InfosCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "", content: "", imageFile: null, category: "sante",
    locationName: "", locationAddress: "", locationLat: "", locationLng: "",
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
          setVisibility(v => ({ ...v, communeId: user.communeId || "", visibility: "local" }));
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
      fd.append("category", form.category);
      if (form.imageFile) fd.append("image", form.imageFile);

      // localisation (facultative)
      if (form.locationName)    fd.append("locationName", form.locationName);
      if (form.locationAddress) fd.append("locationAddress", form.locationAddress);
      if (form.locationLat)     fd.append("locationLat", form.locationLat);
      if (form.locationLng)     fd.append("locationLng", form.locationLng);

      // visibilité
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach(c => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt)   fd.append("endAt",   visibility.endAt);

      const res = await axios.post(`${API_URL}/api/infos`, fd, { headers: { ...buildAuthHeaders() } });
      if (res.status >= 200 && res.status < 300) {
        alert("Information publiée ✅");
        setForm({
          title: "", content: "", imageFile: null, category: "sante",
          locationName: "", locationAddress: "", locationLat: "", locationLng: "",
        });
      }
    } catch (err) {
      console.error("Erreur création info:", err);
      alert(err?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nouvelle info — Santé & Propreté</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded border p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Catégorie *</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="sante">Santé</option>
                <option value="proprete">Propreté</option>
                <option value="autres">Autres</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Contenu *</label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[160px]"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Image (optionnel)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setForm({ ...form, imageFile: e.target.files?.[0] || null })}
            />
          </div>

          {/* localisation (facultative) */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Lieu</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Nom du lieu (ex: Centre de santé …)"
                value={form.locationName}
                onChange={e => setForm({ ...form, locationName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Adresse</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Adresse"
                value={form.locationAddress}
                onChange={e => setForm({ ...form, locationAddress: e.target.value })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Latitude</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="-12.788"
                value={form.locationLat}
                onChange={e => setForm({ ...form, locationLat: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Longitude</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="45.236"
                value={form.locationLng}
                onChange={e => setForm({ ...form, locationLng: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* bloc visibilité (déjà utilisé ailleurs) */}
        <VisibilityControls me={me} value={visibility} onChange={setVisibility} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Publication…" : "Publier"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() =>
              setForm({
                title: "", content: "", imageFile: null, category: "sante",
                locationName: "", locationAddress: "", locationLat: "", locationLng: "",
              })
            }
          >
            Réinitialiser
          </button>
        </div>
      </form>
    </div>
  );
}
