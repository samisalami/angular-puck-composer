import type { Meta, StoryObj } from '@storybook/angular';
import { Button } from '../lib/button';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['puck'],
  parameters: { puck: { category: 'Content' } },
  args: { label: 'Get started', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    pressed: { action: 'pressed' },
  },
};
export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', label: 'Learn more' } };
export const Ghost: Story = { args: { variant: 'ghost', label: 'Skip' } };
