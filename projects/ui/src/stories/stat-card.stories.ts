import type { Meta, StoryObj } from '@storybook/angular';
import { StatCard } from '../lib/stat-card';

const meta: Meta<StatCard> = {
  title: 'Components/StatCard',
  component: StatCard,
  args: { label: 'Monthly active users', value: '48,210', delta: '12% vs last month', trend: 'up' },
  argTypes: { trend: { control: 'radio', options: ['up', 'down', 'flat'] } },
};
export default meta;

export const Up: StoryObj<StatCard> = {};
export const Down: StoryObj<StatCard> = { args: { label: 'Churn', value: '2.1%', delta: '0.4pp', trend: 'down' } };
