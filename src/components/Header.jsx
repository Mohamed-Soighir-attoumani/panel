// src/components/Header.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, LogOut } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || '';

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1] || '')); } catch { return null; }
}
function norm(v) { return (v || '').toString().trim().toLowerCase(); }

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const token = localStorage.getItem('token') || '';
  const payload = token ? decodeJwt(token) : null;
  const isImpersonated = !!payload?.impersonated;

  const [me, setMe] = useState({
    email: '',
    name: '',
    communeName: '',
    photo: '',
    role: '',
  });

  const quitImpersonation = () => {
    const orig = localStorage.getItem('token_orig');
    if (orig) {
      localStorage.setItem('token', orig);
      localStorage.removeItem('token_orig');
      window.location.reload();
    } else {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  // Pré-hydrate avec le JWT puis va chercher /api/me
  useEffect(() => {
    if (payload) {
      setMe(prev => ({
        ...prev,
        email: payload.email || prev.email,
        role: payload.role || prev.role,
        communeName: payload.communeName || prev.communeName,
      }));
    }

    if (!token || !API_URL) return;
    fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('token_orig');
          navigate('/login');
          return null;
        }
        const data = await r.json();
        const u = data?.user || {};
        const merged = {
          email: u.email || '',
          name: u.name || '',
          communeName: u.communeName || '',
          photo: u.photo || '',
          role: u.role || payload?.role || '',
        };
        setMe(merged);
        localStorage.setItem('admin', JSON.stringify(merged));
      })
      .catch(() => {
        // fallback cache local
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
    navigate('/login');
  };

  const pageTitle =
    location.pathname === '/dashboard'
      ? 'Tableau de bord'
      : location.pathname.split('/')[1]
        ? location.pathname.split('/')[1].charAt(0).toUpperCase() + location.pathname.split('/')[1].slice(1)
        : 'Tableau de bord';

  const badge =
    (me.communeName || '').trim() ||
    (me.name || '').trim() ||
    (me.email ? me.email.split('@')[0] : '');

  const isSuperadmin = norm(me.role) === 'superadmin';

  return (
    <>
      {/* ===== BANNIÈRE IMPERSONATION (si superadmin utilise un autre compte) ===== */}
      {isImpersonated && (
        <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-1 text-center z-50">
          Mode superadmin : vous utilisez un autre compte.
          <button onClick={quitImpersonation} className="ml-3 underline">
            Revenir à mon compte
          </button>
        </div>
      )}

      {/* ===== HEADER FIXE (mise en forme inspirée du 1er code) ===== */}
      <div className="fixed w-full top-0 left-0 z-50 shadow-md">
        <header className="bg-white border-b border-gray-200 text-black">
          <div className="flex items-center justify-between px-6 py-3 max-w-screen-xl mx-auto">
            {/* Gauche : Logo + menu burger */}
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden p-2 rounded hover:bg-gray-100"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>

              {/* Logo + lien dashboard */}
              <Link to="/dashboard" className="flex items-center gap-2">
                <img
                  src={require('../assets/images/securidem-logo.png')}
                  alt="Logo"
                  className="h-10 w-10 object-contain"
                />
              </Link>
            </div>

            {/* Titre centré (comme le 1er header) */}
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold tracking-wide uppercase text-gray-700">
              {pageTitle}
            </h1>

            {/* Droite : avatar + déconnexion (style du 1er) + menu Profil (du 2e) */}
            <div className="flex items-center space-x-4">
              {/* Avatar (ouvre le menu profil) */}
              <div
                onClick={() => setProfileOpen(!profileOpen)}
                className="h-10 w-10 rounded-full overflow-hidden cursor-pointer border-2 border-blue-500 hover:opacity-90 transition"
                title="Profil"
              >
                <img
                  src={me.photo || '/logo192.png'}
                  alt="Profil"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/logo192.png'; }}
                />
              </div>

              {/* Bouton Déconnexion (style du 1er header) */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Déconnexion</span>
              </button>

              {/* Menu Profil (du 2e header) */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    ref={profileRef}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-14 right-6 w-64 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-medium text-gray-800">
                        {me.name || badge || 'Mon profil'}
                      </p>
                      <p className="text-xs text-gray-500">{me.email}</p>
                      {isSuperadmin && (
                        <p className="text-[10px] font-semibold text-purple-700 tracking-wider mt-1">
                          SUPERADMINISTRATEUR
                        </p>
                      )}
                    </div>

                    <Link
                      to="/profil"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      🔄 Modifier les informations
                    </Link>

                    {isSuperadmin && (
                      <Link
                        to="/admins"
                        className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                        onClick={() => setProfileOpen(false)}
                      >
                        👥 Administrateurs (communes)
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      </div>

      {/* ===== Bande d’urgence FIXE sous le header (comme le 1er code) ===== */}
      <AnimatePresence>
        {location.pathname.startsWith('/incident') && (
          <motion.div
            key="emergency-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed top-[64px] z-40 w-full lg:ml-64 lg:w-[calc(100%-16rem)] bg-gradient-to-r from-red-100 to-orange-100 text-black border-t border-red-300 shadow"
          >
            <div className="px-4 py-2">
              <div className="flex flex-wrap justify-center gap-2 text-sm font-medium text-gray-800 text-center">
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

      {/* ===== Menu mobile latéral (du 2e header) ===== */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed top-16 left-0 w-52 h-[calc(100vh-64px)] bg-gray-900 text-white p-6 z-40 shadow-lg lg:hidden"
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
            <Link to="/articles" onClick={() => setMenuOpen(false)} className="block py-2">
              📝 Créer un Article
            </Link>
            <Link to="/articles/liste" onClick={() => setMenuOpen(false)} className="block py-2">
              📋 Liste des articles
            </Link>
            <Link to="/projects" onClick={() => setMenuOpen(false)} className="block py-2">
              📁 Créer un Projet
            </Link>
            <Link to="/projects/liste" onClick={() => setMenuOpen(false)} className="block py-2">
              📄 Liste des projets
            </Link>
            {isSuperadmin && (
              <Link to="/admins" onClick={() => setMenuOpen(false)} className="block py-2">
                👥 Administrateurs (communes)
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
