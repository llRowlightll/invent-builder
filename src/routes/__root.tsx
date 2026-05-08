import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
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
      { title: "LifeMap Industrial — AI-assisted automation configurator" },
      {
        name: "description",
        content:
          "Specify, validate and order Festo, SMC and Siemens automation in minutes. AI-assisted configurator with live validation, BOM and RFQ.",
      },
      { property: "og:title", content: "LifeMap Industrial — AI-assisted automation configurator" },
      { property: "og:description", content: "LifeMap Industrial configures industrial automation solutions, offering AI-assisted guidance and detailed BOM generation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "LifeMap Industrial — AI-assisted automation configurator" },
      { name: "description", content: "LifeMap Industrial configures industrial automation solutions, offering AI-assisted guidance and detailed BOM generation." },
      { name: "twitter:description", content: "LifeMap Industrial configures industrial automation solutions, offering AI-assisted guidance and detailed BOM generation." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1eaae4f3-ecb8-4e1b-96fd-2849b2ab6cdf/id-preview-d4853098--ae6719bd-ffb9-4394-a6e2-06c384006cc8.lovable.app-1778232851462.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1eaae4f3-ecb8-4e1b-96fd-2849b2ab6cdf/id-preview-d4853098--ae6719bd-ffb9-4394-a6e2-06c384006cc8.lovable.app-1778232851462.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Best-effort SSR lang from URL
  const lang = DEFAULT_LOCALE;
  return (
    <html lang={lang} suppressHydrationWarning>
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

function LangSync() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const seg = path.split("/")[1];
  const lang = isLocale(seg) ? seg : DEFAULT_LOCALE;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LangSync />
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
