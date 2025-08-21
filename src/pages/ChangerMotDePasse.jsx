import React, { useMemo, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChangerMotDePasse = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsOld, setCapsOld] = useState(false);
  const [capsNew, setCapsNew] = useState(false);
  const [capsConfirm, setCapsConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || '';

  // === Validation / force ===
  const checks = useMemo(() => {
    const len = newPassword.length >= 8; // petit + : 8 mini
    const upper = /[A-Z]/.test(newPassword);
    const digit = /\d/.test(newPassword);
    const special = /[!@#$%^&*(),.?":{}|<>_\-\[\]\\;/+=`~'€£§%]/.test(newPassword);
    const differentFromOld = newPassword && oldPassword && newPassword !== oldPassword;
    return { len, upper, digit, special, differentFromOld };
  }, [newPassword, oldPassword]);

  const strengthLabel = useMemo(() => {
    const score =
      (checks.len ? 1 : 0) +
      (checks.upper ? 1 : 0) +
      (checks.digit ? 1 : 0) +
      (checks.special ? 1 : 0) +
      (checks.differentFromOld ? 1 : 0);

    if (newPassword.length === 0) return '';
    if (score <= 2) return 'Faible';
    if (score === 3 || score === 4) return 'Moyen';
    return 'Fort';
  }, [checks, newPassword.length]);

  const strengthWidth = useMemo(() => {
    if (!newPassword) return '0%';
    if (strengthLabel === 'Faible') return '33%';
    if (strengthLabel === 'Moyen') return '66%';
    return '100%';
  }, [strengthLabel, newPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!API_URL) {
      toast.error("Configuration manquante : REACT_APP_API_URL");
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('❌ Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    if (!checks.len || !checks.upper || !checks.digit || !checks.special) {
      toast.error("Le nouveau mot de passe n'est pas assez fort.");
      return;
    }

    if (!checks.differentFromOld) {
      toast.error("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vous devez être connecté.');
      window.location.href = '/login';
      return;
    }

    // fetch avec timeout pour éviter les blocages
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
        signal: controller.signal,
      });

      clearTimeout(id);

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (response.status === 401 || response.status === 403) {
        toast.error(data.message || 'Session expirée. Veuillez vous reconnecter.');
        localStorage.removeItem('token');
        setTimeout(() => (window.location.href = '/login'), 800);
        return;
      }

      if (!response.ok) {
        const msg = data.message || 'Erreur lors de la mise à jour.';
        throw new Error(msg);
      }

      toast.success(data.message || '✅ Mot de passe modifié avec succès.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.name === 'AbortError') {
        toast.error('Délai dépassé. Réessayez dans un instant.');
      } else {
        toast.error(error.message || 'Erreur inconnue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const HelperLine = ({ ok, label }) => (
    <li className={`text-xs flex items-center gap-2 ${ok ? 'text-green-600' : 'text-gray-500'}`}>
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ok ? '#16a34a' : '#9ca3af' }} />
      {label}
    </li>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <ToastContainer />
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
          Modifier le mot de passe
        </h2>

        {!API_URL && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            Variable <code>REACT_APP_API_URL</code> absente côté front.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ancien mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Ancien mot de passe</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                onKeyUp={(e) => setCapsOld(e.getModifierState && e.getModifierState('CapsLock'))}
                required
                autoComplete="current-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowOld(!showOld)}
                aria-label={showOld ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                tabIndex={-1}
              >
                {showOld ? '👁️‍🗨️' : '🙈'}
              </button>
            </div>
            {capsOld && (
              <p className="mt-1 text-xs text-orange-600">Verr. Maj activée</p>
            )}
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyUp={(e) => setCapsNew(e.getModifierState && e.getModifierState('CapsLock'))}
                required
                autoComplete="new-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                tabIndex={-1}
              >
                {showNew ? '👁️‍🗨️' : '🙈'}
              </button>
            </div>

            {/* Barre de force */}
            {newPassword && (
              <>
                <div className="mt-2 h-1 w-full bg-gray-200 rounded">
                  <div
                    className={`h-1 rounded ${strengthLabel === 'Fort' ? 'bg-green-600' : strengthLabel === 'Moyen' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: strengthWidth, transition: 'width 200ms' }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Force : <span className="font-semibold">{strengthLabel}</span>
                </p>
              </>
            )}

            {/* Checklist */}
            <ul className="mt-2 space-y-1">
              <HelperLine ok={checks.len} label="Au moins 8 caractères" />
              <HelperLine ok={checks.upper} label="Au moins une majuscule (A-Z)" />
              <HelperLine ok={checks.digit} label="Au moins un chiffre (0-9)" />
              <HelperLine ok={checks.special} label="Au moins un caractère spécial" />
              <HelperLine ok={checks.differentFromOld} label="Différent de l'ancien mot de passe" />
            </ul>

            {capsNew && (
              <p className="mt-1 text-xs text-orange-600">Verr. Maj activée</p>
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
                onKeyUp={(e) => setCapsConfirm(e.getModifierState && e.getModifierState('CapsLock'))}
                required
                autoComplete="new-password"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-10"
                disabled={loading}
                onPaste={(e) => e.preventDefault()} // évite erreurs de copier-coller
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-sm cursor-pointer text-blue-500"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                tabIndex={-1}
              >
                {showConfirm ? '👁️‍🗨️' : '🙈'}
              </button>
            </div>
            {capsConfirm && (
              <p className="mt-1 text-xs text-orange-600">Verr. Maj activée</p>
            )}
          </div>

          {/* Champ username caché pour l’accessibilité (ne change pas le style) */}
          <input type="text" name="username" autoComplete="username" hidden readOnly />

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 rounded transition ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'En cours…' : 'Valider'}
          </button>

          {/* Petit tip de debug optionnel (non intrusif) */}
          {/* <p className="text-[11px] text-gray-400 text-center">
            Endpoint: {API_URL ? `${API_URL}/api/change-password` : 'API_URL manquant'}
          </p> */}
        </form>
      </div>
    </div>
  );
};

export default ChangerMotDePasse;
