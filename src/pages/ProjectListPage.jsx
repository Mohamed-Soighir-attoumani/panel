// src/pages/ProjectListPage.jsx
import React, { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import api from "../api";               // baseURL = API_URL (finit par /api)
import { API_URL, BASE_URL, PROJECTS_PATH } from "../config";

// On mémorise l’endpoint validé pour éviter de retester à chaque fois
const ENDPOINT_CACHE_KEY = "securidem:projectsEndpoint";

// Candidats courants (tu peux en ajouter si besoin)
const DEFAULT_CANDIDATES = ["/projects", "/projets", "/project", "/items/projects", "/contents/projects"];

/** Construit une URL d'image fiable (si relative) */
const toFullUrl = (p) => {
  if (!p) return "https://via.placeholder.com/600x200.png?text=Aucune+image";
  if (typeof p === "string" && /^https?:\/\//i.test(p)) return p;
  // Le backend sert /uploads à la racine (BASE_URL)
  return `${BASE_URL.replace(/\/$/, "")}${p.startsWith("/") ? "" : "/"}${p}`;
};

/** Essaye de découvrir l’endpoint en GET simple (avec tolérance au format de payload) */
async function resolveProjectsEndpoint(candidates, triedRef) {
  const cached = localStorage.getItem(ENDPOINT_CACHE_KEY);
  if (cached) return cached;

  for (const path of candidates) {
    triedRef.current.push(path);
    try {
      // NB: api a déjà /api → on passe un chemin RELATIF : "/projects"
      const res = await api.get(path, { validateStatus: () => true, timeout: 12000 });
      // 200 avec format attendu → validé
      if (
        res.status === 200 &&
        (Array.isArray(res.data) || Array.isArray(res.data?.items) || Array.isArray(res.data?.projects))
      ) {
        localStorage.setItem(ENDPOINT_CACHE_KEY, path);
        return path;
      }
      // 401/403 → on considère l’endpoint bon (seulement authent non valide)
      if (res.status === 401 || res.status === 403) {
        localStorage.setItem(ENDPOINT_CACHE_KEY, path);
        return path;
      }
    } catch {
      // on passe au suivant
    }
  }
  // défaut si rien n’a répondu
  return "/projects";
}

const ProjectListPage = () => {
  const [projects, setProjects] = useState([]);
  const [endpoint, setEndpoint] = useState(localStorage.getItem(ENDPOINT_CACHE_KEY) || (PROJECTS_PATH || "/projects"));

  const [editingProject, setEditingProject] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // pour afficher ce qu’on a testé si 404
  const triedPathsRef = useRef([]);

  useEffect(() => {
    (async () => {
      // on construit la liste de candidats : PROJECTS_PATH (si fourni) + défauts
      const candidatesBase = [];
      if (PROJECTS_PATH && typeof PROJECTS_PATH === "string") {
        candidatesBase.push(PROJECTS_PATH.startsWith("/") ? PROJECTS_PATH : `/${PROJECTS_PATH}`);
      }
      const candidates = [...new Set([...candidatesBase, ...DEFAULT_CANDIDATES])];

      const ep = await resolveProjectsEndpoint(candidates, triedPathsRef);
      setEndpoint(ep);
      await fetchProjects(ep);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // on résout et charge une seule fois au montage

  const normalizeList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.projects)) return payload.projects;
    return [];
  };

  const fetchProjects = async (ep = endpoint) => {
    try {
      const res = await api.get(ep, { validateStatus: () => true });
      if (res.status === 404) {
        // On remonte un message plus explicite
        const tried = triedPathsRef.current.length ? ` | chemins testés: ${triedPathsRef.current.join(", ")}` : "";
        throw new Error(`Endpoint introuvable (${ep})${tried}`);
      }
      if (res.status >= 400) {
        throw new Error(res?.data?.message || `HTTP ${res.status}`);
      }
      const data = normalizeList(res.data);
      setProjects(Array.isArray(data) ? data : []);
      setErrorMsg("");
    } catch (err) {
      console.error("Erreur chargement projets :", err);
      setProjects([]); // on évite les vieux états
      setErrorMsg(`❌ Impossible de charger les projets : ${err?.message || "erreur réseau"}`);
    }
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setName(project.name || "");
    setDescription(project.description || "");
    setImage(null);
    setImagePreview(project.imageUrl ? toFullUrl(project.imageUrl) : null);
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
    if (!editingProject?._id) return;

    const formData = new FormData();
    formData.append("name", (name || "").trim());
    formData.append("description", description || ""); // HTML ReactQuill
    if (image) formData.append("image", image);

    try {
      const res = await api.put(`${endpoint}/${editingProject._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        validateStatus: () => true,
      });
      if (res.status >= 400) {
        throw new Error(res?.data?.message || `HTTP ${res.status}`);
      }
      setSuccessMsg("✅ Projet modifié avec succès.");
      resetForm();
      fetchProjects();
    } catch (err) {
      console.error("Erreur mise à jour projet :", err);
      setErrorMsg(`❌ ${err?.message || "Erreur lors de la mise à jour"}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce projet ?")) return;
    try {
      const res = await api.delete(`${endpoint}/${id}`, { validateStatus: () => true });
      if (res.status >= 400) {
        throw new Error(res?.data?.message || `HTTP ${res.status}`);
      }
      setSuccessMsg("✅ Projet supprimé.");
      fetchProjects();
    } catch (err) {
      console.error("Erreur suppression projet :", err);
      setErrorMsg(`❌ ${err?.message || "Erreur lors de la suppression"}`);
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setName("");
    setDescription("");
    setImage(null);
    setImagePreview(null);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const getDescriptionSnippet = (html) => {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
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

      <h2 className="text-xl font-semibold mb-4">📋 Liste des projets</h2>
      {projects.length === 0 ? (
        <p className="text-gray-500">Aucun projet pour le moment.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project._id} className="p-4 bg-gray-100 rounded shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{project.name}</h3>

              <img
                src={toFullUrl(project.imageUrl)}
                alt={`Image du projet ${project.name}`}
                className="h-40 w-full object-cover rounded border mb-3"
                loading="lazy"
              />

              <p className="text-gray-700 mb-2">
                {getDescriptionSnippet(project.description)}
              </p>

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
      )}

      {/* Debug utile */}
      <p className="text-xs text-gray-400 mt-6">
        API: {API_URL} • Endpoint projets: <code>{endpoint}</code>
        {triedPathsRef.current.length > 0 && (
          <> • Chemins testés: <code>{triedPathsRef.current.join(", ")}</code></>
        )}
      </p>
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
