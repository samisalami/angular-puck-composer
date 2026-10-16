import type { Meta, StoryObj } from '@storybook/angular';
import { Alert } from '../lib/alert';

const meta: Meta<Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['puck'],
  parameters: { puck: { category: 'Data & feedback', fields: { message: 'textarea' } } },
  args: { title: 'Heads up', message: 'Billing migration is scheduled for next Tuesday.', tone: 'info' },
  argTypes: { tone: { control: 'select', options: ['info', 'success', 'warning', 'danger'] } },
};
export default meta;

export const Info: StoryObj<Alert> = {};
export const Warning: StoryObj<Alert> = { args: { tone: 'warning', title: 'At risk' } };
