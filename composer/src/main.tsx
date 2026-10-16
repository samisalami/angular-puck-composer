import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// no-external.css = Puck styles without the Inter webfont from rsms.me (keeps the composer offline-capable)
import "@puckeditor/core/no-external.css";
import "./app.css";
import { App } from "./App";
import { loadAngularElements } from "./elements";

const root = createRoot(document.getElementById("root")!);

loadAngularElements().then(
  () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (err: Error) => root.render(<pre className="pc-pad">{err.message}</pre>),
);
