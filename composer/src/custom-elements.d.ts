// JSX typings for the Angular custom elements. Keep in sync with the component inputs in projects/ui.
// (Could be generated from the Angular sources/compodoc later; hand-written for the spike.)
import type { DetailedHTMLProps, HTMLAttributes, RefObject } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
type El<P> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & P & { ref?: RefObject<HTMLElement | null> };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "apc-alert": El<{ title?: string; message?: string; tone?: "info" | "success" | "warning" | "danger" }>;
      "apc-avatar": El<{ name?: string; size?: number }>;
      "apc-badge": El<{ label?: string; tone?: Tone }>;
      "apc-button": El<{ label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" }>;
      "apc-card": El<{ title?: string; body?: string; badge?: string; badgeTone?: Tone; footer?: string }>;
      "apc-heading": El<{ text?: string; level?: 1 | 2 | 3 | 4; align?: "left" | "center" | "right" }>;
      "apc-hero": El<{ eyebrow?: string; title?: string; subtitle?: string; primaryCta?: string; secondaryCta?: string }>;
      "apc-navbar": El<{ brand?: string; links?: string; ctaLabel?: string }>;
      "apc-progress-bar": El<{ label?: string; value?: number }>;
      "apc-quote": El<{ text?: string; author?: string; role?: string }>;
      "apc-stat-card": El<{ label?: string; value?: string; delta?: string; trend?: "up" | "down" | "flat" }>;
      "apc-text": El<{ text?: string; size?: "sm" | "md" | "lg"; muted?: boolean }>;
    }
  }
}
