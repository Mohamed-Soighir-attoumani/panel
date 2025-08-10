// src/components/DevicesTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

const PAGE_SIZE = 10;

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
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

const DevicesTable = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("registeredAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const fetchDevices = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${API_URL}/api/devices`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setDevices(list);
    } catch (e) {
      console.error("Erreur fetch devices:", e);
      setErr("Impossible de charger les appareils.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const id = setInterval(fetchDevices, 30000); // auto-refresh
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? devices.filter((d) => {
          const hay =
            `${d.deviceId || ""} ${d.platform || ""} ${d.appVersion || ""}`.toLowerCase();
          return hay.includes(q);
        })
      : devices;

    const sorted = [...base].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortKey === "registeredAt") {
        const aT = aVal ? new Date(aVal).getTime() : 0;
        const bT = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === "asc" ? aT - bT : bT - aT;
      }
      const A = (aVal || "").toString().toLowerCase();
      const B = (bVal || "").toString().toLowerCase();
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [devices, query, sortKey, sortDir]);

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
    const cols = ["deviceId", "platform", "appVersion", "registeredAt"];
    const header = cols.join(",");
    const rows = filtered.map((d) =>
      [
        JSON.stringify(d.deviceId || ""), // JSON.stringify pour échapper les virgules/quotes
        JSON.stringify(d.platform || ""),
        JSON.stringify(d.appVersion || ""),
        JSON.stringify(formatDate(d.registeredAt)),
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
            placeholder="Rechercher (ID, plateforme, version)"
            className="border rounded px-3 py-2 w-full sm:w-80"
          />
          <button
            onClick={fetchDevices}
            className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
          >
            Rafraîchir
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
        <p className="text-red-600">{err}</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Aucun appareil.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <Th
                    label="Device ID"
                    active={sortKey === "deviceId"}
                    dir={sortDir}
                    onClick={() => changeSort("deviceId")}
                    className="py-2 pr-4"
                  />
                  <Th
                    label="Plateforme"
                    active={sortKey === "platform"}
                    dir={sortDir}
                    onClick={() => changeSort("platform")}
                    className="py-2 pr-4"
                  />
                  <Th
                    label="Version app"
                    active={sortKey === "appVersion"}
                    dir={sortDir}
                    onClick={() => changeSort("appVersion")}
                    className="py-2 pr-4"
                  />
                  <Th
                    label="Enregistré le"
                    active={sortKey === "registeredAt"}
                    dir={sortDir}
                    onClick={() => changeSort("registeredAt")}
                    className="py-2"
                  />
                </tr>
              </thead>
              <tbody>
                {slice.map((d) => (
                  <tr key={d._id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono break-all">{d.deviceId}</td>
                    <td className="py-2 pr-4">{d.platform || "—"}</td>
                    <td className="py-2 pr-4">{d.appVersion || "—"}</td>
                    <td className="py-2">{formatDate(d.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">
              {filtered.length} appareil(s) • Page {currentPage}/{totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Préc.
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Suiv.
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                »
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Th = ({ label, active, dir, onClick, className = "" }) => (
  <th
    className={`${className} cursor-pointer select-none`}
    onClick={onClick}
    title="Trier"
  >
    <span className="inline-flex items-center gap-1">
      {label}
      <span className={`text-xs ${active ? "opacity-100" : "opacity-20"}`}>
        {dir === "asc" ? "▲" : "▼"}
      </span>
    </span>
  </th>
);

export default DevicesTable;
