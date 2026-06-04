import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/aids")({
  head: () => ({
    meta: [
      { title: "עזרים — ספרייה דיגיטלית" },
      { name: "description", content: "ספרייה דיגיטלית: ספקים, מתכונים, ניקיון ואנשי קשר." },
    ],
  }),
  component: () => <Outlet />,
});
