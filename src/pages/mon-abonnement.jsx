// src/pages/mon-abonnement.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader2, CheckCircle, XCircle, FileText } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "";

const norm = (v) => (v || "").toString().trim().toLowerCase();
const normalizeErr = (e, fallback = "Erreur") =>
  e?.response?.data?.message || e?.message || fallback;

const Pill = ({ ok, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${ok ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
    {ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {children}
  </span>
);

export default function MonAbonnement() {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [loadingSub, setLoadingSub] = useState(false);
  const [sub, setSub] = useState({ status: "none", endAt: null });

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (!API_URL) {
          toast.error("REACT_APP_API_URL manquant");
          setLoadingMe(false);
          return;
        }
        if (!token) {
          toast.error("Non connecté");
          window.location.href = "/login";
          return;
        }
        const r = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        setMe(r.data?.user || null);
      } catch (e) {
        toast.error(normalizeErr(e, "Erreur /api/me"));
        localStorage.removeItem("token");
        setTimeout(() => (window.location.href = "/login"), 600);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        setLoadingSub(true);
        const r = await axios.get(`${API_URL}/api/me/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        setSub({
          status: r.data?.status || "none",
          endAt: r.data?.endAt || null,
        });
      } catch (e) {
        toast.error(normalizeErr(e, "Erreur chargement abonnement"));
      } finally {
        setLoadingSub(false);
      }
    })();

    (async () => {
      try {
        setLoadingInvoices(true);
        const r = await axios.get(`${API_URL}/api/me/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        setInvoices(Array.isArray(r.data?.invoices) ? r.data.invoices : []);
      } catch (e) {
        toast.error(normalizeErr(e, "Erreur chargement factures"));
      } finally {
        setLoadingInvoices(false);
      }
    })();
  }, [me, token]);

  if (loadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-600 flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Chargement…
        </div>
      </div>
    );
  }

  if (!me || norm(me.role) !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer />
        <div className="bg-white shadow rounded px-6 py-4 text-gray-700">
          Page réservée aux <strong>administrateurs</strong>.
        </div>
      </div>
    );
  }

  const active = sub.status === "active";
  const expired = sub.status === "expired";
  const end = sub.endAt ? new Date(sub.endAt).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-white shadow rounded-lg p-4">
          <h1 className="text-xl font-semibold text-gray-800">Mon abonnement</h1>
          <div className="mt-3 text-sm text-gray-700">
            {loadingSub ? (
              <div className="text-gray-500 flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} /> Chargement…
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Pill ok={active}>
                  {active ? "Activé" : expired ? "Expiré" : "Aucun"}
                </Pill>
                {end && (
                  <span className="text-xs text-gray-500">Jusqu’au {end}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Mes factures</h2>
          </div>

          {loadingInvoices ? (
            <div className="mt-3 text-gray-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Chargement…
            </div>
          ) : invoices.length === 0 ? (
            <div className="mt-3 text-gray-500">Aucune facture.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {invoices.map((f, i) => (
                <div key={i} className="border rounded px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{f.number || f.id}</div>
                    <div className="text-xs text-gray-500">
                      {f.amount} {f.currency} – {f.status} – {f.date ? new Date(f.date).toLocaleDateString() : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline flex items-center gap-1">
                        <FileText size={14} /> Voir
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
