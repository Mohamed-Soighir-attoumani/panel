import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

const AppLayout = () => {
  return (
    <>
      <Header />
      <Sidebar />
      
      {/* Contenu principal décalé du header et de la sidebar */}
      <main className="ml-64 mt-16 p-6">
        <Outlet />
      </main>
    </>
  );
};

export default AppLayout;
