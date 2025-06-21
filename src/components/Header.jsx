import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const pageTitle =
    location.pathname === "/dashboard"
      ? "Tableau de bord"
      : location.pathname.split("/")[1].charAt(0).toUpperCase() +
        location.pathname.split("/")[1].slice(1);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <>
      {/* Header principal en haut */}
      <div className="fixed w-full top-0 left-0 z-50 shadow-md">
        <header className="bg-white border-b border-gray-200 text-black relative">
          <div className="flex items-center justify-between px-6 py-3 max-w-screen-xl mx-auto">
            {/* Gauche : Logo + Menu burger */}
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

            {/* Droite : avatar + déconnexion */}
            <div className="relative flex items-center space-x-4">
              <div
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white cursor-pointer hover:opacity-90 transition"
                title="Profil administrateur"
              >
                A
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Déconnexion</span>
              </button>

              {/* Menu déroulant du profil */}
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-14 right-0 w-56 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-50"
                  >
                    <Link
                      to="/changer-mot-de-passe"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      🔒 Modifier le mot de passe
                    </Link>
                    <Link
                      to="/utilisateurs"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      👥 Gérer les utilisateurs
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                      onClick={() => setProfileMenuOpen(false)}
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

      {/* Bande urgence */}
      <AnimatePresence>
        {location.pathname.startsWith("/incident") && (
          <motion.div
            key="emergency-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
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
            <p className="text-sm text-gray-400">Exemple de menu à ouvrir</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
