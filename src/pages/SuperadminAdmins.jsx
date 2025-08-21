import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL;

function SuperadminAdmins() {
  const token = localStorage.getItem('token');
  const [admins, setAdmins] = useState([]);

  const fetchAdmins = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdmins(res.data || []);
    } catch (e) {
      toast.error("Erreur lors du chargement des admins");
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Désactiver / Activer
  const toggleActive = async (a) => {
    const id = a._id;
    const nextActive = !a.isActive;
    try {
      await axios.patch(`${API_URL}/api/admins/${id}/disable`, { isActive: nextActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(nextActive ? 'Compte activé' : 'Compte désactivé');
      fetchAdmins();
    } catch (e) {
      toast.error("Erreur activation/désactivation");
    }
  };

  // Forcer déconnexion
  const forceLogout = async (a) => {
    const id = a._id;
    if (!window.confirm(`Forcer la déconnexion de ${a.email} ?`)) return;
    try {
      await axios.post(`${API_URL}/api/admins/${id}/force-logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Déconnexion forcée !");
    } catch (e) {
      toast.error("Erreur déconnexion forcée");
    }
  };

  // Impersonate
  const impersonate = async (a) => {
    const id = a._id;
    if (!window.confirm(`Se connecter comme ${a.email} ?`)) return;
    try {
      const res = await axios.post(`${API_URL}/api/admins/${id}/impersonate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newToken = res.data?.token;
      if (!newToken) throw new Error("Token manquant");
      const orig = localStorage.getItem('token');
      if (orig) localStorage.setItem('token_orig', orig);
      localStorage.setItem('token', newToken);
      toast.success(`Connecté comme ${a.email}`);
      window.location.href = '/dashboard';
    } catch (e) {
      toast.error("Erreur impersonation");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Gestion des administrateurs</h2>
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th>Email</th>
            <th>Commune</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a._id} className="border-t">
              <td>{a.email}</td>
              <td>{a.communeName || '-'}</td>
              <td>{a.isActive ? '✅ Actif' : '❌ Désactivé'}</td>
              <td>
                <button onClick={() => toggleActive(a)} className="px-2 py-1 bg-gray-600 text-white rounded mr-2">
                  {a.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => forceLogout(a)} className="px-2 py-1 bg-pink-600 text-white rounded mr-2">
                  Forcer déconnexion
                </button>
                <button onClick={() => impersonate(a)} className="px-2 py-1 bg-blue-600 text-white rounded">
                  Se connecter comme
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SuperadminAdmins;
