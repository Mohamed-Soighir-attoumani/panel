// src/index.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom"; // ✅ on utilise HashRouter
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Élément #root introuvable dans public/index.html");

const root = createRoot(container);

root.render(
  <HashRouter>
    <App />
  </HashRouter>
);
