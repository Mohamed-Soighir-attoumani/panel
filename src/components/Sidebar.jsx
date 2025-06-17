import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const Sidebar = () => {
  const [hasPendingIncidents, setHasPendingIncidents] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await axios.get("https://backend-admin-tygd.onrender.com/api/incidents");
        const incidentsEnCours = res.data.filter(i => i.status === "En cours");
        setHasPendingIncidents(incidentsEnCours.length > 0);
      } catch (error) {
        console.error("Erreur récupération incidents", error);
      }
    };

    fetchIncidents();
    const intervalId = setInterval(fetchIncidents, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div
      className={`bg-gray-900 text-white ${
        isCollapsed ? 'w-16' : 'w-64'
      } h-[calc(100vh-64px)] fixed top-16 left-0 p-4 flex flex-col justify-between transition-all duration-300`}
    >
      <div>
        <div className="flex justify-start mb-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white transition"
            title={isCollapsed ? 'Déplier' : 'Replier'}
          >
            {isCollapsed ? '➡️' : '⬅️'}
          </button>
        </div>

        <nav className="mt-2">
          <ul className="space-y-6">
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/dashboard') ? 'text-blue-400' : 'hover:text-blue-300'
                }`}
              >
                🏠 {!isCollapsed && 'Tableau de bord'}
              </Link>
            </li>

            <li className="relative">
              <Link
                to="/incidents"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  hasPendingIncidents
                    ? 'text-red-400 animate-pulse'
                    : isActive('/incidents')
                    ? 'text-blue-400'
                    : 'hover:text-blue-300'
                }`}
              >
                📢 {!isCollapsed && 'Incidents'}
              </Link>
              {hasPendingIncidents && !isCollapsed && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                  !
                </span>
              )}
            </li>

            <li>
              <Link
                to="/notifications"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/notifications') ? 'text-blue-400' : 'hover:text-blue-300'
                }`}
              >
                🔔 {!isCollapsed && 'Notifications'}
              </Link>
            </li>

            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/articles"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/articles') && !isActive('/articles/liste')
                    ? 'text-blue-400'
                    : 'hover:text-blue-300'
                }`}
              >
                📝 {!isCollapsed && 'Créer un Article'}
              </Link>
            </li>

            <li>
              <Link
                to="/articles/liste"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/articles/liste') ? 'text-blue-400' : 'hover:text-blue-300'
                }`}
              >
                📋 {!isCollapsed && 'Liste des articles'}
              </Link>
            </li>

            <li className="border-t border-gray-700 pt-4">
              <Link
                to="/projects"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/projects') && !isActive('/projects/liste')
                    ? 'text-blue-400'
                    : 'hover:text-blue-300'
                }`}
              >
                📁 {!isCollapsed && 'Créer un Projet'}
              </Link>
            </li>

            <li>
              <Link
                to="/projects/liste"
                className={`flex items-center gap-2 text-base font-medium transition ${
                  isActive('/projects/liste') ? 'text-blue-400' : 'hover:text-blue-300'
                }`}
              >
                📄 {!isCollapsed && 'Liste des projets'}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {!isCollapsed && (
        <a
          href="https://www.facebook.com/mohamedsoighir.attoumani"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-4 block px-3 py-4 rounded-xl bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-inner border border-gray-700 text-center transition-all duration-300 hover:scale-105 hover:border-yellow-400 hover:shadow-lg"
        >
          <p className="text-sm text-gray-300 group-hover:text-yellow-300 transition">
            Conçu avec passion pour la sécurité citoyenne à Dembeni
          </p>
          <p className="text-base font-bold text-white tracking-wide mt-1 group-hover:text-white">
            MOHAMED SOIGHIR Attoumani
          </p>
          <p className="text-xs text-amber-400 italic mt-1 group-hover:text-amber-300">
            Bénévole engagé depuis 2018 🇾🇹
          </p>
        </a>
      )}
    </div>
  );
};

export default Sidebar;
