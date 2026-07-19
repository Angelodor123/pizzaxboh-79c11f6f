import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOpenShortages from "./tools/list-open-shortages";
import listPersonalTasks from "./tools/list-personal-tasks";
import createPersonalTask from "./tools/create-personal-task";

// The OAuth issuer must be the direct Supabase host — not the .lovable.cloud
// proxy that SUPABASE_URL becomes on publish. The project ref is inlined by
// Vite at build time via import.meta.env.VITE_SUPABASE_PROJECT_ID.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pizzaxboh-mcp",
  title: "PizzaXBoh",
  version: "0.1.0",
  instructions:
    "Tools for the PizzaXBoh back-of-house app. Use `list_open_shortages` to see missing stock, `list_personal_tasks` to read the signed-in user's tasks, and `create_personal_task` to add one. All tools act as the signed-in user under RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOpenShortages, listPersonalTasks, createPersonalTask],
});
