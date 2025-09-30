// src/pages/ArticleListPage.jsx
import React, { useState, useEffect } from "react";
import api from "../api";
import { BASE_URL, ARTICLES_PATH } from "../config";

const toFullUrl = (p) => {
  if (!p) return "https://via.placeholder.com/600x200.png?text=Aucune+image";
  if (typeof p === "string" && /^https?:\/\//i.test(p)) return p;
  // Le backend sert /uploads à la racine (pas sous /api)
  return `${BASE_URL.replace(/\/$/, "")}${p.startsWith("/") ? "" : "/"}${p}`;
};

const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

const ArticleListPage = () => {
  const [articles, setArticles] = useState([]);
  const [editingArticle, setEditingArticle] = useState(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Métadonnées
  const [authorName, setAuthorName] = useState("");
  const [publisher, setPublisher] = useState("Association Bellevue Dembeni");
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState("published"); // draft|published

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchArticles = async () => {
    try {
      // IMPORTANT : les routes sont bien sous /api
      const res = await api.get(ARTICLES_PATH);
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setArticles(data);
      setErrorMsg("");
    } catch (err) {
      console.error("Erreur chargement articles :", err);
      setErrorMsg(
        `❌ Impossible de charger les articles (${err?.response?.status || "réseau"}).`
      );
    }
  };

  const handleEditClick = (article) => {
    setEditingArticle(article);
    setTitle(article.title || "");
    setContent(article.content || "");
    setImage(null);
    setImagePreview(article.imageUrl ? toFullUrl(article.imageUrl) : null);

    setAuthorName(article.authorName || "");
    setPublisher(article.publisher || "Association Bellevue Dembeni");
    setSourceUrl(article.sourceUrl || "");
    setStatus(article.status || "published");

    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setImage(file || null);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingArticle?._id) return;

    if (sourceUrl && !isHttpUrl(sourceUrl)) {
      setErrorMsg("❌ L’URL de la source doit commencer par http(s)://");
      return;
    }

    const formData = new FormData();
    formData.append("title", (title || "").trim());
    formData.append("content", (content || "").trim());
    if (image) formData.append("image", image);

    formData.append("authorName", (authorName || "").trim());
    formData.append("publisher", (publisher || "Association Bellevue Dembeni").trim());
    formData.append("status", status === "draft" ? "draft" : "published");
    if (sourceUrl) formData.append("sourceUrl", sourceUrl.trim());

    try {
      await api.put(`${ARTICLES_PATH}/${editingArticle._id}`, formData);
      setSuccessMsg("✅ Article modifié avec succès.");
      resetForm();
      fetchArticles();
    } catch (err) {
      console.error("Erreur mise à jour article :", err);
      const msg =
        err?.response?.data?.message ||
        `Erreur lors de la mise à jour (${err?.response?.status || "réseau"}).`;
      setErrorMsg(`❌ ${msg}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet article ?")) return;
    try {
      await api.delete(`${ARTICLES_PATH}/${id}`);
      setSuccessMsg("✅ Article supprimé.");
      fetchArticles();
    } catch (err) {
      console.error("Erreur suppression article :", err);
      const msg =
        err?.response?.data?.message ||
        `Erreur lors de la suppression (${err?.response?.status || "réseau"}).`;
      setErrorMsg(`❌ ${msg}`);
    }
  };

  const resetForm = () => {
    setEditingArticle(null);
    setTitle("");
    setContent("");
    setImage(null);
    setImagePreview(null);
    setAuthorName("");
    setPublisher("Association Bellevue Dembeni");
    setSourceUrl("");
    setStatus("published");
  };

  const getPlainTextSnippet = (html, maxLength = 500) => {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    const text = temp.textContent || temp.innerText || "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📚 Gestion des Articles</h1>

      {successMsg && <p className="text-green-600 mb-4">{successMsg}</p>}
      {errorMsg && <p className="text-red-600 mb-4">{errorMsg}</p>}

      {articles.length === 0 && !editingArticle && !errorMsg && (
        <p className="text-gray-500 mb-6">Aucun article pour le moment.</p>
      )}

      {editingArticle && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">✏️ Modifier l'article</h2>

          <div className="mb-3">
            <label className="block font-medium">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Titre"
            />
          </div>

          <div className="mb-3">
            <label className="block font-medium">Contenu</label>
            <textarea
              rows="5"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Contenu"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block font-medium">Auteur (affiché)</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Ex: Service Communication"
              />
            </div>

            <div>
              <label className="block font-medium">Éditeur</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Association Bellevue Dembeni"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">URL de la source (si reprise)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="https://... (obligatoire pour contenu gouvernemental repris)"
              />
            </div>

            <div>
              <label className="block font-medium">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="published">Publié</option>
                <option value="draft">Brouillon</option>
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block font-medium">Nouvelle image (optionnelle)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full" />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Aperçu"
                className="mt-3 rounded-lg border border-gray-300 max-h-64 object-cover shadow-sm"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleUpdate}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              💾 Enregistrer
            </button>
            <button
              onClick={resetForm}
              className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
            >
              ❌ Annuler
            </button>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">📄 Liste des articles</h2>
      <ul className="space-y-4">
        {articles.map((article) => (
          <li key={article._id} className="p-4 bg-gray-100 rounded shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-800">{article.title}</h3>
              <span
                className={
                  "text-xs px-2 py-1 rounded " +
                  (article.status === "draft"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800")
                }
                title="Statut éditorial"
              >
                {article.status || "published"}
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-2">
              {formatDate(article.publishedAt || article.createdAt)}
              {(article.authorName || article.publisher)
                ? ` · ${article.authorName || article.publisher}`
                : ""}
            </p>

            <img
              src={toFullUrl(article.imageUrl)}
              alt={`Image de l'article ${article.title}`}
              className="h-40 w-full object-cover rounded border mb-3"
              loading="lazy"
            />

            <p className="text-gray-700 mb-3">
              {getPlainTextSnippet(article.content, 500)}
            </p>

            {!!article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline text-sm mb-2 inline-block"
                title="Voir la source officielle"
              >
                Voir la source
              </a>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleEditClick(article)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              >
                ✏️ Modifier
              </button>
              <button
                onClick={() => handleDelete(article._id)}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
              >
                🗑️ Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArticleListPage;
