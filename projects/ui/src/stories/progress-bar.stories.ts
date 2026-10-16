import type { Meta, StoryObj } from '@storybook/angular';
import { ProgressBar } from '../lib/progress-bar';

const meta: Meta<ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['puck'],
  parameters: { puck: { category: 'Data & feedback' } },
  args: { label: 'Migration', value: 64 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } } },
};
export default meta;

export const Default: StoryObj<ProgressBar> = {};
