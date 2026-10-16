/** Minimal toast so the share view can show that Angular outputs reach the React host. */
export function toast(message: string) {
  const el = document.createElement("div");
  el.className = "pc-toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}
