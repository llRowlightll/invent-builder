import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

/**
 * En adress per sida (SEO-granskningen 2026-11-17): http och www skickas med
 * en permanent omdirigering till https://maskinval.se, och "/" till "/sv"
 * (förut en tillfällig 307). Bara för produktionsdomänen; lokalt och på
 * workers.dev händer ingenting.
 */
function kanoniskOmdirigering(request: Request): Response | null {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (host !== "maskinval.se" && host !== "www.maskinval.se") return null;
  let andrad = false;
  if (host === "www.maskinval.se") { url.hostname = "maskinval.se"; andrad = true; }
  // Bara när anslutningen verkligen är okrypterad: Cloudflare sätter
  // cf.tlsVersion för https. Båda villkoren krävs, så att en felaktig
  // protokolluppgift aldrig kan ge en omdirigeringsslinga.
  const tls = (request as Request & { cf?: { tlsVersion?: string } }).cf?.tlsVersion;
  if (url.protocol === "http:" && tls !== undefined && tls === "") { url.protocol = "https:"; andrad = true; }
  if (url.pathname === "/") { url.pathname = "/sv"; andrad = true; }
  if (!andrad) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  return new Response(null, { status: 301, headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" } });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const omdirigering = kanoniskOmdirigering(request);
    if (omdirigering) return omdirigering;
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
