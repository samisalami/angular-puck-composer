import type { CSSProperties } from "react";
import type { Config, Data, Slot } from "@puckeditor/core";
import { useCustomEvent } from "./elements";
import { toast } from "./toast";

// Layout blocks are plain React + the library's CSS classes (ui-section/ui-stack/ui-grid from tokens.css):
// their children are Puck-managed React trees, which is exactly what Angular content projection
// (<ng-content>) is worst at. Everything else is an Angular component rendered as a custom element.

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
type Components = {
  Section: { background: "default" | "surface" | "primary"; padding: number; content: Slot };
  Stack: { direction: "column" | "row"; gap: number; content: Slot };
  Grid: { columns: number; gap: number; content: Slot };
  Navbar: { brand: string; links: string; ctaLabel: string };
  Hero: { eyebrow: string; title: string; subtitle: string; primaryCta: string; secondaryCta: string };
  Heading: { text: string; level: 1 | 2 | 3 | 4; align: "left" | "center" | "right" };
  Text: { text: string; size: "sm" | "md" | "lg"; muted: boolean };
  Card: { title: string; body: string; badge: string; badgeTone: Tone; footer: string; content: Slot };
  Avatar: { name: string; size: number };
  Button: { label: string; variant: "primary" | "secondary" | "ghost"; size: "sm" | "md" | "lg" };
  Badge: { label: string; tone: Tone };
  StatCard: { label: string; value: string; delta: string; trend: "up" | "down" | "flat" };
  ProgressBar: { label: string; value: number };
  Alert: { title: string; message: string; tone: "info" | "success" | "warning" | "danger" };
  Quote: { text: string; author: string; role: string };
};
type RootProps = { title: string; theme: "light" | "dark" };
export type PageData = Data<Components, RootProps>;

const opts = <T extends string | number>(...values: T[]) => values.map((v) => ({ label: String(v), value: v }));
const tones = opts<Tone>("neutral", "success", "warning", "danger", "info");

/** Angular outputs arrive as DOM events; in the share view they show a toast to prove the round trip. */
function ButtonBlock(props: Components["Button"] & { editing: boolean }) {
  const ref = useCustomEvent("pressed", () => !props.editing && toast(`"${props.label}" pressed (Angular output)`));
  return <apc-button ref={ref} label={props.label} variant={props.variant} size={props.size} />;
}
function HeroBlock({ editing, ...props }: Components["Hero"] & { editing: boolean }) {
  const ref = useCustomEvent<string>("ctaClick", (which) => !editing && toast(`Hero ${which} CTA clicked (Angular output)`));
  return <apc-hero ref={ref} {...props} />;
}

export const config: Config<Components, RootProps> = {
  root: {
    fields: { title: { type: "text" }, theme: { type: "radio", options: opts("light", "dark") } },
    defaultProps: { title: "Untitled page", theme: "light" },
    render: ({ children, theme }) => (
      <div className="ui-canvas" data-theme={theme} style={{ minHeight: "100%" }}>
        {children}
      </div>
    ),
  },
  categories: {
    layout: { title: "Layout (React)", components: ["Section", "Stack", "Grid"] },
    marketing: { title: "Marketing", components: ["Navbar", "Hero"] },
    content: { title: "Content", components: ["Heading", "Text", "Card", "Quote", "Avatar", "Button", "Badge"] },
    data: { title: "Data & feedback", components: ["StatCard", "ProgressBar", "Alert"] },
  },
  components: {
    Section: {
      fields: {
        background: { type: "select", options: opts("default", "surface", "primary") },
        padding: { type: "number", min: 0, max: 160 },
        content: { type: "slot" },
      },
      defaultProps: { background: "default", padding: 48, content: [] },
      render: ({ background, padding, content: Content }) => (
        <section className={`ui-section ui-section--${background}`} style={{ "--ui-section-pad": `${padding}px` } as CSSProperties}>
          <Content className="ui-section__inner" />
        </section>
      ),
    },
    Stack: {
      fields: {
        direction: { type: "radio", options: opts("column", "row") },
        gap: { type: "number", min: 0, max: 64 },
        content: { type: "slot" },
      },
      defaultProps: { direction: "column", gap: 16, content: [] },
      // The slot itself is the flex container, so dropped blocks are direct flex items.
      render: ({ direction, gap, content: Content }) => (
        <Content className={`ui-stack${direction === "row" ? " ui-stack--row" : ""}`} style={{ "--ui-gap": `${gap}px` } as CSSProperties} />
      ),
    },
    Grid: {
      fields: {
        columns: { type: "number", min: 1, max: 6 },
        gap: { type: "number", min: 0, max: 64 },
        content: { type: "slot" },
      },
      defaultProps: { columns: 3, gap: 16, content: [] },
      render: ({ columns, gap, content: Content }) => (
        <Content className="ui-grid" style={{ "--ui-cols": columns, "--ui-gap": `${gap}px` } as CSSProperties} />
      ),
    },
    Navbar: {
      fields: { brand: { type: "text" }, links: { type: "text" }, ctaLabel: { type: "text" } },
      defaultProps: { brand: "Acme", links: "Product, Pricing, Docs", ctaLabel: "Sign in" },
      render: ({ puck, ...props }) => <apc-navbar {...stripId(props)} />,
    },
    Hero: {
      fields: {
        eyebrow: { type: "text" },
        title: { type: "textarea" },
        subtitle: { type: "textarea" },
        primaryCta: { type: "text" },
        secondaryCta: { type: "text" },
      },
      defaultProps: {
        eyebrow: "New",
        title: "A headline that sells the idea",
        subtitle: "One or two sentences of supporting copy.",
        primaryCta: "Get started",
        secondaryCta: "Learn more",
      },
      render: ({ puck, ...props }) => <HeroBlock {...stripId(props)} editing={puck.isEditing} />,
    },
    Heading: {
      fields: {
        text: { type: "text" },
        level: { type: "select", options: opts<1 | 2 | 3 | 4>(1, 2, 3, 4) },
        align: { type: "radio", options: opts("left", "center", "right") },
      },
      defaultProps: { text: "Section heading", level: 2, align: "left" },
      render: ({ puck, ...props }) => <apc-heading {...stripId(props)} />,
    },
    Text: {
      fields: {
        text: { type: "textarea" },
        size: { type: "radio", options: opts("sm", "md", "lg") },
        muted: { type: "radio", options: [{ label: "yes", value: true }, { label: "no", value: false }] },
      },
      defaultProps: { text: "Body copy goes here.", size: "md", muted: false },
      render: ({ puck, ...props }) => <apc-text {...stripId(props)} />,
    },
    Card: {
      fields: {
        title: { type: "text" },
        body: { type: "textarea" },
        badge: { type: "text" },
        badgeTone: { type: "select", options: tones },
        footer: { type: "text" },
        content: { type: "slot" },
      },
      defaultProps: { title: "Card title", body: "Short description.", badge: "", badgeTone: "info", footer: "", content: [] },
      // Content projection test: Puck-managed React children inside an Angular <ng-content>.
      render: ({ puck, content: Content, ...props }) => (
        <apc-card {...stripId(props)}>
          <Content />
        </apc-card>
      ),
    },
    Avatar: {
      fields: { name: { type: "text" }, size: { type: "number", min: 16, max: 128 } },
      defaultProps: { name: "Ada Lovelace", size: 40 },
      render: ({ puck, ...props }) => <apc-avatar {...stripId(props)} />,
    },
    Button: {
      fields: {
        label: { type: "text" },
        variant: { type: "select", options: opts("primary", "secondary", "ghost") },
        size: { type: "radio", options: opts("sm", "md", "lg") },
      },
      defaultProps: { label: "Click me", variant: "primary", size: "md" },
      render: ({ puck, ...props }) => <ButtonBlock {...stripId(props)} editing={puck.isEditing} />,
    },
    Badge: {
      fields: { label: { type: "text" }, tone: { type: "select", options: tones } },
      defaultProps: { label: "Beta", tone: "info" },
      render: ({ puck, ...props }) => <apc-badge {...stripId(props)} />,
    },
    StatCard: {
      fields: {
        label: { type: "text" },
        value: { type: "text" },
        delta: { type: "text" },
        trend: { type: "radio", options: opts("up", "down", "flat") },
      },
      defaultProps: { label: "Metric", value: "1,234", delta: "5%", trend: "up" },
      render: ({ puck, ...props }) => <apc-stat-card {...stripId(props)} />,
    },
    ProgressBar: {
      fields: { label: { type: "text" }, value: { type: "number", min: 0, max: 100 } },
      defaultProps: { label: "Progress", value: 50 },
      render: ({ puck, ...props }) => <apc-progress-bar {...stripId(props)} />,
    },
    Alert: {
      fields: {
        title: { type: "text" },
        message: { type: "textarea" },
        tone: { type: "select", options: opts("info", "success", "warning", "danger") },
      },
      defaultProps: { title: "Heads up", message: "Something worth knowing.", tone: "info" },
      render: ({ puck, ...props }) => <apc-alert {...stripId(props)} />,
    },
    Quote: {
      fields: { text: { type: "textarea" }, author: { type: "text" }, role: { type: "text" } },
      defaultProps: { text: "We cut onboarding from two weeks to three days.", author: "Ada Lovelace", role: "Head of Growth" },
      render: ({ puck, ...props }) => <apc-quote {...stripId(props)} />,
    },
  },
};

/**
 * Puck adds `id` (and `editMode`) props to every block. Spread onto a custom element, React would
 * write them as DOM attributes (`id="Card-1"`, `editmode=""`), so drop them before forwarding.
 */
function stripId<T extends { id?: string; editMode?: boolean }>({ id: _id, editMode: _editMode, ...rest }: T): Omit<T, "id" | "editMode"> {
  return rest;
}
