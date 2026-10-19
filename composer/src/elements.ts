import { useEffect, useRef } from "react";

declare global {
  interface Window {
    /** Set by the elements bundle (projects/elements/src/main.ts) once every tag is defined. */
    apcElements?: string[];
  }
}

/**
 * Loads the Angular Elements bundle and resolves once it reports every custom element as defined.
 * Rendering React only afterwards matters: React 19 sets props as *properties* only if the element
 * already has them (i.e. is upgraded); before that it falls back to string attributes.
 */
export async function loadAngularElements(base = "/elements"): Promise<string[]> {
  const ready = new Promise<string[]>((resolve) => {
    if (window.apcElements) return resolve(window.apcElements);
    document.addEventListener("apc-elements-ready", (e) => resolve((e as CustomEvent<string[]>).detail), { once: true });
  });

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `${base}/styles.css`;
  document.head.append(css);

  const js = document.createElement("script");
  js.type = "module";
  js.src = `${base}/main.js`;
  const failed = new Promise<never>((_, reject) => {
    js.onerror = () => reject(new Error(`Could not load ${js.src} - did you run "npm run build:elements"?`));
  });
  document.head.append(js);
  return Promise.race([ready, failed]);
}

/** Subscribes to an Angular output, which a custom element exposes as a DOM CustomEvent. */
export function useCustomEvent<T = unknown>(name: string, handler: (detail: T) => void) {
  const ref = useRef<HTMLElement>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (e: Event) => handlerRef.current((e as CustomEvent<T>).detail);
    el.addEventListener(name, listener);
    return () => el.removeEventListener(name, listener);
  }, [name]);
  return ref;
}
