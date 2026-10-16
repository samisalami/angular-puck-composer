import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Alert, Avatar, Card, Heading, Navbar, ProgressBar, StatCard, TextBlock } from '../public-api';

/** Storybook's built-in way to compose a page: an Angular template. Baseline for the Puck composer. */
const meta: Meta = {
  title: 'Pages/Dashboard',
  decorators: [moduleMetadata({ imports: [Alert, Avatar, Card, Heading, Navbar, ProgressBar, StatCard, TextBlock] })],
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj = {
  render: () => ({
    template: `
      <ui-navbar brand="Acme" links="Overview, Projects, Reports" ctaLabel="New project" />
      <section class="ui-section"><div class="ui-section__inner ui-stack" style="--ui-gap: 24px">
        <div class="ui-stack ui-stack--row" style="--ui-gap: 12px">
          <ui-avatar name="Ada Lovelace" />
          <div class="ui-stack" style="--ui-gap: 0">
            <ui-heading text="Good morning, Ada" />
            <ui-text text="Here is how the platform is doing this week." [muted]="true" />
          </div>
        </div>
        <div class="ui-grid">
          <ui-stat-card label="Monthly active users" value="48,210" delta="12%" trend="up" />
          <ui-stat-card label="Revenue" value="€312k" delta="4%" trend="up" />
          <ui-stat-card label="Churn" value="2.1%" delta="0.4pp" trend="down" />
        </div>
        <ui-alert tone="warning" title="Billing migration" message="Scheduled for Tuesday, 02:00 UTC." />
      </div></section>
      <section class="ui-section ui-section--surface"><div class="ui-section__inner">
        <div class="ui-grid" style="--ui-cols: 2">
          <ui-card title="Self-service onboarding" badge="On track" badgeTone="success" footer="Owner: Growth">
            <ui-progress-bar label="Progress" [value]="72" />
          </ui-card>
          <ui-card title="SSO for enterprise" badge="At risk" badgeTone="warning" footer="Owner: Platform">
            <ui-progress-bar label="Progress" [value]="35" />
          </ui-card>
        </div>
      </div></section>`,
  }),
};
