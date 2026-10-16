import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Card } from '../lib/card';
import { ProgressBar } from '../lib/progress-bar';

const meta: Meta<Card> = {
  title: 'Components/Card',
  component: Card,
  decorators: [moduleMetadata({ imports: [ProgressBar] })],
  args: {
    title: 'Self-service onboarding',
    body: 'Cut time-to-value from 14 days to 3 by guiding new accounts through setup.',
    badge: 'Q3',
    badgeTone: 'info',
    footer: 'Owner: Growth team',
  },
  argTypes: { badgeTone: { control: 'select', options: ['neutral', 'success', 'warning', 'danger', 'info'] } },
};
export default meta;

export const Default: StoryObj<Card> = {};

/** Content projection via <ng-content>. */
export const WithProjectedContent: StoryObj<Card> = {
  render: (args) => ({
    props: args,
    template: `
      <ui-card [title]="title" [badge]="badge" [badgeTone]="badgeTone" [footer]="footer">
        <ui-progress-bar label="Progress" [value]="72" />
      </ui-card>`,
  }),
};
