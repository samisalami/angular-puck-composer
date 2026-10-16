import type { GeneratedBlocks, GeneratedComponents } from "./generated/blocks";
import { useCustomEvent } from "./elements";
import { toast } from "./toast";

// Hand-written exceptions on top of the generated blocks. Anything set here replaces the generated
// value for that block (e.g. `render`, a field, a label). Keep it small: everything that can be
// expressed in the story's `parameters.puck` belongs there instead.

export type BlockOverrides = { [K in keyof GeneratedBlocks]?: Partial<GeneratedBlocks[K]> };

/** Angular outputs arrive as DOM events; in the share view they show a toast to prove the round trip. */
function ButtonBlock(props: GeneratedComponents["Button"] & { editing: boolean }) {
  const { editing, ...rest } = props;
  const ref = useCustomEvent("pressed", () => !editing && toast(`"${rest.label}" pressed (Angular output)`));
  return <apc-button ref={ref} {...rest} />;
}

function HeroBlock(props: GeneratedComponents["Hero"] & { editing: boolean }) {
  const { editing, ...rest } = props;
  const ref = useCustomEvent<string>("ctaClick", (which) => !editing && toast(`Hero ${which} CTA clicked (Angular output)`));
  return <apc-hero ref={ref} {...rest} />;
}

export const overrides: BlockOverrides = {
  Button: {
    render: ({ puck, id: _id, editMode: _editMode, ...props }) => <ButtonBlock {...props} editing={puck.isEditing} />,
  },
  Hero: {
    render: ({ puck, id: _id, editMode: _editMode, ...props }) => <HeroBlock {...props} editing={puck.isEditing} />,
  },
};

export function applyOverrides(blocks: GeneratedBlocks, extra: BlockOverrides): GeneratedBlocks {
  const merged = { ...blocks } as Record<string, object>;
  for (const [name, override] of Object.entries(extra)) merged[name] = { ...merged[name], ...override };
  return merged as GeneratedBlocks;
}
