// src/components/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

/**
 * Layout:
 * - Header fixé en haut (64px = h-16)
 * - Sous le header, on a une grille (md) : [sidebar 16rem | contenu]
 * - Toute la page a une SEULE scroll bar (pas de scroll interne à la sidebar)
 */
const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header fixe */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Conteneur sous header */}
      <div className="pt-16">
        {/* Grille à partir de md : sidebar + contenu */}
        <div className="md:grid md:grid-cols-[16rem,1fr] md:gap-0">
          {/* Colonne gauche : sidebar statique (défile avec la page) */}
          <Sidebar />

          {/* Colonne droite : contenu */}
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
