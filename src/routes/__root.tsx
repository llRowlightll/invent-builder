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
import { EditModeProvider } from "@/lib/edit-mode-context";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE } from "@/lib/site";

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
      { title: "Maskinval — Industrial automation, pneumatics & electric actuators" },
      { name: "description", content: "Find the right pneumatic cylinder, electric actuator, valve or gripper — Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work, Camozzi. AI search, comparison and complete BOM in seconds." },
      { property: "og:site_name", content: "Maskinval" },
      { property: "og:title", content: "Maskinval — Industrial automation" },
      { property: "og:description", content: "Search across Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work and Camozzi. AI-driven component selector with BOM and RFQ." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:locale:alternate", content: "sv_SE" },
      { property: "og:locale:alternate", content: "de_DE" },
      { property: "og:locale:alternate", content: "es_ES" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Maskinval — Industrial automation" },
      { name: "twitter:description", content: "AI search for pneumatics and automation. Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work, Camozzi." },
      { name: "theme-color", content: "#1F3864" },
      { property: "og:image", content: `${SITE}/og-image.svg` },
      { name: "twitter:image", content: `${SITE}/og-image.svg` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Favicons — Google Search picks the 48px-multiple PNG; browsers prefer SVG.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48 32x32" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
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

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Maskinval",
  url: SITE,
  logo: `${SITE}/favicon.svg`,
  description: "Industriell automation och pneumatik — AI-driven komponentväljare för maskinbyggare.",
  email: "info@maskinval.se",
  sameAs: [],
};

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EditModeProvider>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
          />
          <LangSync />
          <Outlet />
        </EditModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
