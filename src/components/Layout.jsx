import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

/**
 * Layout :
 * - Header fixé en haut (64px = h-16)
 * - Sidebar fixe à gauche sous le header (w-64)
 * - Contenu avec padding-top/marge-gauche pour ne rien masquer
 */
const Layout = () => {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("token_orig");
    localStorage.removeItem("me");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header fixe */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Sidebar (fixe sous le header, responsive dans <Sidebar/>) */}
      <Sidebar />

      {/* Zone de contenu : pt-16 pour libérer le header, md:ml-64 pour libérer la sidebar */}
      <main className="pt-16 md:ml-64">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
