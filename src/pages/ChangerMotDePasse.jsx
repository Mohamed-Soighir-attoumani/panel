import React, { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChangerMotDePasse = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || '';

  const getPasswordStrength = (password) => {
    if (password.length < 6) return 'Faible';
    if (/[A-Z]/.test(password) && /\d/.test(password) && /[!@#$%^&*]/.test(password)) return 'Fort';
    return 'Moyen';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!API_URL) {
      toast.error("Configuration manquante : REACT_APP_API_URL");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('❌ Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vous devez être connecté.');
      window.location.href = '/login';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (response.status === 401 || response.status === 403) {
        toast.error(data.message || 'Session expirée. Veuillez vous reconnecter.');
        localStorage.removeItem('token');
        setTimeout(() => (window.location.href = '/login'), 800);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la mise à jour.');
      }

      toast.success(data.message || '✅ Mot de passe modifié avec succès.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.message || 'Erreur inconnue.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <ToastContainer />
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
          Modifier le mot de passe
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ancien mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Ancien mot de passe</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
              />
              <span
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowOld(!showOld)}
              >
                {showOld ? '👁️‍🗨️' : '🙈'}
              </span>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
              />
              <span
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? '👁️‍🗨️' : '🙈'}
              </span>
            </div>
            {newPassword && (
              <p className="text-xs text-gray-500 mt-1">
                Force : <span className="font-semibold">{getPasswordStrength(newPassword)}</span>
              </p>
            )}
          </div>

          {/* Confirmer le mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
              />
              <span
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? '👁️‍🗨️' : '🙈'}
              </span>
            </div>
          </div>

          {/* Champ username caché pour l’accessibilité (ne change pas le style) */}
          <input type="text" name="username" autoComplete="username" hidden readOnly />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            Valider
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangerMotDePasse;
