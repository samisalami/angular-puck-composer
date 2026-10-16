import type { Meta, StoryObj } from '@storybook/angular';
import { TextBlock } from '../lib/text';

const meta: Meta<TextBlock> = {
  title: 'Components/Text',
  component: TextBlock,
  args: { text: 'Supporting copy that explains the section.', size: 'md', muted: false },
  argTypes: { size: { control: 'radio', options: ['sm', 'md', 'lg'] } },
};
export default meta;

export const Default: StoryObj<TextBlock> = {};
export const Muted: StoryObj<TextBlock> = { args: { muted: true } };
