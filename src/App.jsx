// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Pages
import LoginPage from "./pages/LoginPage";
import SuperadminAdmins from "./pages/SuperadminAdmins";
import Utilisateurs from "./pages/utilisateurs.jsx";
import AdminProfile from "./pages/AdminProfile";
import ChangerPhoto from "./pages/ChangerPhoto";
import ChangerMotDePasse from "./pages/ChangerMotDePasse";
import DashboardPage from "./pages/DashboardPage";
import IncidentPage from "./pages/IncidentPage";

// Notifications / Articles / Projets
import NotificationsList from "./pages/NotificationsList";
import NotificationsCreate from "./pages/NotificationsCreate";
import ArticleCreate from "./pages/ArticleCreate";
import ArticleListPage from "./pages/ArticleListPage";
import ProjectCreate from "./pages/ProjectCreate";
import ProjectListPage from "./pages/ProjectListPage";
import InfosList from "./pages/InfosList";
import InfosCreate from "./pages/InfosCreate";

// 💳 Abonnement (nouvelle page)
import MonAbonnement from "./pages/MonAbonnement";

// Layout
import Layout from "./components/Layout";

// Guards
import PrivateRoute from "./routes/PrivateRoute";
import RequireRole from "./routes/RequireRole";

/* ──────────────────────────────────────────────────────────────
   Helper local : autoriser plusieurs rôles sans toucher RequireRole
   ────────────────────────────────────────────────────────────── */
const RequireAnyRole = ({ roles, children }) => {
  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    const role = me?.role;
    if (role && roles.includes(role)) return children;
  } catch {}
  // si pas autorisé, on renvoie vers le dashboard (ou /)
  return <Navigate to="/dashboard" replace />;
};

const App = () => {
  return (
    <>
      <Routes>
        {/* Routes publiques */}
        <Route path="/" element={<LoginPage />} />
        {/* anciens liens /login => / */}
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* Routes privées avec Layout */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Page superadmin uniquement */}
          <Route
            path="/admins"
            element={
              <RequireRole role="superadmin">
                <SuperadminAdmins />
              </RequireRole>
            }
          />

          {/* Pages accessibles à tout admin connecté */}
          <Route path="/profil" element={<AdminProfile />} />
          <Route path="/utilisateurs" element={<Utilisateurs />} />
          <Route path="/changer-photo" element={<ChangerPhoto />} />
          <Route path="/changer-mot-de-passe" element={<ChangerMotDePasse />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentPage />} />

          {/* Notifications — admin OU superadmin */}
          <Route
            path="/notifications"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <NotificationsList />
              </RequireAnyRole>
            }
          />
          <Route
            path="/notifications/nouveau"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <NotificationsCreate />
              </RequireAnyRole>
            }
          />

          {/* Articles */}
          <Route path="/articles/liste" element={<ArticleListPage />} />
          <Route
            path="/articles"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <ArticleCreate />
              </RequireAnyRole>
            }
          />
          <Route
            path="/articles/nouveau"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <ArticleCreate />
              </RequireAnyRole>
            }
          />

          {/* Santé & Propreté */}
          <Route
            path="/infos"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <InfosList />
              </RequireAnyRole>
            }
          />
          <Route
            path="/infos/nouveau"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <InfosCreate />
              </RequireAnyRole>
            }
          />

          {/* Projets */}
          <Route path="/projects/liste" element={<ProjectListPage />} />
          <Route
            path="/projects"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <ProjectCreate />
              </RequireAnyRole>
            }
          />
          <Route
            path="/projects/nouveau"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <ProjectCreate />
              </RequireAnyRole>
            }
          />

          {/* 💳 Mon Abonnement — admin ET superadmin (ton commentaire le dit) */}
          <Route
            path="/mon-abonnement"
            element={
              <RequireAnyRole roles={['admin','superadmin']}>
                <MonAbonnement />
              </RequireAnyRole>
            }
          />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={<div style={{ padding: "2rem" }}>Page introuvable</div>}
        />
      </Routes>

      {/* Toasts globaux */}
      <ToastContainer />
    </>
  );
};

export default App;
