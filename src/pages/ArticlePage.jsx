import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { API_URL } from "../config"; // ← adapte le chemin selon ton projet

const quillModules = {
  toolbar: [
    [{ font: [] }],
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ align: [] }],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"],
    ["clean"],
  ],
};

const quillFormats = [
  "font",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "align",
  "color",
  "background",
  "list",
  "bullet",
  "link",
  "image",
];

// ✅ Composant réutilisable pour messages
const FormMessage = ({ type, message }) => {
  const colorClass =
    type === "success"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  return (
    <div className={`${colorClass} px-4 py-2 rounded mb-4 animate-fadeIn`} role="alert">
      {message}
    </div>
  );
};

const ArticlePage = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Aperçu image
  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(image);
  }, [image]);

  // Effacement automatique des messages
  useEffect(() => {
    const timer = setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      setErrorMessage("Veuillez remplir tous les champs requis.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    if (image) formData.append("image", image);

    try {
      setIsSubmitting(true);
      await axios.post(`${API_URL}/api/articles`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccessMessage("✅ Article créé avec succès.");
      setTitle("");
      setContent("");
      setImage(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Erreur création article:", error.response || error.message);
      setErrorMessage("❌ Erreur lors de la création de l'article.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📝 Créer un nouvel article</h1>

      {successMessage && <FormMessage type="success" message={successMessage} />}
      {errorMessage && <FormMessage type="error" message={errorMessage} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Titre */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 p-2 border border-gray-300 rounded focus:outline-blue-500"
            required
          />
        </div>

        {/* Contenu */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Contenu <span className="text-red-500">*</span>
          </label>
          <ReactQuill
            value={content}
            onChange={setContent}
            modules={quillModules}
            formats={quillFormats}
            className="bg-white"
            style={{ height: "200px", marginBottom: "40px" }}
          />
        </div>

        {/* Image */}
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700">
            Image (optionnelle)
          </label>
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
            className="w-full mt-1 p-2 border border-gray-300 rounded"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Aperçu"
              className="mt-3 rounded-lg border border-gray-300 max-h-64 object-cover shadow-sm"
            />
          )}
        </div>

        {/* Bouton */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Publier l'article"
          className={`w-full p-3 text-white rounded transition ${
            isSubmitting ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? "⏳ Publication en cours..." : "📤 Publier l'article"}
        </button>
      </form>

      {/* Retour + CTA */}
      <div className="mt-6 text-center space-y-2">
        <Link to="/articles/liste" className="text-blue-600 hover:underline">
          ← Retour à la liste des articles
        </Link>

        {successMessage && (
          <div>
            <Link
              to="/articles/liste"
              className="inline-block mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              📄 Voir mes articles
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticlePage;
