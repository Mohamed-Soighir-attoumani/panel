// src/components/Layout.jsx
import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="pt-16 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-4">
          <Outlet /> {/* <- indispensable */}
        </main>
      </div>
    </div>
  );
}
