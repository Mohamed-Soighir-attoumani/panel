import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Users, Settings, LogOut, ShieldCheck, User as UserIcon, ArrowLeftCircle } from "lucide-react";

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

const Avatar = ({ name, photoUrl }) => {
  const letter = (name || "").trim().charAt(0).toUpperCase() || "A";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="avatar"
        className="h-20 w-20 rounded-full object-cover border"
      />
    );
  }
  return (
    <div className="h-20 w-20 rounded-full bg-blue-500 text-white flex items-center justify-center text-3xl font-bold">
      {letter}
    </div>
  );
};

export default function AdminProfile() {
  const navigate = useNavigate();

  const [me, setMe] = useState(readCachedMe());
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
    return () => { cancelled = true; };
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
          <Avatar name={me?.name || me?.email} photoUrl={me?.photo} />
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
