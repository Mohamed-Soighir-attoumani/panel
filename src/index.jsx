import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";

// ⚠️ indispensable pour Tailwind/CSS global
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Élément #root introuvable dans public/index.html");
}
const root = createRoot(container);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
