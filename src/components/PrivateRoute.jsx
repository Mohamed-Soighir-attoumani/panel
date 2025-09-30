// src/components/PrivateRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * Protège les routes privées :
 * - Vérifie la présence du token dans localStorage
 * - Si pas de token → redirige vers /login en conservant la destination
 * - Supporte 2 usages :
 *   1) <Route element={<PrivateRoute />}><Route path="/..." element={<Page />} /></Route>
 *   2) <Route path="/..." element={<PrivateRoute element={<Page />} />} />
 */
const PrivateRoute = ({ element }) => {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si un élément est fourni, on le rend ; sinon on utilise <Outlet/> pour les routes enfants
  return element ?? <Outlet />;
};

export default PrivateRoute;
