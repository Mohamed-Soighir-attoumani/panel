// src/pages/MonAbonnement.jsx
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const getToken = () => (localStorage.getItem('token') || '').trim();

export default function MonAbonnement() {
  const token = useMemo(getToken, []);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    (async () => {
      if (!API_URL || !token) {
        toast.error('Configuration manquante ou non connecté');
        setLoading(false);
        return;
      }
      try {
        const me = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: s => s >= 200 && s < 500,
        });
        if (me.status === 401) {
          toast.error(me.data?.message || 'Session expirée');
          localStorage.removeItem('token');
          setTimeout(() => (window.location.href = '/login'), 600);
          return;
        }

        const r1 = await axios.get(`${API_URL}/api/my-subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSub(r1.data || null);

        const r2 = await axios.get(`${API_URL}/api/my-invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = Array.isArray(r2.data?.invoices) ? r2.data.invoices : [];
        setInvoices(list);
      } catch (e) {
        toast.error(e?.response?.data?.message || e.message || 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-600">Chargement…</div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-700">Aucune information.</div>
      </div>
    );
  }

  const fmt = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Mon abonnement</h1>
          <p className="text-gray-600">
            Statut :{' '}
            <span className="font-medium">
              {sub.status === 'active' ? 'Actif' : sub.status === 'expired' ? 'Expiré' : 'Aucun'}
            </span>
          </p>
          <p className="text-gray-600">Début : {fmt(sub.startAt)}</p>
          <p className="text-gray-600">Fin : {fmt(sub.endAt)}</p>
          <p className="text-gray-600">
            Montant : {Number(sub.price || 0).toFixed(2)} {sub.currency || 'EUR'}
            {sub.method ? ` — Règlement: ${sub.method}` : ''}
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Mes factures</h2>

          {invoices.length === 0 ? (
            <p className="text-gray-500">Aucune facture disponible.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((f, i) => {
                const dl = `${API_URL}/api/my-invoices/${encodeURIComponent(f.number)}/pdf?token=${encodeURIComponent(token)}`;
                return (
                  <div key={i} className="border rounded px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{f.number}</div>
                      <div className="text-xs text-gray-600">
                        Montant: {Number(f.amountTTC ?? f.amount ?? 0).toFixed(2)}{' '}
                        {f.currency || 'EUR'} — Statut: {f.status === 'paid' ? 'Payée' : 'À payer'}{' '}
                        {f.invoiceDateFormatted ? `— ${f.invoiceDateFormatted}` : ''}
                      </div>
                    </div>
                    <a
                      href={dl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                      title="Télécharger la facture (PDF)"
                    >
                      Télécharger
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
