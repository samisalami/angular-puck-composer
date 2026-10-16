import type { Meta, StoryObj } from '@storybook/angular';
import { Hero } from '../lib/hero';

const meta: Meta<Hero> = {
  title: 'Components/Hero',
  component: Hero,
  tags: ['puck'],
  parameters: { puck: { category: 'Marketing', fields: { title: 'textarea', subtitle: 'textarea' } } },
  args: {
    eyebrow: 'New in 2027',
    title: 'Ship designs your managers can click',
    subtitle: 'Compose real, production components into pages without a design tool.',
    primaryCta: 'Request demo',
    secondaryCta: 'Read the docs',
  },
  argTypes: { ctaClick: { action: 'ctaClick' } },
};
export default meta;

export const Default: StoryObj<Hero> = {};
