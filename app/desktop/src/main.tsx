import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (true) {
  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = init?.method ?? "GET";

    if (url.includes("/diagram-view") || url.includes("/graph/organization")) {
      console.log("[FETCH TRACE]", method, url, {
        insertCount: (window as any).__insertInProgressCount ?? 0,
      });
      console.log(new Error("fetch trace").stack);
    }

    return origFetch(input as any, init);
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);