// src/pages/mon-abonnement.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader2, CheckCircle, XCircle, FileText, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_URL = process.env.REACT_APP_API_URL || "";

const norm = (v) => (v || "").toString().trim().toLowerCase();
const normalizeErr = (e, fallback = "Erreur") =>
  e?.response?.data?.message || e?.message || fallback;

const formatEUR = (n, currency = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(n || 0));

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return "";
  }
};

const Pill = ({ ok, children }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
      ok
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-gray-100 text-gray-600 border-gray-200"
    }`}
  >
    {ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {children}
  </span>
);

/**
 * Génère un PDF de facture localement (sans passer par le backend).
 * On part des champs renvoyés par /api/me/invoices :
 *   { id, number, amount, currency, status, date, url? }
 */
function generateInvoicePDF({ invoice, user, subscription }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 48;
  const lineY = 28;

  // En-tête
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SecuriDem", marginX, 60);
  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  doc.text("Plateforme de sécurité citoyenne", marginX, 78);

  // Infos facture
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Facture ${invoice.number || invoice.id}`, marginX, 120);

  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  const rightColX = 340;

  const todayStr = formatDate(new Date());
  doc.text(`Date d'émission : ${todayStr}`, rightColX, 60);
  doc.text(
    `Statut : ${invoice.status === "paid" ? "Payée" : invoice.status || "—"}`,
    rightColX,
    76
  );

  // Infos client
  const clientY = 160;
  doc.setFont("Helvetica", "bold");
  doc.text("Client", marginX, clientY);
  doc.setFont("Helvetica", "normal");
  doc.text(`${user?.name || "—"}`, marginX, clientY + lineY);
  doc.text(`${user?.email || "—"}`, marginX, clientY + lineY * 2);
  if (user?.communeName || user?.communeId) {
    doc.text(
      `Commune : ${user?.communeName || user?.communeId}`,
      marginX,
      clientY + lineY * 3
    );
  }

  // Détails abonnement
  const subY = clientY + lineY * 5;
  doc.setFont("Helvetica", "bold");
  doc.text("Abonnement", marginX, subY);
  doc.setFont("Helvetica", "normal");

  const statusLabel =
    subscription?.status === "active"
      ? "Activé"
      : subscription?.status === "expired"
      ? "Expiré"
      : "Aucun";

  doc.text(`Statut : ${statusLabel}`, marginX, subY + lineY);
  if (subscription?.endAt) {
    doc.text(`Échéance : ${formatDate(subscription.endAt)}`, marginX, subY + lineY * 2);
  }

  // Tableau lignes (autoTable)
  const itemsY = subY + lineY * 3;
  const rows = [
    [
      "Abonnement SecuriDem",
      invoice.status === "paid" ? "Payée" : "À régler",
      formatEUR(invoice.amount, invoice.currency),
    ],
  ];
  autoTable(doc, {
    startY: itemsY,
    head: [["Description", "Statut", "Montant TTC"]],
    body: rows,
    styles: { font: "Helvetica", fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [33, 33, 33], textColor: 255 },
    margin: { left: marginX, right: marginX },
  });

  // Totaux
  const afterTableY = doc.lastAutoTable.finalY + 16;
  doc.setFont("Helvetica", "bold");
  doc.text(
    `Total TTC : ${formatEUR(invoice.amount, invoice.currency)}`,
    rightColX,
    afterTableY
  );

  // Pied de page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setFont("Helvetica", "normal");
  doc.text(
    "Merci pour votre confiance.",
    marginX,
    pageHeight - 50
  );
  doc.text(
    "Ce document a été généré automatiquement par SecuriDem.",
    marginX,
    pageHeight - 34
  );

  const fileName = `Facture-${(invoice.number || invoice.id || "SecuriDem")
    .toString()
    .replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

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
  const end = sub.endAt ? formatDate(sub.endAt) : null;

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
                {end && <span className="text-xs text-gray-500">Jusqu’au {end}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Mes factures</h2>
            {/* Téléchargement de toutes les factures en un clic (optionnel) */}
            {invoices.length > 0 && (
              <button
                onClick={() => {
                  // Génère une par une (simple). Pour un zip, il faudrait JSZip.
                  invoices.forEach((f) =>
                    generateInvoicePDF({ invoice: f, user: me, subscription: sub })
                  );
                }}
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm inline-flex items-center gap-2"
                title="Télécharger chaque facture en PDF"
              >
                <Download size={16} />
                Tout télécharger
              </button>
            )}
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
                <div
                  key={i}
                  className="border rounded px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {f.number || f.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatEUR(f.amount, f.currency)} – {f.status} –{" "}
                      {f.date ? formatDate(f.date) : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 text-sm underline flex items-center gap-1"
                        title="Voir la facture d’origine"
                      >
                        <FileText size={14} /> Voir
                      </a>
                    )}
                    <button
                      onClick={() =>
                        generateInvoicePDF({ invoice: f, user: me, subscription: sub })
                      }
                      className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm inline-flex items-center gap-2"
                      title="Télécharger en PDF"
                    >
                      <Download size={14} />
                      Télécharger PDF
                    </button>
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
