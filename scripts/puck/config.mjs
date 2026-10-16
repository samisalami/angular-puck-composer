// Project-specific settings for the Puck generator. This is the only file to adapt when the
// generator is moved into another Angular workspace. All paths are relative to the repository root.

export const config = {
  /** tsconfig that covers the stories (and through their imports, the components). */
  storiesTsconfig: 'projects/ui/.storybook/tsconfig.json',

  /** Stories carrying this Storybook tag are turned into Puck blocks. */
  tag: 'puck',

  /** Every opted-in component must use this selector prefix; the custom element tag swaps it. */
  selectorPrefix: 'ui-',
  tagPrefix: 'apc-',

  /** Generated code imports components from here; they must be exported from `libraryEntry`. */
  libraryImport: '@apc/ui',
  libraryEntry: 'projects/ui/src/public-api.ts',

  /** Generated files (committed, never edited by hand). */
  out: {
    elements: 'projects/elements/src/elements.generated.ts',
    typings: 'composer/src/generated/custom-elements.d.ts',
    blocks: 'composer/src/generated/blocks.tsx',
    manifest: 'composer/src/generated/puck-manifest.json',
  },

  /** Category for blocks whose story doesn't set `parameters.puck.category`. */
  defaultCategory: 'Components',

  /** A `text` field whose default is longer than this triggers a "use textarea?" warning. */
  longTextWarning: 60,
};
