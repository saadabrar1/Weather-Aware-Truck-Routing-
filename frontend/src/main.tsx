import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Planner from "./pages/Planner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Planner />
  </StrictMode>,
);
