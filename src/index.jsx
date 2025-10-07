// src/index.jsx (ou src/main.jsx selon ton projet)
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

// 1) Ton CSS global d’abord (reset/Tailwind)
import "./index.css";

// 2) Puis Quill (core avant snow)
import "react-quill/dist/quill.core.css";
import "react-quill/dist/quill.snow.css";

const container = document.getElementById("root");
if (!container) throw new Error("Élément #root introuvable");
const root = createRoot(container);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
