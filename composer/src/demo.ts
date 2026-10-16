import type { PageData } from "./config";

// Same dashboard as the "Pages/Dashboard" story in Storybook, as Puck data.
let n = 0;
const block = (type: string, props: Record<string, unknown>) => ({ type, props: { id: `${type}-demo-${++n}`, ...props } });

export const demoPage = {
  root: { props: { title: "Demo dashboard", theme: "light" } },
  content: [
    block("Navbar", { brand: "Acme", links: "Overview, Projects, Reports", ctaLabel: "New project" }),
    block("Section", {
      background: "default",
      padding: 48,
      content: [
        block("Stack", {
          direction: "column",
          gap: 24,
          content: [
            block("Stack", {
              direction: "row",
              gap: 12,
              content: [
                block("Avatar", { name: "Ada Lovelace", size: 48 }),
                block("Heading", { text: "Good morning, Ada", level: 2, align: "left" }),
              ],
            }),
            block("Text", { text: "Here is how the platform is doing this week.", size: "md", muted: true }),
            block("Grid", {
              columns: 3,
              gap: 16,
              content: [
                block("StatCard", { label: "Monthly active users", value: "48,210", delta: "12%", trend: "up" }),
                block("StatCard", { label: "Revenue", value: "€312k", delta: "4%", trend: "up" }),
                block("StatCard", { label: "Churn", value: "2.1%", delta: "0.4pp", trend: "down" }),
              ],
            }),
            block("Alert", { title: "Billing migration", message: "Scheduled for Tuesday, 02:00 UTC.", tone: "warning" }),
            block("Button", { label: "Open report", variant: "primary", size: "md" }),
          ],
        }),
      ],
    }),
    block("Section", {
      background: "surface",
      padding: 48,
      content: [
        block("Grid", {
          columns: 2,
          gap: 16,
          content: [
            block("Card", {
              title: "Self-service onboarding", body: "", badge: "On track", badgeTone: "success", footer: "Owner: Growth",
              content: [block("ProgressBar", { label: "Progress", value: 72 })],
            }),
            block("Card", {
              title: "SSO for enterprise", body: "", badge: "At risk", badgeTone: "warning", footer: "Owner: Platform",
              content: [block("ProgressBar", { label: "Progress", value: 35 })],
            }),
          ],
        }),
      ],
    }),
  ],
} as unknown as PageData;
