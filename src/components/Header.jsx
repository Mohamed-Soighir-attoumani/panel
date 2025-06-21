import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [adminInfo, setAdminInfo] = useState({ nom: '', prenom: '', email: '', photo: '' });

  const pageTitle =
    location.pathname === "/dashboard"
      ? "Tableau de bord"
      : location.pathname.split("/")[1].charAt(0).toUpperCase() +
        location.pathname.split("/")[1].slice(1);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  useEffect(() => {
    const stored = localStorage.getItem('admin');
    if (stored) {
      try {
        setAdminInfo(JSON.parse(stored));
      } catch (err) {
        console.error("Erreur parsing admin info", err);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen]);

  return (
    <>
      {/* Header principal */}
      <div className="fixed w-full top-0 left-0 z-50 shadow-md">
        <header className="bg-white border-b border-gray-200 text-black relative">
          <div className="flex items-center justify-between px-6 py-3 max-w-screen-xl mx-auto">
            {/* Logo + menu burger */}
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden p-2 rounded hover:bg-gray-100"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
              <img
                src={require('../assets/images/securidem-logo.png')}
                alt="Logo"
                className="h-10 w-10 object-contain"
              />
            </div>

            {/* Titre centré */}
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold tracking-wide uppercase text-gray-700">
              {pageTitle}
            </h1>

            {/* Profil */}
            <div className="relative flex flex-col items-center space-y-1">
              <div
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="h-10 w-10 rounded-full overflow-hidden cursor-pointer border-2 border-blue-500 hover:opacity-90 transition"
                title="Profil administrateur"
              >
                <img
                  src={adminInfo.photo || require('../assets/images/securidem-logo.png')}
                  alt="Profil"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xs text-gray-700">Mairie de Dembeni</span>

              {/* Menu Profil */}
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    ref={profileMenuRef}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-14 right-0 w-64 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-medium text-gray-800">
                        {adminInfo.prenom} {adminInfo.nom}
                      </p>
                      <p className="text-xs text-gray-500">{adminInfo.email}</p>
                    </div>

                    <Link to="/profil" className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700" onClick={() => setProfileMenuOpen(false)}>
                      🔄 Modifier les informations
                    </Link>
                    <Link to="/changer-photo" className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700" onClick={() => setProfileMenuOpen(false)}>
                      🖼️ Changer la photo
                    </Link>
                    <Link to="/changer-mot-de-passe" className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700" onClick={() => setProfileMenuOpen(false)}>
                      🔒 Changer le mot de passe
                    </Link>
                    <Link to="/parametres" className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700" onClick={() => setProfileMenuOpen(false)}>
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

      {/* Bande d’urgence sous le header, derrière le sidebar */}
      <AnimatePresence>
        {location.pathname.startsWith("/incident") && (
          <motion.div
            key="emergency-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute top-[64px] left-0 w-full z-10 bg-gradient-to-r from-red-100 to-orange-100 text-black border-t border-red-300 shadow"
          >
            <div className="px-4 py-2 mt-4 lg:ml-64">
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

      {/* Menu mobile latéral */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3 }}
            className="fixed top-16 left-0 w-52 h-[calc(100vh-64px)] bg-gray-900 text-white p-6 z-40 shadow-lg lg:hidden"
          >
            <p className="mb-4 font-bold">Menu mobile (à compléter)</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
