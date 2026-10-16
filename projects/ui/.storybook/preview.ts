import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Design token theme',
      toolbar: { icon: 'paintbrush', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    // Same wrapper the composer uses: .ui-canvas carries the base typography, data-theme the tokens.
    componentWrapperDecorator(
      (story) => `<div class="ui-canvas" [attr.data-theme]="theme" style="padding: 16px">${story}</div>`,
      ({ globals }) => ({ theme: globals['theme'] }),
    ),
  ],
  tags: ['autodocs'],
};
export default preview;
