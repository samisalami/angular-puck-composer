import type { CSSProperties } from "react";
import type { Config, Data, Slot } from "@puckeditor/core";
import { generatedBlocks, generatedCategories, type GeneratedComponents } from "./generated/blocks";
import { applyOverrides, overrides } from "./overrides";

// The Puck config has three parts:
//   1. layout blocks (below, hand-written): Section/Stack/Grid as plain React + the library's CSS
//      classes, because their children are Puck-managed React trees;
//   2. content blocks: GENERATED from the stories tagged 'puck' (src/generated/blocks.tsx);
//   3. overrides for generated blocks that need custom behaviour (src/overrides.tsx).

type LayoutComponents = {
  Section: { background: "default" | "surface" | "primary"; padding: number; content: Slot };
  Stack: { direction: "column" | "row"; gap: number; content: Slot };
  Grid: { columns: number; gap: number; content: Slot };
};
type Components = LayoutComponents & GeneratedComponents;
type RootProps = { title: string; theme: "light" | "dark" };
export type PageData = Data<Components, RootProps>;

const opts = <T extends string | number>(...values: T[]) => values.map((v) => ({ label: String(v), value: v }));

const layoutBlocks: Config<LayoutComponents>["components"] = {
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
};

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
    ...generatedCategories,
  },
  // Layout and generated blocks are typed separately; together they form the full component map.
  components: {
    ...layoutBlocks,
    ...applyOverrides(generatedBlocks, overrides),
  } as Config<Components, RootProps>["components"],
};
