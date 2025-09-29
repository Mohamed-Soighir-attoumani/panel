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

// Endpoints possibles pour /me (certains backends utilisent /auth/me, /users/me, etc.)
const ME_ENDPOINT_CANDIDATES = ["/me", "/auth/me", "/users/me", "/account/me"];

// clé de cache pour ne plus chercher à chaque fois
const ME_ENDPOINT_CACHE_KEY = "securidem:meEndpoint";

async function resolveMeEndpoint() {
  // 1) si on a déjà résolu, on réutilise
  const cached = localStorage.getItem(ME_ENDPOINT_CACHE_KEY);
  if (cached) return cached;

  const headers = buildAuthHeaders();

  // 2) on essaie en série les endpoints candidats
  for (const path of ME_ENDPOINT_CANDIDATES) {
    try {
      const res = await axios.get(`${API_URL}${path}`, {
        headers,
        validateStatus: () => true,
        timeout: 12000,
      });
      if (res.status === 200 && (res.data?.user || res.data?.role || res.data?.email)) {
        localStorage.setItem(ME_ENDPOINT_CACHE_KEY, path);
        return path;
      }
      // si 401/403 sur un endpoint, c'est sûrement le bon mais token invalide → on le retient quand même
      if (res.status === 401 || res.status === 403) {
        localStorage.setItem(ME_ENDPOINT_CACHE_KEY, path);
        return path;
      }
    } catch {
      // on essaie le suivant
    }
  }
  // 3) par défaut on retourne /me (même si ça 404), le composant gèrera l’erreur
  return "/me";
}

export default function ArticleCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);

  // Diagnostic UI
  const [pageError, setPageError] = useState("");
  const [diag, setDiag] = useState({ status: null, message: "", kind: "" });

  const [form, setForm] = useState({
    title: "",
    content: "",
    imageFile: null,
    // Métadonnées Play
    authorName: "",
    publisher: "Association Bellevue Dembeni",
    sourceUrl: "",
    status: "published", // 'draft' | 'published'
  });

  const [visibility, setVisibility] = useState({
    visibility: "local",
    communeId: "",
    audienceCommunes: [],
    priority: "normal", // 'normal' | 'pinned' | 'urgent'
    startAt: "",
    endAt: "",
  });

  async function loadMe() {
    setLoadingMe(true);
    setPageError("");
    setDiag({ status: null, message: "", kind: "" });

    try {
      const mePath = await resolveMeEndpoint(); // ← trouve le bon chemin
      const res = await axios.get(`${API_URL}${mePath}`, {
        headers: buildAuthHeaders(),
        validateStatus: () => true,
        timeout: 15000,
      });

      if (res.status === 200 && res.data) {
        const user =
          res?.data?.user ||
          // parfois le backend renvoie directement l’utilisateur
          (res?.data?.role || res?.data?.email ? res.data : null);

        if (!user) {
          setPageError(
            "Impossible de vérifier votre session pour le moment. Réessayez plus tard ou actualisez la page."
          );
          setDiag({ status: 200, message: "Réponse inattendue du serveur", kind: "http" });
        } else {
          setMe(user);
          if (user?.role === "admin") {
            setVisibility((v) => ({
              ...v,
              communeId: user.communeId || "",
              visibility: "local",
            }));
          }
          setPageError("");
          setDiag({ status: 200, message: "OK", kind: "ok" });
        }
      } else if (res.status === 401 || res.status === 403) {
        // Auth réellement invalide -> on déconnecte
        localStorage.removeItem("token");
        localStorage.removeItem(ME_ENDPOINT_CACHE_KEY);
        window.location.assign("/login");
        return;
      } else {
        const msg =
          res?.data?.message ||
          res?.statusText ||
          "Réponse inattendue du serveur";
        setPageError(
          "Impossible de vérifier votre session pour le moment. Réessayez plus tard ou actualisez la page."
        );
        setDiag({ status: res.status, message: msg, kind: "http" });
        console.error("GET /me error:", res.status, msg, res.data);
      }
    } catch (err) {
      const isTimeout = err?.code === "ECONNABORTED";
      const msg = isTimeout
        ? "Délai dépassé (timeout)."
        : (err?.message || "Erreur réseau/CORS.");
      setPageError(
        "Impossible de vérifier votre session pour le moment. Réessayez plus tard ou actualisez la page."
      );
      setDiag({ status: null, message: msg, kind: isTimeout ? "timeout" : "network" });
      console.error("GET /me exception:", err);
    } finally {
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    loadMe();
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

      // Visibilité / fenêtre
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach((c) => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

      // Métadonnées Play
      if (form.authorName) fd.append("authorName", form.authorName);
      if (form.publisher) fd.append("publisher", form.publisher);
      if (form.sourceUrl) fd.append("sourceUrl", form.sourceUrl);
      fd.append("status", form.status); // draft/published

      // POST /api/articles (API_URL contient déjà /api)
      const res = await axios.post(`${API_URL}/articles`, fd, {
        headers: {
          ...buildAuthHeaders(),
          // Ne pas fixer Content-Type, axios s'en charge pour FormData (boundary)
        },
        validateStatus: () => true,
        timeout: 20000,
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
        return;
      } else {
        const msg =
          res?.data?.message ||
          res?.statusText ||
          `Erreur lors de la création (HTTP ${res.status}).`;
        alert(`❌ ${msg}`);
        console.error("POST /articles error:", res.status, msg, res.data);
      }
    } catch (err) {
      const isTimeout = err?.code === "ECONNABORTED";
      const msg = isTimeout ? "Délai dépassé (timeout)." : (err?.message || "Erreur réseau/CORS.");
      alert(`❌ ${msg}`);
      console.error("POST /articles exception:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const testMe = async () => {
    try {
      const mePath = await resolveMeEndpoint();
      const res = await axios.get(`${API_URL}${mePath}`, {
        headers: buildAuthHeaders(),
        validateStatus: () => true,
      });
      console.log("[TEST /me] path:", mePath, "status:", res.status, "data:", res.data);
      alert(`Test ${mePath} → HTTP ${res.status}`);
    } catch (e) {
      console.error("[TEST /me] exception:", e);
      alert("Test /me : exception réseau (voir console).");
    }
  };

  if (loadingMe) return <div className="p-6">Chargement…</div>;

  return (
    <div className="pt-[80px] px-6 pb-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer un article</h1>

      {pageError && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 text-amber-800 p-3">
          <div className="font-semibold mb-1">{pageError}</div>
          <div className="text-sm text-amber-900">
            {diag.kind === "http" && (
              <>Détail : HTTP {diag.status} – {diag.message}</>
            )}
            {diag.kind === "network" && <>Détail : erreur réseau/CORS – {diag.message}</>}
            {diag.kind === "timeout" && <>Détail : délai dépassé (timeout).</>}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={loadMe}
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={testMe}
              className="px-3 py-1 rounded border"
            >
              Tester /me (console)
            </button>
          </div>
        </div>
      )}

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

          {/* Métadonnées Play */}
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

        {/* Bloc visibilité / période / priorité */}
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
