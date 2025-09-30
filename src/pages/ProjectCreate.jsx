// src/pages/ProjectCreate.jsx
import React, { useEffect, useState } from "react";
import VisibilityControls from "../components/VisibilityControls";
import api from "../api";
import { PROJECTS_PATH } from "../config";

export default function ProjectCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
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
        // IMPORTANT : passer par l’instance api et préfixer /api
        const res = await api.get("/api/me", {
          validateStatus: () => true,
          timeout: 15000,
        });

        if (res.status === 200) {
          const user = res?.data?.user || res?.data || null;
          setMe(user);
          if (user?.role === "admin") {
            setVisibility((v) => ({
              ...v,
              communeId: user.communeId || "",
              visibility: "local",
            }));
          }
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          window.location.assign("/login");
          return;
        } else {
          console.warn("GET /api/me non OK:", res.status, res.data);
        }
      } catch (e) {
        console.error("GET /api/me error:", e);
        localStorage.removeItem("token");
        window.location.assign("/login");
        return;
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.description) {
      alert("Nom et description requis");
      return;
    }
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description);
      if (form.imageFile) fd.append("image", form.imageFile);

      // Visibilité
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (
        Array.isArray(visibility.audienceCommunes) &&
        visibility.audienceCommunes.length
      ) {
        visibility.audienceCommunes.forEach((c) =>
          fd.append("audienceCommunes[]", c)
        );
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

      // IMPORTANT : utiliser l’instance api + la constante de chemin
      const res = await api.post(PROJECTS_PATH, fd, {
        validateStatus: () => true,
        timeout: 30000,
      });

      if (res.status === 401 || res.status === 403) {
        alert("Votre session a expiré. Veuillez vous reconnecter.");
        localStorage.removeItem("token");
        window.location.assign("/login");
        return;
      }

      if (res.status < 200 || res.status >= 300) {
        const msg =
          res?.data?.message ||
          res?.statusText ||
          `Erreur lors de la création (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      alert("Projet créé ✅");
      setForm({ name: "", description: "", imageFile: null });
    } catch (err) {
      console.error("Erreur création projet:", err);
      alert(
        err?.message || err?.response?.data?.message || "Erreur lors de la création"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer un projet</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded border p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nom *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Description *</label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[140px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Image (optionnel)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, imageFile: e.target.files?.[0] || null })
              }
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
            {submitting ? "Création…" : "Créer le projet"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => setForm({ name: "", description: "", imageFile: null })}
          >
            Réinitialiser
          </button>
        </div>

        {/* Debug utile */}
        <p className="text-xs text-gray-400 mt-4">
          projectsPath: <code>{PROJECTS_PATH}</code>
        </p>
      </form>
    </div>
  );
}
