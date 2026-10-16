import type { Meta, StoryObj } from '@storybook/angular';
import { Heading } from '../lib/heading';

const meta: Meta<Heading> = {
  title: 'Components/Heading',
  component: Heading,
  tags: ['puck'],
  parameters: { puck: { category: 'Content' } },
  args: { text: 'Quarterly roadmap', level: 2, align: 'left' },
  argTypes: {
    level: { control: 'select', options: [1, 2, 3, 4] },
    align: { control: 'radio', options: ['left', 'center', 'right'] },
  },
};
export default meta;

export const Default: StoryObj<Heading> = {};
