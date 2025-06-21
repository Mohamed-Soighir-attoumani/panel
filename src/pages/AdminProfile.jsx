import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Users, Settings, LogOut } from 'lucide-react';

const AdminProfile = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
        <div className="flex flex-col items-center space-y-4 mb-6">
          <div className="h-20 w-20 rounded-full bg-blue-500 text-white flex items-center justify-center text-3xl font-bold">
            A
          </div>
          <h2 className="text-2xl font-bold text-gray-700">Administrateur</h2>
          <p className="text-sm text-gray-500">admin@securidem.fr</p>
        </div>

        <div className="space-y-4">
          <Link
            to="/changer-mot-de-passe"
            className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            <Lock className="w-5 h-5 text-gray-600" />
            <span>Modifier le mot de passe</span>
          </Link>

          <Link
            to="/utilisateurs"
            className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            <Users className="w-5 h-5 text-gray-600" />
            <span>Gérer les utilisateurs</span>
          </Link>

          <Link
            to="/settings"
            className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            <Settings className="w-5 h-5 text-gray-600" />
            <span>Paramètres</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
