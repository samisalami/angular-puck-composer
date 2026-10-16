import type { Meta, StoryObj } from '@storybook/angular';
import { Badge } from '../lib/badge';

const meta: Meta<Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: { label: 'Beta', tone: 'info' },
  argTypes: { tone: { control: 'select', options: ['neutral', 'success', 'warning', 'danger', 'info'] } },
};
export default meta;

export const Default: StoryObj<Badge> = {};
export const Success: StoryObj<Badge> = { args: { label: 'Live', tone: 'success' } };
