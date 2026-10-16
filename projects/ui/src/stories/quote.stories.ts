import type { Meta, StoryObj } from '@storybook/angular';
import { Quote } from '../lib/quote';

const meta: Meta<Quote> = {
  title: 'Components/Quote',
  component: Quote,
  tags: ['puck'],
  parameters: { puck: { category: 'Content', fields: { text: 'textarea' } } },
  args: { text: 'We cut onboarding from two weeks to three days.', author: 'Ada Lovelace', role: 'Head of Growth' },
};
export default meta;

export const Default: StoryObj<Quote> = {};
