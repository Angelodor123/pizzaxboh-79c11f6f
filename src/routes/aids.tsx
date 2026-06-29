import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/aids")({
  head: () => ({
    meta: [
      { title: 'Pizza X' },
      { name: "description", content: 'Pizza X' },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/aids" }],
  }),
  component: () => <Outlet />,
});
