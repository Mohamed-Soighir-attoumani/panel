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

const App = () => {
  return (
    <>
      <Routes>
        {/* Routes publiques */}
        <Route path="/" element={<LoginPage />} />
        {/* Permettre les anciens liens /login => rediriger vers / */}
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

          {/* Notifications */}
          <Route
            path="/notifications"
            element={
              <RequireRole role="admin">
                <NotificationsList />
              </RequireRole>
            }
          />
          <Route
            path="/notifications/nouveau"
            element={
              <RequireRole role="admin">
                <NotificationsCreate />
              </RequireRole>
            }
          />

          {/* Articles */}
          {/* Liste */}
          <Route path="/articles/liste" element={<ArticleListPage />} />
          {/* Création (deux chemins supportés) */}
          <Route
            path="/articles"
            element={
              <RequireRole role="admin">
                <ArticleCreate />
              </RequireRole>
            }
          />
          <Route
            path="/articles/nouveau"
            element={
              <RequireRole role="admin">
                <ArticleCreate />
              </RequireRole>
            }
          />

          {/* Santé & Propreté */}
          <Route
            path="/infos"
            element={
              <RequireRole role="admin">
                <InfosList />
              </RequireRole>
            }
          />
          <Route
            path="/infos/nouveau"
            element={
              <RequireRole role="admin">
                <InfosCreate />
              </RequireRole>
            }
          />

          {/* Projets */}
          {/* Liste */}
          <Route path="/projects/liste" element={<ProjectListPage />} />
          {/* Création (deux chemins supportés) */}
          <Route
            path="/projects"
            element={
              <RequireRole role="admin">
                <ProjectCreate />
              </RequireRole>
            }
          />
          <Route
            path="/projects/nouveau"
            element={
              <RequireRole role="admin">
                <ProjectCreate />
              </RequireRole>
            }
          />

          {/* 💳 Mon Abonnement (admin et superadmin y ont accès) */}
          <Route
            path="/mon-abonnement"
            element={
              <RequireRole role="admin">
                <MonAbonnement />
              </RequireRole>
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
