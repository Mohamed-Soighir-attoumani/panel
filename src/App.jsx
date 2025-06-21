import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminProfile from './pages/AdminProfile';
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
    <Routes>
      {/* Route sans layout */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Routes avec layout */}
      <Route element={<Layout />}>
        <Route path="/profil" element={<AdminProfile />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/incidents" element={<IncidentPage />} />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route path="/articles" element={<ArticlePage />} />
        <Route path="/articles/liste" element={<ArticleListPage />} />
        <Route path="/projects" element={<ProjectPage />} />
        <Route path="/projects/liste" element={<ProjectListPage />} />

      </Route>
    </Routes>
  );
};

export default App;
