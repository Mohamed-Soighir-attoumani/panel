// src/components/Header.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { API_URL } from '../config';

// ✅ Normalise la base API (évite /api/api)
const BASE_API = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
// ✅ Origin de l'API (utile pour servir des fichiers quand l'URL est relative)
const API_ORIGIN = API_URL.replace(/\/api$/, '');

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1] || '';
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
function norm(v) { return (v || '').toString().trim().toLowerCase(); }

// 🔗 force une URL absolue vers l'API si on reçoit un chemin relatif
function absUrl(u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;       // déjà absolue
  if (u.startsWith('//')) return window.location.protocol + u;
  if (u.startsWith('/')) return `${API_ORIGIN}${u}`;
  return `${API_ORIGIN}/${u}`;
}

// util cache-buster (évite d’anciennes versions du logo)
function withBust(url, ver) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  const t = ver ? String(ver) : String(Date.now());
  return `${url}${sep}t=${encodeURIComponent(t)}`;
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
  const payload = token ? decodeJwt(token) : null;
  const isImpersonated = !!payload?.impersonated;

  const [me, setMe] = useState({
    email: '',
    name: '',
    communeName: '',
    communeId: '',
    photo: '',
    communeLogo: '',
    role: '',
    logoVersion: '',
  });

  const quitImpersonation = () => {
    const orig = localStorage.getItem('token_orig');
    if (orig) {
      localStorage.setItem('token', orig);
      localStorage.removeItem('token_orig');
      window.location.reload();
    } else {
      localStorage.removeItem('token');
      navigate('/login', { replace: true });
    }
  };

  // Pré-hydrate avec le JWT puis va chercher /me
  useEffect(() => {
    if (payload) {
      setMe(prev => ({
        ...prev,
        email: payload.email || prev.email,
        role: payload.role || prev.role,
        communeName: payload.communeName || prev.communeName,
        communeId: payload.communeId || prev.communeId,
      }));
    }

    if (!token) return;
    fetch(`${BASE_API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('token_orig');
          navigate('/login', { replace: true });
          return null;
        }
        const data = await r.json().catch(() => ({}));
        const u = data?.user || {};

        // On récupère un logo de commune si dispo, quels que soient les noms utilisés côté backend
        const communeLogo =
          u.communeLogo ||
          u.logoUrl ||
          u.logo ||
          (u.commune && (u.commune.logo || u.commune.logoUrl)) ||
          '';

        const merged = {
          email: u.email || '',
          name: u.name || '',
          communeName: u.communeName || (u.commune && u.commune.name) || '',
          communeId: u.communeId || (u.commune && (u.commune.id || u.commune._id)) || '',
          photo: u.photo || '',
          communeLogo,
          role: u.role || payload?.role || '',
          logoVersion: u.updatedAt || u.logoUpdatedAt || u.photoUpdatedAt || '',
        };

        setMe(merged);

        // Persiste pour Sidebar & autres
        localStorage.setItem('admin', JSON.stringify(merged));
        localStorage.setItem('me', JSON.stringify({
          email: merged.email,
          name: merged.name,
          communeName: merged.communeName,
          role: merged.role,
          communeId: merged.communeId,
          photo: merged.photo,
          communeLogo: merged.communeLogo,
          logoVersion: merged.logoVersion,
        }));
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('admin');
          if (raw) setMe(prev => ({ ...prev, ...JSON.parse(raw) }));
        } catch {}
      });
  }, []); // une fois au montage

  // Fermer le menu profil au clic hors
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('token_orig');
    localStorage.removeItem('admin');
    localStorage.removeItem('me');
    navigate('/login', { replace: true });
  };

  const pageTitle =
    location.pathname === '/dashboard'
      ? 'Tableau de bord'
      : location.pathname.split('/')[1]
        ? location.pathname.split('/')[1].charAt(0).toUpperCase() + location.pathname.split('/')[1].slice(1)
        : 'Tableau de bord';

  const isSuperadmin = norm(me.role) === 'superadmin';
  const isAdmin = norm(me.role) === 'admin';

  // 🖼️ Avatar à afficher :
  // 1) admin -> logo de la commune (prioritaire)
  // 2) sinon -> photo utilisateur
  // 3) fallback -> logo par défaut
  const rawAvatar = (isAdmin && me.communeLogo) ? me.communeLogo : (me.photo || '');
  const avatarAbs = absUrl(rawAvatar); // <— corrige les URLs relatives
  const avatarSrc = withBust(avatarAbs || '/logo192.png', me.logoVersion || '');

  const badgeUnderAvatar = isSuperadmin
    ? 'SUPERADMINISTRATEUR'
    : ((me.communeName || '').trim());

  return (
    <>
      {/* Bannière impersonation */}
      {isImpersonated && (
        <div className="w-full bg-yellow-100 text-yellow-900 text-xs sm:text-sm py-1 text-center z-50">
          Mode superadmin : vous utilisez un autre compte.
          <button onClick={quitImpersonation} className="ml-3 underline">
            Revenir à mon compte
          </button>
        </div>
      )}

      {/* HEADER FIXE */}
      <div className="fixed w-full top-0 left-0 z-50 shadow-md">
        <header className="bg-white border-b border-gray-200 text-black">
          <div className="flex items-center justify-between px-4 sm:px-6 py-2 max-w-screen-xl mx-auto">
            {/* Gauche : burger + Mon Abonnement (admin) */}
            <div className="flex items-center">
              <button
                className="lg:hidden p-2 rounded hover:bg-gray-100"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>

              {isAdmin && (
                <>
                  {/* mobile icône seule */}
                  <Link
                    to="/mon-abonnement"
                    className="sm:hidden ml-2 p-2 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                    aria-label="Mon abonnement"
                  >
                    💳
                  </Link>
                  {/* ≥ sm texte */}
                  <Link
                    to="/mon-abonnement"
                    className="hidden sm:inline-flex ml-2 items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                    title="Voir mon abonnement et mes factures"
                  >
                    <span>💳</span>
                    <span>Mon abonnement</span>
                  </Link>
                </>
              )}
            </div>

            {/* Titre centré */}
            <h1 className="absolute left-1/2 -translate-x-1/2 text-base sm:text-lg md:text-xl font-bold tracking-wide uppercase text-gray-700">
              {pageTitle}
            </h1>

            {/* Droite : avatar + profil */}
            <div className="relative flex flex-col items-center leading-none">
              <div
                onClick={() => setProfileOpen((o) => !o)}
                className="h-10 w-10 rounded-full overflow-hidden cursor-pointer border-2 border-blue-500 hover:opacity-90 transition"
                title="Profil"
              >
                <img
                  src={avatarSrc}
                  alt="Profil"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    console.warn('Image de profil introuvable:', avatarSrc);
                    e.currentTarget.src = '/logo192.png';
                  }}
                />
              </div>

              {badgeUnderAvatar ? (
                <span className="text-[10px] font-semibold text-gray-700 tracking-wide uppercase mt-0.5">
                  {badgeUnderAvatar}
                </span>
              ) : null}

              {/* Menu Profil */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    ref={profileRef}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-12 right-0 w-64 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-medium text-gray-800">
                        {me.name || (me.email ? me.email.split('@')[0] : 'Mon profil')}
                      </p>
                      <p className="text-xs text-gray-500">{me.email}</p>
                      {isSuperadmin && (
                        <p className="text-[10px] font-semibold text-purple-700 tracking-wider mt-1">
                          SUPERADMINISTRATEUR
                        </p>
                      )}
                    </div>

                    {isSuperadmin && (
                      <Link
                        to="/profil"
                        className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                        onClick={() => setProfileOpen(false)}
                      >
                        🔄 Modifier les informations
                      </Link>
                    )}

                    {isSuperadmin && (
                      <Link
                        to="/admins"
                        className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                        onClick={() => setProfileOpen(false)}
                      >
                        👥 Administrateurs
                      </Link>
                    )}

                    {isSuperadmin && (
                      <Link
                        to="/utilisateurs"
                        className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                        onClick={() => setProfileOpen(false)}
                      >
                        👤 Utilisateurs
                      </Link>
                    )}

                    <Link
                      to="/changer-photo"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      🖼️ Changer la photo
                    </Link>
                    <Link
                      to="/changer-mot-de-passe"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      🔒 Changer le mot de passe
                    </Link>
                    <Link
                      to="/parametres"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      ⚙️ Paramètres
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-200"
                    >
                      🚪 Déconnexion
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      </div>

      {/* Bande d’urgence FIXE sous le header (top 56px) */}
      <AnimatePresence>
        {location.pathname.startsWith('/incident') && (
          <motion.div
            key="emergency-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed top-[56px] z-40 w-full lg:ml-64 lg:w-[calc(100%-16rem)] bg-gradient-to-r from-red-100 to-orange-100 text-black border-t border-red-300 shadow"
          >
            <div className="px-4 py-2">
              <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm font-medium text-gray-800 text-center">
                <p><strong>👮 Police :</strong> 17</p>
                <p><strong>🚓 Gendarmerie :</strong> 06 39 00 00 00</p>
                <p><strong>🚒 Pompiers :</strong> 18</p>
                <p><strong>🚑 Urgences :</strong> 15</p>
                <p><strong>🏛️ Mairie :</strong> 0269 61 00 00</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu mobile latéral (top 56px) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed top-[56px] left-0 w-52 h-[calc(100vh-56px)] bg-gray-900 text-white p-6 z-40 shadow-lg lg:hidden"
          >
            <p className="mb-4 font-bold">Menu</p>
            <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block py-2">
              🏠 Tableau de bord
            </Link>
            <Link to="/incidents" onClick={() => setMenuOpen(false)} className="block py-2">
              📢 Incidents
            </Link>
            <Link to="/notifications" onClick={() => setMenuOpen(false)} className="block py-2">
              🔔 Notifications
            </Link>
            {/* ✅ routes alignées avec la sidebar */}
            <Link to="/articles/nouveau" onClick={() => setMenuOpen(false)} className="block py-2">
              📝 Créer un Article
            </Link>
            <Link to="/articles/liste" onClick={() => setMenuOpen(false)} className="block py-2">
              📋 Liste des articles
            </Link>
            <Link to="/projects/nouveau" onClick={() => setMenuOpen(false)} className="block py-2">
              📁 Créer un Projet
            </Link>
            <Link to="/projects/liste" onClick={() => setMenuOpen(false)} className="block py-2">
              📄 Liste des projets
            </Link>

            {isAdmin && (
              <Link to="/mon-abonnement" onClick={() => setMenuOpen(false)} className="block py-2">
                💳 Mon abonnement
              </Link>
            )}
            {isSuperadmin && (
              <Link to="/admins" onClick={() => setMenuOpen(false)} className="block py-2">
                👥 Administrateurs (communes)
              </Link>
            )}
            {isSuperadmin && (
              <Link to="/utilisateurs" onClick={() => setMenuOpen(false)} className="block py-2">
                👤 Utilisateurs
              </Link>
            )}
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="block w-full text-left py-2 mt-4 text-red-300 hover:text-white"
            >
              🚪 Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
