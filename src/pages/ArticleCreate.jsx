// src/pages/ArticleCreate.jsx
import React, { useEffect, useMemo, useState } from "react";
import VisibilityControls from "../components/VisibilityControls";
import api from "../api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

/* Helpers */
const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

const LS_ME_PATH = "securidem:mePath";
const LS_ARTICLES_PATH = "securidem:articlesPath";

/** Détecte /api/me -> sinon /me */
async function resolveMePath() {
  const cached = localStorage.getItem(LS_ME_PATH);
  if (cached) return cached;
  const candidates = ["/api/me", "/me"];
  for (const path of candidates) {
    try {
      const res = await api.get(path, { validateStatus: () => true, timeout: 12000 });
      if (res.status === 200 || res.status === 401 || res.status === 403) {
        localStorage.setItem(LS_ME_PATH, path);
        return path;
      }
    } catch (_) {}
  }
  return "/api/me";
}

/** Détecte /api/articles -> sinon /articles */
async function resolveArticlesPath() {
  const cached = localStorage.getItem(LS_ARTICLES_PATH);
  if (cached) return cached;
  const candidates = ["/api/articles", "/articles"];
  for (const path of candidates) {
    try {
      const res = await api.get(path, { validateStatus: () => true, timeout: 12000 });
      const ok200 =
        res.status === 200 && (Array.isArray(res.data) || Array.isArray(res.data?.items));
      if (ok200 || res.status === 401 || res.status === 403) {
        localStorage.setItem(LS_ARTICLES_PATH, path);
        return path;
      }
    } catch (_) {}
  }
  return "/api/articles";
}

export default function ArticleCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);

  const [mePath, setMePath] = useState(localStorage.getItem(LS_ME_PATH) || "/api/me");
  const [articlesPath, setArticlesPath] = useState(
    localStorage.getItem(LS_ARTICLES_PATH) || "/api/articles"
  );

  const [form, setForm] = useState({
    title: "",
    // ⚠️ Désormais HTML (rédigé avec l’éditeur riche)
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

  // ───────────────── Quill: toolbar & formats autorisés
  const toolbarId = "article-editor-toolbar";

  const quillModules = useMemo(
    () => ({
      // on référence la toolbar HTML ci-dessous
      toolbar: `#${toolbarId}`,
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
      setLoadingMe(true);
      try {
        const [mp, ap] = await Promise.all([resolveMePath(), resolveArticlesPath()]);
        setMePath(mp);
        setArticlesPath(ap);

        const res = await api.get(mp, { validateStatus: () => true, timeout: 15000 });
        if (res.status === 200) {
          const user = res.data?.user || (res.data?.role ? res.data : null);
          setMe(user || null);
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
        }
      } catch (e) {
        console.warn("GET me failed:", e?.message || e);
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
    // Retirer les balises vides type <p><br></p>
    const contentClean = String(form.content || "").replace(/^<p><br><\/p>$/i, "").trim();

    if (!form.title || !contentClean) return alert("Titre et contenu requis");
    if (form.sourceUrl && !isHttpUrl(form.sourceUrl)) {
      return alert("L’URL de la source doit commencer par http(s)://");
    }
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("content", contentClean); // ⬅️ on envoie le HTML
      if (form.imageFile) fd.append("image", form.imageFile);

      // Visibilité & planification
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach((c) => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

      // Métadonnées
      if (form.authorName) fd.append("authorName", form.authorName);
      if (form.publisher) fd.append("publisher", form.publisher);
      if (form.sourceUrl) fd.append("sourceUrl", form.sourceUrl);
      fd.append("status", form.status);

      const res = await api.post(articlesPath, fd, {
        validateStatus: () => true,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { "Content-Type": "multipart/form-data" },
      });

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
        console.error(`POST ${articlesPath} error:`, res.status, msg, res.data);
      }
    } catch (err) {
      const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
      const msg = isTimeout
        ? "Le serveur a mis trop de temps à répondre pendant l’upload (réseau lent). Réessayez ou réduisez la taille de l’image."
        : (err?.message || "Erreur réseau/CORS.");
      alert(`❌ ${msg}`);
      console.error("POST article exception:", err);
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

          {/* ───────── ÉDITEUR RICHE (mise en page) ───────── */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Contenu (mise en forme) *
            </label>

            {/* Toolbar personnalisée : assure l’affichage du bouton “lien” */}
            <div id={toolbarId} className="ql-toolbar ql-snow rounded-t px-2">
              <span className="ql-formats">
                <select className="ql-header" defaultValue="">
                  <option value="1"></option>
                  <option value="2"></option>
                  <option value=""></option>
                </select>
              </span>
              <span className="ql-formats">
                <button className="ql-bold"></button>
                <button className="ql-italic"></button>
                <button className="ql-underline"></button>
                <button className="ql-strike"></button>
              </span>
              <span className="ql-formats">
                <button className="ql-list" value="ordered"></button>
                <button className="ql-list" value="bullet"></button>
              </span>
              <span className="ql-formats">
                <select className="ql-align"></select>
              </span>
              <span className="ql-formats">
                <select className="ql-color"></select>
                <select className="ql-background"></select>
              </span>
              <span className="ql-formats">
                <button className="ql-link"></button>
                <button className="ql-clean"></button>
              </span>
            </div>

            <div className="border border-t-0 rounded-b">
              <ReactQuill
                theme="snow"
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Rédigez votre article (gras, italique, titres, listes, liens...)"
                style={{ minHeight: 180 }}
              />
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Astuce : sélectionnez le texte pour appliquer <b>gras</b>, <i>italique</i>,{" "}
              <u>souligné</u>, listes, titres, alignements, couleur, liens, etc.
            </p>

            {/* Aperçu du rendu HTML */}
            {form.content?.trim() ? (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-1">Aperçu :</div>
                <div
                  className="border rounded p-3 prose max-w-none"
                  // si tu n’as pas le plugin typography de Tailwind, tu peux enlever "prose"
                  dangerouslySetInnerHTML={{ __html: form.content }}
                />
              </div>
            ) : null}
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
              <label className="block text-sm text-gray-700 mb-1">
                URL de la source (si reprise)
              </label>
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

        {/* Debug utile pour voir le chemin actif */}
        <p className="text-xs text-gray-400 mt-4">
          mePath: <code>{mePath}</code> • articlesPath: <code>{articlesPath}</code>
        </p>
      </form>
    </div>
  );
}
