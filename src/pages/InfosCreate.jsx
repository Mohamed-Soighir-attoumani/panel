// src/pages/InfosCreate.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import VisibilityControls from "../components/VisibilityControls";
import { API_URL } from "../config";

// -------------------------------
// Helpers
// -------------------------------
function buildAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toNumber(v) {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function shortMsg(str, max = 160) {
  if (!str) return "";
  const s = String(str).trim().replace(/\s+/g, " ");
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function htmlToText(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

function cleanHtml(html) {
  const s = String(html || "").trim();
  return s
    .replace(/^<p>(<br>|&nbsp;|\s)*<\/p>$/i, "")
    .replace(/^(<p>\s*<\/p>\s*)+$/i, "")
    .trim();
}

// -------------------------------
// Composant principal
// -------------------------------
export default function InfosCreate() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    // ⚠️ on stocke le HTML pour la mise en forme
    contentHtml: "",
    // ✅ on garde une version texte brut pour compat (bandeau, legacy)
    content: "",
    imageFile: null,
    category: "sante",
    locationName: "",
    locationAddress: "",
    locationLat: "",
    locationLng: "",
  });

  const [visibility, setVisibility] = useState({
    visibility: "local",
    communeId: "",
    audienceCommunes: [],
    priority: "normal", // normal | urgent
    startAt: "",
    endAt: "",
  });

  // Options spécifiques au bandeau (alerte critique)
  const [banner, setBanner] = useState({
    enabled: false,      // coche manuelle pour forcer un bandeau
    requireAck: true,    // demander "J'ai compris"
    radiusM: 4000,       // rayon de diffusion autour du point (mètres)
  });

  // ───────────────── Quill : toolbar & formats
  const toolbarId = "infos-editor-toolbar";

  // Fallback robuste : si l’élément toolbar n’existe pas lors du mount,
  // on utilise une toolbar intégrée (array).
  const quillModules = useMemo(() => {
    const builtInToolbar = [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      [{ color: [] }, { background: [] }],
      ["link", "clean"],
    ];

    let toolbar;
    try {
      const el =
        typeof document !== "undefined"
          ? document.getElementById(toolbarId)
          : null;
      toolbar = el ? `#${toolbarId}` : builtInToolbar;
    } catch {
      toolbar = builtInToolbar;
    }

    return {
      toolbar,
      clipboard: { matchVisual: false },
    };
  }, []);

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
        // ⚠️ API_URL contient déjà /api
        const res = await axios.get(`${API_URL}/me`, {
          headers: buildAuthHeaders(),
          timeout: 15000,
          validateStatus: () => true,
        });
        if (res.status === 200) {
          const user = res?.data?.user || null;
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
          console.warn("GET /me non OK:", res.status, res.data);
        }
      } catch (e) {
        console.error("GET /me error:", e);
        localStorage.removeItem("token");
        window.location.assign("/login");
        return;
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  // ---------------------------------
  // Création de l'alerte (bandeau)
  // ---------------------------------
  const createBannerAlertIfNeeded = async (createdInfo) => {
    const shouldBanner = visibility.priority === "urgent" || banner.enabled;
    if (!shouldBanner) return; // rien à faire

    // On exige une géolocalisation pour cibler la zone correctement
    const lat = toNumber(form.locationLat);
    const lon = toNumber(form.locationLng);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      alert(
        "Bandeau URGENT demandé, mais Latitude/Longitude sont manquantes ou invalides. Renseigne-les pour créer l'alerte."
      );
      return;
    }

    // Fenêtre de validité
    const now = new Date();
    const startAt = visibility.startAt ? new Date(visibility.startAt) : now;
    const endAt = visibility.endAt
      ? new Date(visibility.endAt)
      : new Date(Date.now() + 48 * 3600 * 1000); // défaut: +48h

    // Id de l'info (si renvoyé par l'API)
    const infoId = createdInfo?._id || createdInfo?.id || null;

    // ⚠️ pour le bandeau, on résume la VERSION TEXTE (on strip le HTML)
    const plain = form.content?.trim() || htmlToText(form.contentHtml);

    const payload = {
      severity: "critique", // bandeau rouge
      title: form.title,
      message: shortMsg(plain, 160),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      area: { lat, lon, radiusM: Number(banner.radiusM) || 4000 },
      requireAck: !!banner.requireAck,
      actions: infoId
        ? [
            { type: "screen", label: "Détails", value: `info/${infoId}` },
            { type: "phone", label: "Appeler 15", value: "15" },
          ]
        : [{ type: "phone", label: "Appeler 15", value: "15" }],
    };

    // ⚠️ API_URL contient déjà /api
    await axios.post(`${API_URL}/alerts`, payload, {
      headers: { ...buildAuthHeaders() },
      timeout: 20000,
      validateStatus: () => true,
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const contentHtmlClean = cleanHtml(form.contentHtml);
    const contentText = form.content?.trim() || htmlToText(contentHtmlClean);

    if (!form.title || !contentHtmlClean) {
      alert("Titre et contenu sont requis");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);

      // ⬅️ on envoie le HTML pour la mise en forme
      fd.append("content", contentHtmlClean);
      // ➕ on joint une version texte brut pour compat éventuelle
      fd.append("contentText", contentText);

      fd.append("category", form.category);
      if (form.imageFile) fd.append("image", form.imageFile);

      // localisation (facultative)
      if (form.locationName) fd.append("locationName", form.locationName);
      if (form.locationAddress) fd.append("locationAddress", form.locationAddress);
      if (form.locationLat) fd.append("locationLat", form.locationLat);
      if (form.locationLng) fd.append("locationLng", form.locationLng);

      // visibilité
      fd.append("visibility", visibility.visibility);
      if (visibility.communeId) fd.append("communeId", visibility.communeId);
      if (Array.isArray(visibility.audienceCommunes) && visibility.audienceCommunes.length) {
        visibility.audienceCommunes.forEach((c) => fd.append("audienceCommunes[]", c));
      }
      fd.append("priority", visibility.priority);
      if (visibility.startAt) fd.append("startAt", visibility.startAt);
      if (visibility.endAt) fd.append("endAt", visibility.endAt);

      // ⚠️ API_URL contient déjà /api
      const res = await axios.post(`${API_URL}/infos`, fd, {
        headers: { ...buildAuthHeaders() }, // ne pas fixer Content-Type : axios s'en charge
        timeout: 20000,
        validateStatus: () => true,
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

      const createdInfo = res?.data?.info || res?.data; // selon ta réponse API

      // 👉 Crée aussi l'alerte (bandeau) si prioritaire/activé (best-effort)
      try {
        await createBannerAlertIfNeeded(createdInfo);
      } catch (e) {
        console.error("Échec création bandeau:", e);
      }

      alert("Information publiée ✅");
      setForm({
        title: "",
        contentHtml: "",
        content: "",
        imageFile: null,
        category: "sante",
        locationName: "",
        locationAddress: "",
        locationLat: "",
        locationLng: "",
      });
    } catch (err) {
      console.error("Erreur création info:", err);
      alert(err?.message || err?.response?.data?.message || "Erreur lors de la création");
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
                onChange={(e) => setForm({ ...form, category: e.target.value })}
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
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* ───────── ZONE MISE EN FORME (ReactQuill) ───────── */}
          <div className="ql-snow">
            {/* Toolbar personnalisée (comme pour ArticleCreate) */}
            <div id={toolbarId} className="ql-toolbar ql-snow rounded-t px-2">
              <span className="ql-formats">
                <select className="ql-header" defaultValue="">
                  <option value="1"></option>
                  <option value="2"></option>
                  <option value="3"></option>
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
                value={form.contentHtml}
                onChange={(html) =>
                  setForm((f) => ({
                    ...f,
                    contentHtml: html,
                    // on garde le texte brut pour le bandeau/compat
                    content: htmlToText(html),
                  }))
                }
                modules={quillModules}
                formats={quillFormats}
                placeholder="Rédigez le contenu (gras, italique, titres, listes, liens, couleurs...)"
                style={{ minHeight: 180 }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Astuce : sélectionnez le texte pour appliquer <b>gras</b>, <i>italique</i>,{" "}
            <u>souligné</u>, listes, titres, alignements, couleur, liens, etc.
          </p>

          {/* Aperçu (optionnel) */}
          {form.contentHtml?.trim() ? (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-1">Aperçu :</div>
              <div
                className="border rounded p-3 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: form.contentHtml }}
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Image (optionnel)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })}
            />
          </div>

          {/* localisation (facultative, mais requise si bandeau urgent) */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Lieu</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Nom du lieu (ex: Centre de santé …)"
                value={form.locationName}
                onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Adresse</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Adresse"
                value={form.locationAddress}
                onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Latitude</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="-12.843"
                value={form.locationLat}
                onChange={(e) => setForm({ ...form, locationLat: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Longitude</label>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="45.197"
                value={form.locationLng}
                onChange={(e) => setForm({ ...form, locationLng: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* bloc visibilité (déjà utilisé ailleurs) */}
        <VisibilityControls me={me} value={visibility} onChange={setVisibility} />

        {/* Options Bandeau Critique */}
        <div className="bg-white rounded border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="bannerEnabled"
              type="checkbox"
              checked={banner.enabled}
              onChange={(e) => setBanner((b) => ({ ...b, enabled: e.target.checked }))}
            />
            <label htmlFor="bannerEnabled" className="text-sm text-gray-700">
              Afficher aussi en <strong>bandeau critique</strong> (si non coché, le bandeau se créera automatiquement quand la priorité = <em>urgent</em>)
            </label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <input
                id="bannerAck"
                type="checkbox"
                checked={banner.requireAck}
                onChange={(e) => setBanner((b) => ({ ...b, requireAck: e.target.checked }))}
              />
              <label htmlFor="bannerAck" className="text-sm text-gray-700">Exiger "J’ai compris"</label>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Rayon (m)</label>
              <input
                type="number"
                min={500}
                step={100}
                className="w-full border rounded px-3 py-2"
                value={banner.radiusM}
                onChange={(e) => setBanner((b) => ({ ...b, radiusM: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-500 mt-1">Zone de diffusion autour de la latitude/longitude.</p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Le bandeau s’affiche dans l’app si l’utilisateur est dans la zone et tant que la période est active.
            Il disparaît à la date de fin ou quand vous désactivez/supprimez l’alerte.
          </p>
        </div>

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
                title: "",
                contentHtml: "",
                content: "",
                imageFile: null,
                category: "sante",
                locationName: "",
                locationAddress: "",
                locationLat: "",
                locationLng: "",
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
