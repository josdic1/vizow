import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { OrganizationProvider } from "./contexts/OrganizationContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <OrganizationProvider>
        <App />
      </OrganizationProvider>
    </BrowserRouter>
  </StrictMode>,
);
