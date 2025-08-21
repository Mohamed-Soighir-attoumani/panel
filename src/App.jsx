import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import LoginPage from "./pages/LoginPage";
import SuperadminAdmins from './pages/SuperadminAdmins.jsx';
import AdminProfile from "./pages/AdminProfile";
import ChangerPhoto from './pages/ChangerPhoto';
import ChangerMotDePasse from "./pages/ChangerMotDePasse";
import DashboardPage from "./pages/DashboardPage";
import IncidentPage from "./pages/IncidentPage";
import NotificationPage from "./pages/NotificationPage";
import ArticlePage from "./pages/ArticlePage";
import ArticleListPage from "./pages/ArticleListPage";
import ProjectPage from "./pages/ProjectPage";
import ProjectListPage from "./pages/ProjectListPage";
import Layout from "./components/Layout";

const App = () => {
  return (
    <>
      <Routes>
        {/* Route sans layout */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Routes avec layout */}
        <Route element={<Layout />}>
          <Route path="/admins" element={<SuperadminAdmins />} />
          <Route path="/profil" element={<AdminProfile />} />
          <Route path="/changer-photo" element={<ChangerPhoto />} />
          <Route path="/changer-mot-de-passe" element={<ChangerMotDePasse />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentPage />} />
          <Route path="/notifications" element={<NotificationPage />} />
          <Route path="/articles" element={<ArticlePage />} />
          <Route path="/articles/liste" element={<ArticleListPage />} />
          <Route path="/projects" element={<ProjectPage />} />
          <Route path="/projects/liste" element={<ProjectListPage />} />
        </Route>
      </Routes>

      {/* ✅ Affiche les notifications toast */}
      <ToastContainer />
    </>
  );
};

export default App;
