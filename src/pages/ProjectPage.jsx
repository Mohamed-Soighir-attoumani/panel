import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { API_URL } from "../config"; 

const ProjectPage = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState(""); 
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Aperçu image
  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(image);
  }, [image]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      setErrorMessage("Veuillez remplir tous les champs.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description); // HTML du Quill
    if (image) formData.append("image", image);

    try {
      await axios.post(`${API_URL}/api/projects`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccessMessage("✅ Projet créé avec succès !");
      setErrorMessage("");
      setName("");
      setDescription("");
      setImage(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Erreur création projet :", error);
      setErrorMessage("❌ Une erreur est survenue lors de la création.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🚀 Créer un projet</h1>

      {successMessage && (
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded mb-4">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nom du projet */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nom du projet <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 p-2 border border-gray-300 rounded"
            required
          />
        </div>

        {/* Description avec éditeur riche */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <ReactQuill
            value={description}
            onChange={setDescription}
            modules={ProjectPage.modules}
            formats={ProjectPage.formats}
            className="bg-white"
            style={{ height: "200px", marginBottom: "40px" }}
          />
        </div>

        {/* Image */}
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700">
            Image du projet (optionnelle)
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
              className="mt-3 rounded border max-h-64 object-cover"
            />
          )}
        </div>

        {/* Bouton */}
        <button
          type="submit"
          className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          ✅ Créer le projet
        </button>
      </form>
    </div>
  );
};

// Options de l'éditeur ReactQuill
ProjectPage.modules = {
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

ProjectPage.formats = [
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

export default ProjectPage;
