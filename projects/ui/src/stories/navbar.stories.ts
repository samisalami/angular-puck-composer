import type { Meta, StoryObj } from '@storybook/angular';
import { Navbar } from '../lib/navbar';

const meta: Meta<Navbar> = {
  title: 'Components/Navbar',
  component: Navbar,
  args: { brand: 'Acme', links: 'Product, Pricing, Customers, Docs', ctaLabel: 'Sign in' },
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj<Navbar> = {};
