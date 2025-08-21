// src/pages/ChangerPhoto.jsx
import React, { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const ChangerPhoto = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview('');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!API_URL) {
      toast.error('Configuration manquante : REACT_APP_API_URL');
      return;
    }
    if (!file) {
      toast.error('Choisis un fichier image (jpg, png, webp).');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vous devez être connecté.');
      window.location.href = '/login';
      return;
    }

    const form = new FormData();
    form.append('photo', file);

    try {
      const r = await fetch(`${API_URL}/api/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.message || 'Échec de l’upload');
      }

      // Mettre à jour le cache admin (utilisé par le Header)
      const current = (() => {
        try {
          return JSON.parse(localStorage.getItem('admin') || '{}');
        } catch {
          return {};
        }
      })();
      const next = { ...current, photo: data.url };
      localStorage.setItem('admin', JSON.stringify(next));

      toast.success('✅ Photo mise à jour');
      // Optionnel : rafraîchir la page après un court délai pour forcer l’avatar
      setTimeout(() => window.location.reload(), 600);
    } catch (e2) {
      toast.error(e2.message || 'Erreur inconnue');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <ToastContainer />
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
          Changer la photo de profil
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sélectionner une image (jpg, png, webp)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFile}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          {preview && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-1">Aperçu :</p>
              <img
                src={preview}
                alt="Aperçu"
                className="w-32 h-32 object-cover rounded-full border"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            Mettre à jour
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangerPhoto;
