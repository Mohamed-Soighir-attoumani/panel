// src/components/DevicesTable.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_URL } from "../config";

const PAGE_SIZE = 10;

// Normalise la base API (évite /api/api si API_URL inclut déjà /api)
const BASE_API = API_URL.endsWith("/api") ? API_URL : `${API_URL}/api`;

function fmtExact(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";

  const str = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(dt);

  const offMin = -dt.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offMin) % 60).padStart(2, "0");

  return `${str} UTC${sign}${hh}:${mm}`;
}

function isoTitle(d) {
  try {
    return new Date(d).toISOString();
  } catch {
    return "";
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Construit les headers : token + x-commune-id si applicable
function buildHeaders() {
  const headers = {};
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  if (token) headers.Authorization = `Bearer ${token}`;

  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("me") || "null");
  } catch {}
  if (me?.role === "admin" && me?.communeId) {
    headers["x-commune-id"] = me.communeId;
  }
  if (me?.role === "superadmin") {
    const selectedCid =
      (typeof window !== "undefined" && localStorage.getItem("selectedCommuneId")) || "";
    if (selectedCid) headers["x-commune-id"] = selectedCid;
  }
  return headers;
}

const DevicesTable = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [debug, setDebug] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("lastSeenAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  // Recalcule dynamiquement (si LS change)
  const authHeaders = useMemo(buildHeaders, [
    localStorage.getItem("token"),
    localStorage.getItem("selectedCommuneId"),
    localStorage.getItem("me"),
  ]);

  const unmountedRef = useRef(false);

  const handleAuthError = (e) => {
    const s = e?.response?.status;
    if (s === 401 || s === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      localStorage.removeItem("admin");
      window.location.href = "/login";
      return true;
    }
    return false;
  };

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setErr("");
    setDebug("");
    try {
      const res = await axios.get(`${BASE_API}/devices`, {
        headers: { ...authHeaders, "Cache-Control": "no-cache" },
        params: { page, pageSize: PAGE_SIZE },
        timeout: 20000,
      });

      const list =
        Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
          ? res.data
          : [];

      if (!unmountedRef.current) setItems(list);
    } catch (e) {
      if (handleAuthError(e)) return;
      const status = e?.response?.status;
      const data = e?.response?.data;
      const msg = data?.message || e?.message || "Erreur inconnue";
      const full = `[GET ${BASE_API}/devices] status=${status || "?"} message="${msg}"`;
      console.error(full, data);
      if (!unmountedRef.current) {
        setDebug(full);
        setErr("Impossible de charger les appareils.");
      }
    } finally {
      if (!unmountedRef.current) setLoading(false);
    }
  }, [authHeaders, page]);

  useEffect(() => {
    unmountedRef.current = false;
    fetchDevices();
    const id = setInterval(fetchDevices, 30000);
    return () => {
      unmountedRef.current = true;
      clearInterval(id);
    };
  }, [fetchDevices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = q
      ? items.filter((d) => {
          const hay = [
            d.installationId,
            d.platform,
            d.brand,
            d.model,
            d.osVersion,
            d.appVersion,
            d.communeId,
            d.communeName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : items;

    const sorted = [...base].sort((a, b) => {
      const aVal = a?.[sortKey];
      const bVal = b?.[sortKey];

      if (["firstSeenAt", "lastSeenAt"].includes(sortKey)) {
        const aT = aVal ? new Date(aVal).getTime() : 0;
        const bT = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === "asc" ? aT - bT : bT - aT;
      }

      const A = (aVal ?? "").toString().toLowerCase();
      const B = (bVal ?? "").toString().toLowerCase();
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const cols = [
      "installationId",
      "platform",
      "brand",
      "model",
      "osVersion",
      "appVersion",
      "firstSeenAt",
      "lastSeenAt",
      "communeId",
      "communeName",
    ];
    const header = cols.join(",");
    const rows = filtered.map((d) =>
      [
        JSON.stringify(d.installationId || ""),
        JSON.stringify(d.platform || ""),
        JSON.stringify(d.brand || ""),
        JSON.stringify(d.model || ""),
        JSON.stringify(d.osVersion || ""),
        JSON.stringify(d.appVersion || ""),
        JSON.stringify(fmtExact(d.firstSeenAt)),
        JSON.stringify(fmtExact(d.lastSeenAt)),
        JSON.stringify(d.communeId || ""),
        JSON.stringify(d.communeName || ""),
      ].join(",")
    );
    downloadTextFile("devices.csv", [header, ...rows].join("\n"));
  };

  return (
    <div className="bg-white p-4 shadow rounded">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg sm:text-xl font-semibold">📱 Appareils enregistrés</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher (ID, marque, modèle, version...)"
            className="border rounded px-3 py-2 w-full sm:w-80"
          />
          <button
            onClick={fetchDevices}
            className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
            disabled={loading}
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <button
            onClick={exportCSV}
            className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-800 whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : err ? (
        <div>
          <p className="text-red-600">{err}</p>
          {debug && (
            <pre className="mt-2 p-2 bg-red-50 text-xs overflow-auto rounded border border-red-200">
              {debug}
            </pre>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Aucun appareil.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <Th label="Installation ID" active={sortKey === "installationId"} dir={sortDir} onClick={() => changeSort("installationId")} className="py-2 pr-4" />
                  <Th label="Plateforme" active={sortKey === "platform"} dir={sortDir} onClick={() => changeSort("platform")} className="py-2 pr-4" />
                  <Th label="Marque" active={sortKey === "brand"} dir={sortDir} onClick={() => changeSort("brand")} className="py-2 pr-4" />
                  <Th label="Modèle" active={sortKey === "model"} dir={sortDir} onClick={() => changeSort("model")} className="py-2 pr-4" />
                  <Th label="OS" active={sortKey === "osVersion"} dir={sortDir} onClick={() => changeSort("osVersion")} className="py-2 pr-4" />
                  <Th label="Version app" active={sortKey === "appVersion"} dir={sortDir} onClick={() => changeSort("appVersion")} className="py-2 pr-4" />
                  <Th label="1ère vue (exacte)" active={sortKey === "firstSeenAt"} dir={sortDir} onClick={() => changeSort("firstSeenAt")} className="py-2 pr-4" />
                  <Th label="Dernière vue (exacte)" active={sortKey === "lastSeenAt"} dir={sortDir} onClick={() => changeSort("lastSeenAt")} className="py-2" />
                </tr>
              </thead>
              <tbody>
                {slice.map((d) => (
                  <tr key={d.installationId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono break-all">{d.installationId}</td>
                    <td className="py-2 pr-4">{d.platform || "—"}</td>
                    <td className="py-2 pr-4">{d.brand || "—"}</td>
                    <td className="py-2 pr-4">{d.model || "—"}</td>
                    <td className="py-2 pr-4">{d.osVersion || "—"}</td>
                    <td className="py-2 pr-4">{d.appVersion || "—"}</td>
                    <td className="py-2 pr-4" title={isoTitle(d.firstSeenAt)}>{fmtExact(d.firstSeenAt)}</td>
                    <td className="py-2" title={isoTitle(d.lastSeenAt)}>{fmtExact(d.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">
              {filtered.length} appareil(s) • Page {currentPage}/{totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(1)} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Préc.</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Suiv.</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">»</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Th = ({ label, active, dir, onClick, className = "" }) => (
  <th className={`${className} cursor-pointer select-none`} onClick={onClick} title="Trier">
    <span className="inline-flex items-center gap-1">
      {label}
      <span className={`text-xs ${active ? "opacity-100" : "opacity-20"}`}>
        {dir === "asc" ? "▲" : "▼"}
      </span>
    </span>
  </th>
);

export default DevicesTable;
