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

// ⚠️ Si vous avez bien créé ces nouvelles pages, laissez ces imports.
//    Sinon, commentez-les temporairement et utilisez les anciennes pages.
import NotificationsCreate from "./pages/NotificationsCreate";
import ArticleCreate from "./pages/ArticleCreate";
import ArticleListPage from "./pages/ArticleListPage";
import ProjectCreate from "./pages/ProjectCreate";
import ProjectListPage from "./pages/ProjectListPage";

// Layout
import Layout from "./components/Layout";

// Guards
import PrivateRoute from "./routes/PrivateRoute";
import RequireRole from "./routes/RequireRole";

const App = () => {
  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Privé + Layout */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Superadmin only */}
          <Route
            path="/admins"
            element={
              <RequireRole role="superadmin">
                <SuperadminAdmins />
              </RequireRole>
            }
          />

          {/* Admin connecté */}
          <Route path="/profil" element={<AdminProfile />} />
          <Route path="/utilisateurs" element={<Utilisateurs />} />
          <Route path="/changer-photo" element={<ChangerPhoto />} />
          <Route path="/changer-mot-de-passe" element={<ChangerMotDePasse />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentPage />} />

          {/* Notifications */}
          <Route
            path="/notifications/nouveau"
            element={
              <RequireRole role="admin">
                <NotificationsCreate />
              </RequireRole>
            }
          />
          {/* Alias “liste” si vous en avez un — sinon enlevez-le */}
          {/* <Route path="/notifications" element={<NotificationsListPage />} /> */}

          {/* Articles */}
          <Route
            path="/articles/nouveau"
            element={
              <RequireRole role="admin">
                <ArticleCreate />
              </RequireRole>
            }
          />
          <Route path="/articles/liste" element={<ArticleListPage />} />

          {/* Projets */}
          <Route
            path="/projects/nouveau"
            element={
              <RequireRole role="admin">
                <ProjectCreate />
              </RequireRole>
            }
          />
          <Route path="/projects/liste" element={<ProjectListPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<div style={{ padding: "2rem" }}>Page introuvable</div>} />
      </Routes>

      <ToastContainer />
    </>
  );
};

export default App;
