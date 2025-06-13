import React, { useState, useEffect } from "react";
import axios from "axios";

const ArticleListPage = () => {
  const [articles, setArticles] = useState([]);
  const [editingArticle, setEditingArticle] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/articles");
      setArticles(res.data);
    } catch (err) {
      console.error("Erreur chargement articles :", err);
      setErrorMsg("Impossible de charger les articles.");
    }
  };

  const handleEditClick = (article) => {
    setEditingArticle(article);
    setTitle(article.title || "");
    setContent(article.content || "");
    setImage(null);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleUpdate = async () => {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("content", content.trim());
    if (image) formData.append("image", image);

    try {
      await axios.put(
        `http://localhost:4000/api/articles/${editingArticle._id}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setSuccessMsg("✅ Article modifié avec succès.");
      resetForm();
      fetchArticles();
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet article ?")) return;
    try {
      await axios.delete(`http://localhost:4000/api/articles/${id}`);
      setSuccessMsg("✅ Article supprimé.");
      fetchArticles();
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur lors de la suppression.");
    }
  };

  const resetForm = () => {
    setEditingArticle(null);
    setTitle("");
    setContent("");
    setImage(null);
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
              onChange={(e) => setImage(e.target.files[0])}
              className="w-full"
            />
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
            <h3 className="text-lg font-bold text-gray-800">{article.title}</h3>
            <p className="text-gray-700 mb-2 truncate max-w-prose">{article.content}</p>

            {article.imageUrl && (
              <img
                src={`http://localhost:4000${article.imageUrl}`}
                alt="article"
                className="h-40 w-full object-cover rounded border mb-3"
              />
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
