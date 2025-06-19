import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { API_URL } from "../config";

const ProjectListPage = () => {
  const [projects, setProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/projects`);
      setProjects(res.data);
      setErrorMsg("");
    } catch (err) {
      console.error("Erreur chargement projets :", err);
      setErrorMsg("❌ Impossible de charger les projets.");
    }
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setName(project.name || "");
    setDescription(project.description || "");
    setImage(null);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleUpdate = async () => {
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description);
    if (image) formData.append("image", image);

    try {
      await axios.put(`${API_URL}/api/projects/${editingProject._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccessMsg("✅ Projet modifié avec succès.");
      resetForm();
      fetchProjects();
    } catch (err) {
      console.error("Erreur mise à jour projet :", err);
      setErrorMsg("❌ Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce projet ?")) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${id}`);
      setSuccessMsg("✅ Projet supprimé.");
      fetchProjects();
    } catch (err) {
      console.error("Erreur suppression projet :", err);
      setErrorMsg("❌ Erreur lors de la suppression.");
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setName("");
    setDescription("");
    setImage(null);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const getDescriptionSnippet = (html) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || "";
    return text.length > 100 ? text.slice(0, 100) + "..." : text;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📁 Gestion des Projets</h1>

      {successMsg && <p className="text-green-600 mb-4">{successMsg}</p>}
      {errorMsg && <p className="text-red-600 mb-4">{errorMsg}</p>}

      {editingProject && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">✏️ Modifier le projet</h2>

          <div className="mb-3">
            <label className="block font-medium">Nom du projet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Nom"
            />
          </div>

          <div className="mb-3">
            <label className="block font-medium">Description</label>
            <ReactQuill
              value={description}
              onChange={setDescription}
              modules={ProjectListPage.modules}
              formats={ProjectListPage.formats}
              className="bg-white"
              style={{ height: "200px", marginBottom: "40px" }}
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

      <h2 className="text-xl font-semibold mb-4">📋 Liste des projets</h2>
      <ul className="space-y-4">
        {projects.map((project) => (
          <li key={project._id} className="p-4 bg-gray-100 rounded shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{project.name}</h3>
            <p className="text-gray-700 mb-2">{getDescriptionSnippet(project.description)}</p>

            <img
              src={
                project.imageUrl?.startsWith("/uploads/")
                  ? `${API_URL.replace(/\/$/, "")}${project.imageUrl}`
                  : "https://via.placeholder.com/600x200.png?text=Aucune+image"
              }
              alt={`Image du projet ${project.name}`}
              className="h-40 w-full object-cover rounded border mb-3"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleEditClick(project)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              >
                ✏️ Modifier
              </button>
              <button
                onClick={() => handleDelete(project._id)}
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

ProjectListPage.modules = {
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

ProjectListPage.formats = [
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

export default ProjectListPage;
