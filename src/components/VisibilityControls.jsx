// src/components/VisibilityControls.jsx
import React from "react";

/**
 * Props:
 * - me: { role, communeId }
 * - value: { visibility, communeId, audienceCommunes (array), priority, startAt, endAt }
 * - onChange(next)
 */
export default function VisibilityControls({ me, value, onChange }) {
  const isSuper = me?.role === "superadmin";
  const isAdmin = me?.role === "admin";

  const v = value || {};
  const vis = v.visibility || (isAdmin ? "local" : "local");
  const cid = v.communeId ?? (isAdmin ? (me?.communeId || "") : "");
  const audience = Array.isArray(v.audienceCommunes) ? v.audienceCommunes : [];
  const priority = v.priority || "normal";
  const startAt = v.startAt || "";
  const endAt = v.endAt || "";

  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="space-y-3 p-4 rounded border bg-white">
      <h3 className="font-semibold text-gray-800">Visibilité</h3>

      {/* Sélecteur de visibilité */}
      <div>
        <label className="block text-sm text-gray-700 mb-1">Portée</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={vis}
          onChange={(e) => set({ visibility: e.target.value })}
          disabled={!isSuper /* admin bloqué en local */}
        >
          <option value="local">Locale (commune)</option>
          <option value="global" disabled={!isSuper}>Globale (toutes communes)</option>
          <option value="custom" disabled={!isSuper}>Sélection de communes</option>
        </select>
        {isAdmin && (
          <p className="text-xs text-gray-500 mt-1">
            En tant qu’admin de commune, la visibilité est limitée à votre commune.
          </p>
        )}
      </div>

      {/* CommuneId */}
      {(vis === "local") && (
        <div>
          <label className="block text-sm text-gray-700 mb-1">communeId</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={cid}
            onChange={(e) => set({ communeId: e.target.value })}
            placeholder="ex: dembeni"
            readOnly={isAdmin}
          />
          {isAdmin && <p className="text-xs text-gray-500 mt-1">Verrouillé sur votre commune.</p>}
        </div>
      )}

      {/* Audience communes */}
      {(vis === "custom") && (
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Communes ciblées (séparées par virgule)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={audience.join(",")}
            onChange={(e) =>
              set({
                audienceCommunes: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="ex: dembeni, mamoudzou, chirongui"
          />
        </div>
      )}

      {/* Priorité */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Priorité</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={priority}
            onChange={(e) => set({ priority: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="pinned">Mis en avant</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Fenêtre d’affichage */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Début d’affichage</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2"
            value={startAt}
            onChange={(e) => set({ startAt: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Fin d’affichage</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2"
            value={endAt}
            onChange={(e) => set({ endAt: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
