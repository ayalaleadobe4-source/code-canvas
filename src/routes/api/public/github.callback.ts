import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  exchangeCodeForToken,
  saveGithubConnection,
  verifyOAuthState,
} from "@/lib/github.server";

export const Route = createFileRoute("/api/public/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }
        const userId = verifyOAuthState(state);
        if (!userId) return new Response("Invalid or expired state", { status: 400 });

        try {
          const { access_token, scope } = await exchangeCodeForToken(code);
          await saveGithubConnection(userId, access_token, scope);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "OAuth failed";
          return new Response(`OAuth error: ${msg}`, { status: 500 });
        }
        // Redirect back to projects page
        throw redirect({ to: "/projects" });
      },
    },
  },
});
