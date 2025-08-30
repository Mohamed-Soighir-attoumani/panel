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
import NotificationsCreate from "./pages/NotificationsCreate";
import NotificationsList from "./pages/NotificationsList";
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
        {/* Routes publiques */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Routes privées avec Layout */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Superadmin uniquement */}
          <Route
            path="/admins"
            element={
              <RequireRole role="superadmin">
                <SuperadminAdmins />
              </RequireRole>
            }
          />

          {/* Admins connectés */}
          <Route path="/profil" element={<AdminProfile />} />
          <Route path="/utilisateurs" element={<Utilisateurs />} />
          <Route path="/changer-photo" element={<ChangerPhoto />} />
          <Route path="/changer-mot-de-passe" element={<ChangerMotDePasse />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentPage />} />

          {/* Notifications – création */}
          <Route
            path="/notifications/nouveau"
            element={
              <RequireRole role="admin">
                <NotificationsCreate />
                
              </RequireRole>
            }
          />
          <Route path="/notifications" element={<NotificationsList />} />
          {/* Articles – création + liste */}
          <Route
            path="/articles/nouveau"
            element={
              <RequireRole role="admin">
                <ArticleCreate />
              </RequireRole>
            }
          />
          <Route path="/articles/liste" element={<ArticleList />} />

          {/* Projets – création + liste */}
          <Route
            path="/projects/nouveau"
            element={
              <RequireRole role="admin">
                <ProjectCreate />
              </RequireRole>
            }
          />
          <Route path="/projects/liste" element={<ProjectList />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<div style={{ padding: "2rem" }}>Page introuvable</div>} />
      </Routes>

      <ToastContainer />
    </>
  );
};

export default App;
