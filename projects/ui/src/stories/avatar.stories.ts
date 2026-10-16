import type { Meta, StoryObj } from '@storybook/angular';
import { Avatar } from '../lib/avatar';

const meta: Meta<Avatar> = {
  title: 'Components/Avatar',
  component: Avatar,
  args: { name: 'Ada Lovelace', size: 40 },
  argTypes: { size: { control: { type: 'range', min: 24, max: 96, step: 4 } } },
};
export default meta;

export const Default: StoryObj<Avatar> = {};
