import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

/**
 * Layout simple :
 * - Header fixé en haut (64px = h-16)
 * - Sidebar fixe à gauche (w-64) sous le header
 * - Contenu avec padding-top/margin-left correspondant
 *   (sur mobile, la sidebar étant fixe, le contenu reste visible sous le header)
 */
const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Sidebar (fixe sous le header) */}
      <Sidebar />

      {/* Zone de contenu : padding pour ne pas passer sous le header
          et marge gauche pour ne pas passer sous la sidebar sur écrans >= md */}
      <main className="pt-16 md:ml-64">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
