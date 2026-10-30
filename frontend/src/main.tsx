import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Landing from "./pages/Landing";
import Planner from "./pages/Planner";

// Two pages need no router: Django (and Vite in dev) serve index.html for both paths.
const Page = window.location.pathname.startsWith("/app") ? Planner : Landing;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
