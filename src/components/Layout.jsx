// src/components/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

/**
 * Layout:
 * - Header fixé en haut (≈ 56px)
 * - Sous le header: grid 2 colonnes (sidebar, contenu) à partir de md
 * - Une seule scrollbar pour toute la page (pas d'overflow caché)
 */
const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header fixé */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Espace sous le header : exactement 56px pour coller à Header.jsx */}
      <div className="pt-[56px]">
        {/* Grille: sidebar + contenu à partir de md */}
        <div className="mx-auto w-full md:grid md:grid-cols-[16rem,1fr] md:gap-0">
          {/* Sidebar (statique sur desktop, drawer géré en mobile dans Sidebar) */}
          <Sidebar />

          {/* Contenu */}
          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
