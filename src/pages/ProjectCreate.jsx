// src/pages/ProjectCreate.jsx
import React, { useEffect, useMemo, useState } from "react";
import VisibilityControls from "../components/VisibilityControls";
import api from "../api";
import ReactQuill from "react-quill";
// ⚠️ Garde bien ces deux CSS ici pour s'assurer que le thème charge sur cette page
import "react-quill/dist/quill.core.css";
import "react-quill/dist/quill.snow.css";
import { PROJECTS_PATH } from "../config";

export default function ProjectCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    // description texte brut (compat)
    description: "",
    // description HTML (mise en forme)
    descriptionHtml: "",
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

  // ───────────────── Quill: toolbar & formats
  // ✅ Utilise la toolbar intégrée (pas de #id, pas de timing DOM)
  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        [{ color: [] }, { background: [] }],
        ["link", "clean"],
      ],
      clipboard: { matchVisual: false },
    }),
    []
  );

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "align",
    "color",
    "background",
    "link",
  ];

  useEffect(() => {
    (async () => {
      try {
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

  // Convertit HTML → texte brut (compat ancien champ `description`)
  const htmlToText = (html) => {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
  };

  const cleanHtml = (html) => {
    const s = String(html || "").trim();
    return s
      .replace(/^<p>(<br>|&nbsp;|\s)*<\/p>$/i, "")
      .replace(/^(<p>\s*<\/p>\s*)+$/i, "")
      .trim();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const descHtmlClean = cleanHtml(form.descriptionHtml);
    const descText = form.description?.trim() || htmlToText(descHtmlClean);

    if (!form.name || !descHtmlClean) {
      alert("Nom et description sont requis");
      return;
    }
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("name", form.name);

      // ⚠️ compat: on continue d'envoyer `description` (texte brut)
      fd.append("description", descText);
      // ➕ HTML riche
      fd.append("descriptionHtml", descHtmlClean);

      if (form.imageFile) fd.append("image", form.imageFile);

      // Visibilité
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach((c) => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

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
          res?.data?.message || res?.statusText || `Erreur lors de la création (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      alert("Projet créé ✅");
      setForm({ name: "", description: "", descriptionHtml: "", imageFile: null });
    } catch (err) {
      console.error("Erreur création projet:", err);
      alert(err?.message || err?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      {/* Patch local anti-reset qui pourrait masquer la toolbar */}
      <style>{`
        .ql-toolbar.ql-snow .ql-formats button,
        .ql-toolbar.ql-snow .ql-picker { display: inline-block; vertical-align: middle; }
        .ql-snow .ql-stroke { stroke: currentColor; }
        .ql-snow .ql-fill { fill: currentColor; }
        .ql-container.ql-snow { border-top: 0; }
      `}</style>

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

          {/* ───────── Zone mise en forme (toolbar intégrée) ───────── */}
          <div className="border rounded">
            <ReactQuill
              theme="snow"
              value={form.descriptionHtml}
              onChange={(html) =>
                setForm((f) => ({
                  ...f,
                  descriptionHtml: html,
                  // Maintien du champ texte brut pour compat
                  description: htmlToText(html),
                }))
              }
              modules={quillModules}
              formats={quillFormats}
              placeholder="Décrivez votre projet (gras, italique, titres, listes, liens, couleurs...)"
              style={{ minHeight: 220 }}
            />
          </div>

          <p className="text-xs text-gray-500">
            Astuce : sélectionnez le texte pour appliquer <b>gras</b>, <i>italique</i>,{" "}
            <u>souligné</u>, listes, titres, alignements, couleur, liens, etc.
          </p>

          {/* Aperçu du rendu HTML */}
          {form.descriptionHtml?.trim() ? (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-1">Aperçu :</div>
              <div
                className="border rounded p-3 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: form.descriptionHtml }}
              />
            </div>
          ) : null}

          {/* ✅ Champ d'origine conservé (texte brut) pour compatibilité */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Description (texte brut — compatibilité)
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[120px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Version texte brut de la description"
            />
            <p className="text-xs text-gray-400 mt-1">
              Le contenu riche est envoyé dans <code>descriptionHtml</code>. Celui-ci garde la compatibilité.
            </p>
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
            {submitting ? "Création…" : "Créer le projet"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() =>
              setForm({ name: "", description: "", descriptionHtml: "", imageFile: null })
            }
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
