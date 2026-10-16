import { useState, type RefObject } from "react";
import { toPng } from "html-to-image";

/** Elements with this class are left out of the exported image (e.g. the button itself). */
export const NO_CAPTURE = "pc-no-capture";

// Browsers cap canvas size (Chrome/Firefox ~32k px per side, Safari less). Very long pages are
// exported at a lower pixel ratio instead of failing.
const MAX_SIDE = 16000;

/**
 * Saves the full page (not just the visible viewport) as a PNG. Runs entirely in the browser: the
 * DOM, including the rendered Angular elements, is cloned with its computed styles and rasterized.
 */
export function SaveImageButton({ target, fileName }: { target: RefObject<HTMLElement | null>; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function save() {
    const el = target.current;
    if (!el) return;
    setBusy(true);
    try {
      const width = el.scrollWidth;
      const height = el.scrollHeight;
      const pixelRatio = Math.max(0.5, Math.min(2, MAX_SIDE / Math.max(width, height)));
      const dataUrl = await toPng(el, {
        width,
        height,
        pixelRatio,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains(NO_CAPTURE)),
      });
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Could not create the image - see the browser console for details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`pc-save-image ${NO_CAPTURE}`} onClick={save} disabled={busy}>
      {busy ? "Saving…" : "Save image"}
    </button>
  );
}
