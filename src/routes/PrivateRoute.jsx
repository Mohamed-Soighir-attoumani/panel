import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Protège les routes privées :
 * - exige un token en localStorage
 * - sinon redirige vers /login en conservant la destination
 */
const PrivateRoute = ({ children }) => {
  const location = useLocation();
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

export default PrivateRoute;
