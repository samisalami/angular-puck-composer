import type { Meta, StoryObj } from '@storybook/angular';
import { Navbar } from '../lib/navbar';

const meta: Meta<Navbar> = {
  title: 'Components/Navbar',
  component: Navbar,
  tags: ['puck'],
  args: { brand: 'Acme', links: 'Product, Pricing, Customers, Docs', ctaLabel: 'Sign in' },
  parameters: {
    layout: 'fullscreen',
    puck: { category: 'Marketing' },
  },
};
export default meta;

export const Default: StoryObj<Navbar> = {};
