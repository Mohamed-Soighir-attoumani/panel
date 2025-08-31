// src/pages/MonAbonnement.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const norm = (v) => (v || "").toString().trim().toLowerCase();
const fmtMoney = (n) => {
  if (typeof n !== "number") return n;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MonAbonnement() {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const mounted = useRef(true);

  const [loading, setLoading] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [me, setMe] = useState(null);
  const [sub, setSub] = useState({ status: "none", endAt: null });
  const [invoices, setInvoices] = useState([]);

  const safeSet = (setter) => (...args) => {
    if (!mounted.current) return;
    setter(...args);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchMe = useCallback(async () => {
    const r = await axios.get(`${API_URL}/api/me`, {
      headers,
      timeout: 15000,
      validateStatus: (s) => s >= 200 && s < 500,
    });
    if (r.status === 401 || r.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      window.location.href = "/login";
      return null;
    }
    if (r.status >= 400) throw new Error(r.data?.message || "Erreur /api/me");
    return r.data?.user || null;
  }, [headers]);

  const fetchSubscription = useCallback(
    async (user) => {
      try {
        const r = await axios.get(`${API_URL}/api/my-subscription`, {
          headers,
          timeout: 15000,
          validateStatus: (s) => s >= 200 && s < 500,
        });
        if (r.status >= 400) throw new Error(r.data?.message || "my-subscription indisponible");
        return { status: r.data?.status || "none", endAt: r.data?.endAt || null };
      } catch {
        return {
          status: user?.subscriptionStatus || "none",
          endAt: user?.subscriptionEndAt || null,
        };
      }
    },
    [headers]
  );

  const fetchInvoices = useCallback(async () => {
    const r = await axios.get(`${API_URL}/api/my-invoices`, {
      headers,
      timeout: 15000,
      validateStatus: (s) => s >= 200 && s < 500,
    });
    if (r.status >= 400) return [];
    const arr = Array.isArray(r.data?.invoices) ? r.data.invoices : [];
    return arr;
  }, [headers]);

  const loadAll = useCallback(async () => {
    if (!API_URL || !token) {
      toast.error("Non connecté");
      window.location.href = "/login";
      return;
    }
    try {
      safeSet(setLoading)(true);
      safeSet(setLoadingInv)(true);

      const user = await fetchMe();
      safeSet(setMe)(user);

      const subData = await fetchSubscription(user);
      safeSet(setSub)(subData);

      const inv = await fetchInvoices();
      safeSet(setInvoices)(inv);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Erreur de chargement";
      toast.error(msg);
    } finally {
      safeSet(setLoading)(false);
      safeSet(setLoadingInv)(false);
    }
  }, [token, fetchMe, fetchSubscription, fetchInvoices]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh à chaque retour sur l’onglet
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") handleRefreshLight();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Petit polling (20s * 9 ~ 3 minutes) pour capter un changement récent
  useEffect(() => {
    let count = 0;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await handleRefreshLight();
      } catch {}
      count += 1;
      if (count >= 9) clearInterval(timer);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshLight = async () => {
    try {
      const user = await fetchMe();
      safeSet(setMe)(user);

      const subData = await fetchSubscription(user);
      safeSet(setSub)(subData);

      const inv = await fetchInvoices();
      safeSet(setInvoices)(inv);
    } catch {
      /* silencieux */
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await handleRefreshLight();
      toast.success("Mise à jour effectuée ✅");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Échec de l’actualisation");
    } finally {
      setRefreshing(false);
    }
  };

  // --------- Dérivés affichage ---------
  const isSuperadmin = norm(me?.role) === "superadmin";

  const now = new Date();
  const endDate = sub?.endAt ? new Date(sub.endAt) : null;
  const isExpired = endDate ? endDate.getTime() < now.getTime() : false;

  // Si backend a dit "active" mais la date est dépassée → on force "expired"
  const derivedStatus = sub.status === "active" && isExpired ? "expired" : (sub.status || "none");

  const statusLabel =
    derivedStatus === "active" ? "Actif" : derivedStatus === "expired" ? "Expiré" : "Aucun";

  const endLabel = endDate ? endDate.toLocaleString() : "—";

  const statusClasses =
    derivedStatus === "active"
      ? "bg-green-50 text-green-700 border-green-200"
      : derivedStatus === "expired"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-gray-100 text-gray-600 border-gray-200";

  const totalPaid = invoices
    .filter((i) => norm(i.status) === "paid")
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  // --------- PDF Facture (lazy import) ---------
  const downloadInvoicePdf = async (inv) => {
    try {
      const jsPDFMod = await import("jspdf");
      const autoTableMod = await import("jspdf-autotable");
      const jsPDF = jsPDFMod.jsPDF || jsPDFMod.default;

      const doc = new jsPDF();
      const title = `Facture ${inv.number || inv.id || ""}`.trim();
      doc.setFontSize(16);
      doc.text(title || "Facture", 14, 18);

      doc.setFontSize(11);
      const lines = [
        `Client : ${me?.name || me?.email || ""}`,
        `Date : ${inv.date ? new Date(inv.date).toLocaleString() : "—"}`,
        `Montant : ${fmtMoney(Number(inv.amount) || 0)} ${inv.currency || ""}`,
        `Statut : ${inv.status || "—"}`,
        inv.note ? `Note : ${inv.note}` : null,
      ].filter(Boolean);

      let y = 28;
      lines.forEach((l) => {
        doc.text(l, 14, y);
        y += 6;
      });

      autoTableMod.default(doc, {
        startY: y + 4,
        head: [["Champ", "Valeur"]],
        body: [
          ["Numéro", inv.number || inv.id || "—"],
          ["Montant", `${fmtMoney(Number(inv.amount) || 0)} ${inv.currency || ""}`],
          ["Statut", inv.status || "—"],
          ["Date", inv.date ? new Date(inv.date).toLocaleString() : "—"],
        ],
        styles: { fontSize: 10 },
      });

      const fname = `${(inv.number || inv.id || "facture").toString().replace(/\s+/g, "_")}.pdf`;
      doc.save(fname);
      toast.success("PDF téléchargé ✅");
    } catch (e) {
      toast.error("Génération PDF indisponible. Installe `jspdf` et `jspdf-autotable` dans le front.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header de page */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Mon abonnement</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            {refreshing ? "Actualisation…" : "Rafraîchir"}
          </button>
        </div>

        {/* Card Statut */}
        <div className="bg-white shadow rounded-lg p-4">
          {loading ? (
            <div className="text-gray-500">Chargement…</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Statut</div>
                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border ${statusClasses}`}>
                    {derivedStatus === "active" ? "🟢" : derivedStatus === "expired" ? "🔴" : "⚪️"} {statusLabel}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Échéance</div>
                  <div className="text-sm text-gray-800">{endLabel}</div>
                  {endDate && derivedStatus === "active" && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)))} jour(s) restant(s)
                    </div>
                  )}
                </div>
              </div>

              {isSuperadmin ? (
                <p className="mt-3 text-xs text-gray-500">
                  (Vous êtes connecté en superadministrateur. Cette page est destinée aux administrateurs.)
                </p>
              ) : (
                <p className="mt-3 text-xs text-gray-500">
                  Pour toute modification (activation, renouvellement, annulation), contactez votre superadmin.
                </p>
              )}
            </>
          )}
        </div>

        {/* Card Factures */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Mes factures</h2>
            {!loadingInv && invoices.length > 0 && (
              <div className="text-sm text-gray-600">
                Total payé : <strong>{fmtMoney(totalPaid)} EUR</strong>
              </div>
            )}
          </div>

          {loadingInv ? (
            <div className="text-gray-500">Chargement…</div>
          ) : invoices.length === 0 ? (
            <div className="text-gray-500">
              Aucune facture disponible pour le moment.
              {derivedStatus === "active" ? (
                <span className="ml-1">
                  (Si votre abonnement vient d’être activé, revenez dans un instant ou cliquez sur <em>Rafraîchir</em>.)
                </span>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Numéro", "Montant", "Statut", "Date", "Lien", "PDF"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((f, i) => {
                    const isPaid = norm(f.status) === "paid";
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border-b text-sm">{f.number || f.id || "—"}</td>
                        <td className="px-4 py-2 border-b text-sm">
                          {fmtMoney(Number(f.amount) || 0)} {f.currency || ""}
                        </td>
                        <td className="px-4 py-2 border-b text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border ${
                              isPaid ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
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
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 border-b text-sm">
                          <button
                            onClick={() => downloadInvoicePdf(f)}
                            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                            title="Télécharger en PDF"
                          >
                            Télécharger
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
