import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();

  // ✅ URL dynamique selon le fichier .env (CRA)
  const API_URL = process.env.REACT_APP_API_URL || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slides = [
    "Signalez les incidents de votre quartier en temps réel.",
    "Recevez des alertes de sécurité directement sur votre téléphone.",
    "Participez à la sécurité de Dembeni avec la mairie.",
    "Ensemble, rendons notre commune plus sûre et solidaire.",
  ];
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!API_URL) {
      setError("Configuration manquante : REACT_APP_API_URL côté front.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await axios.post(`${API_URL}/api/login`, { email, password }, {
        headers: { "Content-Type": "application/json" },
      });

      if (!data?.token) {
        throw new Error("Réponse inattendue du serveur.");
      }

      // Stocke le token
      localStorage.setItem("token", data.token);

      // Récupère /api/me pour alimenter le Header (cache local)
      try {
        const me = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        const u = me?.data?.user || {};
        const cache = {
          communeName: u.communeName || u.commune || "",
          name: u.name || "",
          email: u.email || "",
          photo: u.photo || "",
        };
        localStorage.setItem("admin", JSON.stringify(cache));
      } catch {
        // pas bloquant — Header relira /api/me au montage
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Fond animé */}
      <div className="absolute inset-0 z-0 animate-gradient-x bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-[length:400%_400%]" />

      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="backdrop-blur-lg bg-white/30 rounded-xl shadow-2xl flex flex-col lg:flex-row w-full max-w-6xl overflow-hidden">
          {/* Colonne gauche : intro */}
          <div
            className={`lg:w-1/2 w-full p-10 text-white flex flex-col justify-center relative transition-colors duration-1000 ease-in-out ${
              [
                "bg-gradient-to-br from-indigo-800 to-purple-900",
                "bg-gradient-to-br from-purple-800 to-pink-700",
                "bg-gradient-to-br from-pink-700 to-red-600",
                "bg-gradient-to-br from-emerald-700 to-cyan-700",
              ][currentSlide]
            }`}
          >
            <ShieldCheck size={48} className="absolute top-6 left-6 text-white opacity-90" />
            <h1 className="text-4xl font-bold mb-6 mt-10 lg:mt-0">SécuriDem</h1>
            <div className="text-lg mb-4 leading-relaxed min-h-[100px] transition-all duration-700 ease-in-out">
              <p className="animate-fade-in">{slides[currentSlide]}</p>
            </div>
            <p className="text-sm text-gray-300 mt-6">Pour une commune plus sûre et solidaire.</p>
          </div>

          {/* Colonne droite : formulaire */}
          <div className="lg:w-1/2 w-full p-10 bg-white bg-opacity-90">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Connexion</h2>

            {error && (
              <p className="text-red-600 text-center mb-4 animate-pulse transition duration-300">
                {error}
              </p>
            )}

            {!API_URL && (
              <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 text-sm mb-4">
                ⚠️ REACT_APP_API_URL n'est pas défini côté front. Configure-le dans Render (service du panel) puis redeploy.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Adresse email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="username"
                  className="w-full p-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  className="w-full p-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-60"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            {/* Info debug optionnelle en bas */}
            <div className="mt-4 text-center text-xs text-gray-500">
              {API_URL ? <>API : {API_URL}</> : <>API non configurée</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
