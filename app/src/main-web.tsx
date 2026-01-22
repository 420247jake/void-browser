import React from "react";
import ReactDOM from "react-dom/client";
import WebDemoApp from "./WebDemoApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WebDemoApp />
  </React.StrictMode>
);
