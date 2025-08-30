import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * Protège les routes privées :
 * - exige un token en localStorage
 * - sinon redirige vers /login en conservant la destination
 * Supporte les 2 usages : wrapper avec children OU route parent avec <Outlet/>
 */
const PrivateRoute = ({ children }) => {
  const location = useLocation();
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children ?? <Outlet />;
};

export default PrivateRoute;
