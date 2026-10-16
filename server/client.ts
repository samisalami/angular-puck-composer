// Tiny typed client for the page-server API, shared by the browser apps.
export interface PageSummary {
  slug: string;
  updatedAt: string;
}

export async function listPages(): Promise<PageSummary[]> {
  const res = await fetch("/api/pages");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}

export async function loadPage<T>(slug: string): Promise<T | null> {
  const res = await fetch(`/api/pages/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  return res.json();
}

export async function savePage(slug: string, data: unknown): Promise<void> {
  const res = await fetch(`/api/pages/${slug}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}

export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
