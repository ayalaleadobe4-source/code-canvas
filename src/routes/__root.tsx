/* KVS_VISUAL_EDITOR_START */
import { useEffect } from "react";
import { initKvsOverlayClient } from "../../.kvs/kvs-overlay-client";
/* KVS_VISUAL_EDITOR_END */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable GitHub Visual Editor" },
      { name: "description", content: "Edit Lovable projects visually and push changes back to GitHub" },
      { property: "og:title", content: "Lovable GitHub Visual Editor" },
      { name: "twitter:title", content: "Lovable GitHub Visual Editor" },
      { property: "og:description", content: "Edit Lovable projects visually and push changes back to GitHub" },
      { name: "twitter:description", content: "Edit Lovable projects visually and push changes back to GitHub" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f79ddb58-15b7-4656-ae4d-8f17dbe349e2/id-preview-80a1c85b--f9756e23-bacf-46f8-8d06-fdad00f55d19.lovable.app-1779729013716.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f79ddb58-15b7-4656-ae4d-8f17dbe349e2/id-preview-80a1c85b--f9756e23-bacf-46f8-8d06-fdad00f55d19.lovable.app-1779729013716.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
        <KvsVisualEditorMount />
      </AuthProvider>
    </QueryClientProvider>
  );
}
/* KVS_VISUAL_EDITOR_START */
function KvsVisualEditorMount() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      initKvsOverlayClient();
    }
  }, []);
  return null;
}
/* KVS_VISUAL_EDITOR_END */

