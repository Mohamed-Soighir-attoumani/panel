import React from "react";
import { Navigate } from "react-router-dom";

// Composant de route protégée
const PrivateRoute = ({ element }) => {
  const token = localStorage.getItem("token");

  // Si le token n'est pas trouvé, rediriger vers la page de login
  return token ? element : <Navigate to="/login" />;
};

export default PrivateRoute;


