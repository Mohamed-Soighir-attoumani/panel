// src/pages/Login.jsx
import React, { useState } from 'react';
import { API_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!API_URL) return toast.error('REACT_APP_API_URL manquant côté front');

    try {
      setLoading(true);
      const r = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok || !data.token) throw new Error(data.message || 'Identifiants invalides');
      localStorage.setItem('token', data.token);
      nav('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <ToastContainer />
      <form onSubmit={submit} className="bg-white shadow rounded p-6 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Connexion</h1>

        <label className="block text-sm text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          autoComplete="username"
          className="w-full border p-2 rounded mb-3"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          required
        />

        <label className="block text-sm text-gray-700">Mot de passe</label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="w-full border p-2 rounded mb-4"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          required
        />

        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
