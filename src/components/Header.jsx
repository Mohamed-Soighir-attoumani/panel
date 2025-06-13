import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <header className="bg-white border-b border-gray-200 text-black">
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
            <div className="flex items-center space-x-4">
              <div
                className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white"
                title="Administrateur"
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
            </div>
          </div>
        </header>
      </div>

      {/* Bande urgence en fixed, sous le header */}
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
