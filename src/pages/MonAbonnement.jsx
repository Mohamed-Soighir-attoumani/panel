// src/pages/MonAbonnement.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const norm = (v) => (v || "").toString().trim().toLowerCase();

export default function MonAbonnement() {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const [loading, setLoading] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState({ status: "none", endAt: null });
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (!API_URL || !token) {
          toast.error("Non connecté");
          window.location.href = "/login";
          return;
        }

        // 1) /api/me (pour l’identité)
        const rMe = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        const user = rMe.data?.user || null;
        setMe(user);

        // 2) Abonnement : endpoint dédié (admin/superadmin)
        try {
          const rSub = await axios.get(`${API_URL}/api/my-subscription`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          });
          setSub({
            status: rSub.data?.status || "none",
            endAt: rSub.data?.endAt || null,
          });
        } catch {
          // fallback sur /api/me si le endpoint n’est pas (encore) déployé
          setSub({
            status: user?.subscriptionStatus || "none",
            endAt: user?.subscriptionEndAt || null,
          });
        }

        // 3) Factures : endpoint dédié (admin/superadmin)
        try {
          const rInv = await axios.get(`${API_URL}/api/my-invoices`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          });
          setInvoices(Array.isArray(rInv.data?.invoices) ? rInv.data.invoices : []);
        } catch {
          setInvoices([]);
        }
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || "Erreur de chargement";
        toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingInv(false);
      }
    })();
  }, [token]);

  const isSuperadmin = norm(me?.role) === "superadmin";
  const statusLabel =
    sub.status === "active" ? "Actif" :
    sub.status === "expired" ? "Expiré" :
    "Aucun";
  const endLabel = sub.endAt ? new Date(sub.endAt).toLocaleString() : "—";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Mon abonnement</h1>

        {/* Carte abonnement */}
        <div className="bg-white shadow rounded-lg p-4">
          {loading ? (
            <div className="text-gray-500">Chargement…</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Statut</div>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border
                    ${sub.status === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : sub.status === "expired"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                    {statusLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Échéance</div>
                  <div className="text-sm text-gray-800">{endLabel}</div>
                </div>
              </div>

              {!isSuperadmin && (
                <p className="mt-3 text-xs text-gray-500">
                  Pour toute modification (activation, renouvellement, annulation), contactez votre superadmin.
                </p>
              )}
            </>
          )}
        </div>

        {/* Factures */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Mes factures</h2>
          {loadingInv ? (
            <div className="text-gray-500">Chargement…</div>
          ) : invoices.length === 0 ? (
            <div className="text-gray-500">Aucune facture.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Numéro", "Montant", "Statut", "Date", "Lien"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b text-sm">{f.number || f.id || "—"}</td>
                      <td className="px-4 py-2 border-b text-sm">
                        {typeof f.amount === "number" ? f.amount.toFixed(2) : f.amount} {f.currency || ""}
                      </td>
                      <td className="px-4 py-2 border-b text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs border
                          ${f.status === "paid"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : f.status === "unpaid"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}>
                          {f.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-sm">
                        {f.date ? new Date(f.date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2 border-b text-sm">
                        {f.url ? (
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                            Voir
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
