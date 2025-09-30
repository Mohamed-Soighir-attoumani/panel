// src/components/VisibilityControls.jsx
import React, { useMemo } from "react";

/**
 * Props:
 * - me: { role, communeId }
 * - value: {
 *     visibility: 'local' | 'global' | 'custom',
 *     communeId: string,
 *     audienceCommunes: string[],
 *     priority: 'normal' | 'pinned' | 'urgent',
 *     startAt: string(datetime-local) | '',
 *     endAt: string(datetime-local) | ''
 *   }
 * - onChange(next)
 */
export default function VisibilityControls({ me, value, onChange }) {
  const isSuper = me?.role === "superadmin";
  const isAdmin = me?.role === "admin";

  // valeurs normalisées
  const v = useMemo(() => {
    const base = value || {};
    const visibility = isAdmin ? "local" : (base.visibility || "local");
    const communeId = visibility === "local"
      ? (base.communeId ?? (isAdmin ? (me?.communeId || "") : ""))
      : ""; // pas de communeId pour global/custom
    const audienceCommunes = Array.isArray(base.audienceCommunes)
      ? base.audienceCommunes
      : [];
    const priority = base.priority || "normal";
    const startAt = base.startAt || "";
    const endAt = base.endAt || "";
    return { visibility, communeId, audienceCommunes, priority, startAt, endAt };
  }, [value, isAdmin, me?.communeId]);

  // Setter pratique
  const set = (patch) => onChange({ ...v, ...patch });

  // Lors d'un changement de visibilité, garder un état cohérent
  const changeVisibility = (nextVis) => {
    if (!isSuper) return; // admin ne peut pas changer

    if (nextVis === "local") {
      set({
        visibility: "local",
        communeId: v.communeId || me?.communeId || "",
        audienceCommunes: [],
      });
    } else if (nextVis === "global") {
      set({
        visibility: "global",
        communeId: "",
        audienceCommunes: [],
      });
    } else if (nextVis === "custom") {
      set({
        visibility: "custom",
        communeId: "",
        audienceCommunes: v.audienceCommunes || [],
      });
    }
  };

  // Saisie CSV -> tableau propre
  const handleAudienceChange = (e) => {
    const arr = e.target.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    set({ audienceCommunes: arr });
  };

  return (
    <div className="space-y-3 p-4 rounded border bg-white">
      <h3 className="font-semibold text-gray-800">Visibilité</h3>

      {/* Portée */}
      <div>
        <label className="block text-sm text-gray-700 mb-1">Portée</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={v.visibility}
          onChange={(e) => changeVisibility(e.target.value)}
          disabled={!isSuper}
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

      {/* Commune (si local) */}
      {v.visibility === "local" && (
        <div>
          <label className="block text-sm text-gray-700 mb-1">communeId</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={v.communeId}
            onChange={(e) => set({ communeId: e.target.value })}
            placeholder="ex: dembeni"
            readOnly={isAdmin}
          />
          {isAdmin && (
            <p className="text-xs text-gray-500 mt-1">Verrouillé sur votre commune.</p>
          )}
        </div>
      )}

      {/* Audience custom */}
      {v.visibility === "custom" && (
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Communes ciblées (séparées par virgule)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={v.audienceCommunes.join(",")}
            onChange={handleAudienceChange}
            placeholder="ex: dembeni, mamoudzou, chirongui"
          />
          <p className="text-xs text-gray-500 mt-1">
            Laissez vide pour aucune (vous pouvez revenir en &laquo; locale &raquo; si nécessaire).
          </p>
        </div>
      )}

      {/* Priorité + Fenêtre */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Priorité</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={v.priority}
            onChange={(e) => set({ priority: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="pinned">Mis en avant</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Début d’affichage</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2"
            value={v.startAt}
            onChange={(e) => set({ startAt: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Fin d’affichage</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2"
            value={v.endAt}
            onChange={(e) => set({ endAt: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
