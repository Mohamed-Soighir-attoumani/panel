import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Users, Settings, LogOut, ShieldCheck, User as UserIcon, ArrowLeftCircle } from "lucide-react";

/* ===================== Helpers ===================== */

// Base API origin à partir de l’URL courante (utile si l’API renvoie un chemin relatif)
const API_ORIGIN = (() => {
  try {
    // si tu as une variable d'env, remplace ici par son origin
    // ex: new URL(process.env.REACT_APP_API_URL).origin
    return window.location.origin;
  } catch {
    return '';
  }
})();

function absUrl(u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;        // déjà absolue
  if (u.startsWith('//')) return `${window.location.protocol}${u}`;
  if (u.startsWith('/')) return `${API_ORIGIN}${u}`;
  return `${API_ORIGIN}/${u}`;
}

function withBust(url, ver) {
  if (!url) return url;
  const t = ver ? String(ver) : String(Date.now());
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${encodeURIComponent(t)}`;
}

function readCachedMe() {
  try {
    const raw = localStorage.getItem("me");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function tolerantGetMe() {
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const r1 = await fetch("/api/me", { headers, credentials: "include" });
    if (r1.ok) return r1.json();
    if ([401, 403].includes(r1.status)) return { __status: r1.status };
  } catch {}
  try {
    const r2 = await fetch("/me", { headers, credentials: "include" });
    if (r2.ok) return r2.json();
    return { __status: r2.status };
  } catch {
    return { __status: 0 };
  }
}

const Avatar = ({ name, photoUrl, version }) => {
  const letter = (name || "").trim().charAt(0).toUpperCase() || "A";
  const src = photoUrl ? withBust(absUrl(photoUrl), version) : "";

  if (src) {
    return (
      <img
        src={src}
        alt="avatar"
        className="h-20 w-20 rounded-full object-cover border"
        onError={(e) => {
          // Si l'image échoue, on bascule vers les initiales
          e.currentTarget.style.display = "none";
          const fallback = e.currentTarget.nextElementSibling;
          if (fallback) fallback.style.display = "flex";
        }}
      />
    );
  }

  return (
    <div className="h-20 w-20 rounded-full bg-blue-500 text-white flex items-center justify-center text-3xl font-bold">
      {letter}
    </div>
  );
};

/* ===================== Component ===================== */

export default function AdminProfile() {
  const navigate = useNavigate();

  const [me, setMe] = useState(() => {
    const cached = readCachedMe();
    // s'assure que photoVersion est présent
    return cached ? { photoVersion: cached.photoVersion || "", ...cached } : null;
  });
  const [loading, setLoading] = useState(!me);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await tolerantGetMe();
      if (cancelled) return;

      if (data?.user) {
        const user = data.user;
        const normalized = {
          id: user.id,
          email: user.email,
          role: user.role,
          communeId: (user.communeId || "").toString().trim().toLowerCase(),
          communeName: user.communeName || "",
          name: user.name || "",
          photo: user.photo || "",
          // version pour forcer le rafraîchissement de l'avatar
          photoVersion: user.photoVersion || user.logoVersion || user.updatedAt || user.photoUpdatedAt || "",
          impersonated: !!user.impersonated,
          origUserId: user.origUserId || null,
        };
        setMe(normalized);
        try {
          localStorage.setItem("me", JSON.stringify(normalized));
        } catch {}
        setError("");
      } else if (data?.__status === 401) {
        handleLogout(true);
      } else if (data?.__status === 403) {
        setError("Accès refusé.");
      } else if (data?.__status === 0) {
        setError("Erreur réseau lors du chargement du profil.");
      } else {
        setError("Impossible de charger le profil.");
      }
      setLoading(false);
    })();

    // Si une autre page signale que la photo vient d'être changée, on se resynchronise.
    const onPhotoUpdated = async () => {
      const data2 = await tolerantGetMe();
      if (data2?.user) {
        const u = data2.user;
        const normalized2 = {
          id: u.id,
          email: u.email,
          role: u.role,
          communeId: (u.communeId || "").toString().trim().toLowerCase(),
          communeName: u.communeName || "",
          name: u.name || "",
          photo: u.photo || "",
          photoVersion: u.photoVersion || u.logoVersion || u.updatedAt || u.photoUpdatedAt || Date.now(),
          impersonated: !!u.impersonated,
          origUserId: u.origUserId || null,
        };
        setMe(normalized2);
        try {
          localStorage.setItem("me", JSON.stringify(normalized2));
        } catch {}
      }
    };
    window.addEventListener("profile-photo-updated", onPhotoUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("profile-photo-updated", onPhotoUpdated);
    };
  }, []);

  const handleLogout = (silent = false) => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("token_orig");
      localStorage.removeItem("me");
    } catch {}
    navigate("/login");
  };

  const canManageUsers = useMemo(() => me?.role === "superadmin", [me?.role]);
  const displayRole = useMemo(() => {
    if (!me?.role) return "Utilisateur";
    const r = (me.role || "").toLowerCase();
    if (r === "superadmin") return "Superadministrateur";
    if (r === "admin") return "Administrateur";
    return me.role;
  }, [me?.role]);

  const revertImpersonation = () => {
    try {
      const orig = localStorage.getItem("token_orig");
      if (orig) {
        localStorage.setItem("token", orig);
        localStorage.removeItem("token_orig");
        localStorage.removeItem("me");
      }
    } catch {}
    navigate("/");
    setTimeout(() => window.location.reload(), 50);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
        {me?.impersonated && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 text-amber-800 p-3 flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Mode superadmin : vous utilisez un autre compte.</div>
              <button
                onClick={revertImpersonation}
                className="mt-1 inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-amber-300 hover:bg-amber-100"
              >
                <ArrowLeftCircle className="w-4 h-4" />
                Revenir à mon compte
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4 mb-6">
          <div className="relative">
            {/* Image (visible par défaut) */}
            <Avatar name={me?.name || me?.email} photoUrl={me?.photo} version={me?.photoVersion} />
            {/* Fallback initials (caché tant que l'image marche) */}
            <div
              style={{ display: "none" }}
              className="h-20 w-20 rounded-full bg-blue-500 text-white items-center justify-center text-3xl font-bold"
            >
              {(me?.name || me?.email || "A").trim().charAt(0).toUpperCase()}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-700">
            {loading ? "Chargement…" : (me?.name || displayRole)}
          </h2>
          <div className="text-sm text-gray-500 flex flex-col items-center">
            <span className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              {me?.email || "—"}
            </span>
            <span className="mt-1">
              Rôle : <b>{displayRole}</b>
            </span>
            <span className="mt-1">
              Commune : <b>{me?.communeName || me?.communeId || "—"}</b>
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-800 p-3">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Link
            to="/changer-mot-de-passe"
            className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            <Lock className="w-5 h-5 text-gray-600" />
            <span>Modifier le mot de passe</span>
          </Link>

          {canManageUsers && (
            <Link
              to="/utilisateurs"
              className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
            >
              <Users className="w-5 h-5 text-gray-600" />
              <span>Gérer les utilisateurs</span>
            </Link>
          )}

          <Link
            to="/settings"
            className="flex items-center gap-3 p-3 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            <Settings className="w-5 h-5 text-gray-600" />
            <span>Paramètres</span>
          </Link>

          {me?.impersonated ? (
            <button
              onClick={revertImpersonation}
              className="w-full flex items-center justify-center gap-3 p-3 bg-amber-500 text-white rounded hover:bg-amber-600 transition"
              title="Revenir au compte superadmin original"
            >
              <ArrowLeftCircle className="w-5 h-5" />
              <span>Revenir à mon compte</span>
            </button>
          ) : (
            <button
              onClick={() => handleLogout(false)}
              className="w-full flex items-center gap-3 p-3 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Se déconnecter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
