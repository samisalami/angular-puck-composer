import { useEffect, useRef, useState } from "react";
import { Puck, Render } from "@puckeditor/core";
import { listPages, loadPage, savePage, slugify, type PageSummary } from "@apc/page-server/client";
import { config, type PageData } from "./config";
import { demoPage } from "./demo";
import { SaveImageButton } from "./save-image";

// Three routes, no router dependency:
//   /             page list
//   /edit/:slug   Puck editor (for devs)
//   /view/:slug   chrome-less render (the link you send to management)
export function App() {
  const [, kind, slug] = window.location.pathname.split("/");
  if (kind === "edit" && slug) return <Editor slug={slug} />;
  if (kind === "view" && slug) return <Viewer slug={slug} />;
  return <Home />;
}

function usePage(slug: string) {
  const [data, setData] = useState<PageData | null | undefined>(undefined);
  useEffect(() => {
    loadPage<PageData>(slug).then(setData, () => setData(null));
  }, [slug]);
  return data;
}

function Editor({ slug }: { slug: string }) {
  const data = usePage(slug);
  const [status, setStatus] = useState("");
  if (data === undefined) return <p className="pc-pad">Loading…</p>;

  return (
    <Puck
      config={config}
      data={data ?? { root: { props: { title: slug, theme: "light" } }, content: [] }}
      headerTitle={slug}
      // No iframe: the canvas lives in this document, so the Angular custom elements registered here
      // just work. Cost: no CSS isolation and media queries follow the real window - fine for a
      // desktop-only product. With the iframe on, the elements bundle would have to be injected into
      // the iframe document via overrides.iframe.
      iframe={{ enabled: false }}
      viewports={[{ width: 1440, label: "Desktop" }]}
      onPublish={async (next) => {
        setStatus("Saving…");
        await savePage(slug, next);
        setStatus("Saved");
      }}
      overrides={{
        headerActions: ({ children }) => (
          <>
            <span className="pc-status">{status}</span>
            <a className="pc-link" href={`/view/${slug}`} target="_blank" rel="noreferrer">
              Open share view ↗
            </a>
            <a className="pc-link" href="/">All pages</a>
            {children}
          </>
        ),
      }}
    />
  );
}

function Viewer({ slug }: { slug: string }) {
  const data = usePage(slug);
  const pageRef = useRef<HTMLDivElement>(null);
  if (data === undefined) return null;
  if (data === null) return <p className="pc-pad">Page “{slug}” not found.</p>;
  return (
    <>
      {/* The wrapper is what gets exported: the whole page, however long. */}
      <div ref={pageRef}>
        <Render config={config} data={data} />
      </div>
      <SaveImageButton target={pageRef} fileName={`${slug}.png`} />
    </>
  );
}

function Home() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [name, setName] = useState("");
  const refresh = () => listPages().then(setPages, console.error);
  useEffect(() => void refresh(), []);

  return (
    <main className="pc-home">
      <h1>Composer</h1>
      <p>
        Drag-and-drop pages built from the <code>@apc/ui</code> Angular components (as custom elements).
        Pages are stored as JSON by the page server.
      </p>
      <form
        className="pc-row"
        onSubmit={(e) => {
          e.preventDefault();
          const slug = slugify(name);
          if (slug) window.location.href = `/edit/${slug}`;
        }}
      >
        <input placeholder="new page name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Create</button>
        <button type="button" onClick={() => savePage("demo-dashboard", demoPage).then(refresh)}>
          Seed demo page
        </button>
      </form>
      <table>
        <tbody>
          {pages.map((p) => (
            <tr key={p.slug}>
              <td>{p.slug}</td>
              <td>{new Date(p.updatedAt).toLocaleString()}</td>
              <td><a href={`/edit/${p.slug}`}>edit</a></td>
              <td><a href={`/view/${p.slug}`}>view</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
