import React, { useState, useEffect } from "react";
import api from "../api"; // 👈 remplace axios direct
import { API_URL } from "../config";

const ArticleListPage = () => {
  const [articles, setArticles] = useState([]);
  const [editingArticle, setEditingArticle] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const res = await api.get(`/api/articles`);
      setArticles(res.data);
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
    setImagePreview(article.imageUrl || null);
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

    const formData = new FormData();
    formData.append("title", (title || "").trim());
    formData.append("content", (content || "").trim());
    if (image) formData.append("image", image);

    try {
      await api.put(`/api/articles/${editingArticle._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
      await api.delete(`/api/articles/${id}`);
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
  };

  const getPlainTextSnippet = (html, maxLength = 500) => {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    const text = temp.textContent || temp.innerText || "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📚 Gestion des Articles</h1>

      {successMsg && <p className="text-green-600 mb-4">{successMsg}</p>}
      {errorMsg && <p className="text-red-600 mb-4">{errorMsg}</p>}

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

          <div className="mb-3">
            <label className="block font-medium">Nouvelle image (optionnelle)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full"
            />
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
            <h3 className="text-lg font-bold text-gray-800 mb-2">{article.title}</h3>

            <img
              src={
                article.imageUrl
                  ? article.imageUrl
                  : "https://via.placeholder.com/600x200.png?text=Aucune+image"
              }
              alt={`Image de l'article ${article.title}`}
              className="h-40 w-full object-cover rounded border mb-3"
            />

            <p className="text-gray-700 mb-2">
              {getPlainTextSnippet(article.content, 500)}
            </p>

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
