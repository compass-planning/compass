import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// The CRM API is mounted at /api/crm (Compass Planning owns plain /api/*). Several shared hooks still build
// plain "/api/..." URLs, which in the merged app would hit Compass Planning's server and come back empty.
// Send every same-origin "/api/..." call from the CRM client to "/api/crm/..." exactly once.
const nativeFetch = window.fetch.bind(window);
const crmUrl = (u: string) => (/^\/api\/(?!crm(\/|$|\?))/.test(u) ? u.replace(/^\/api\//, "/api/crm/") : u);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string") return nativeFetch(crmUrl(input), init);
  if (input instanceof URL && input.origin === window.location.origin) {
    const next = crmUrl(input.pathname) + input.search + input.hash;
    return nativeFetch(next, init);
  }
  return nativeFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
