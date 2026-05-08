import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notify/rfq")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          console.log("[rfq webhook]", JSON.stringify(body));
          return Response.json({ ok: true, received: body?.rfq_id ?? null });
        } catch (e) {
          console.error("rfq webhook parse error", e);
          return new Response("Bad request", { status: 400 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST a JSON payload" }),
    },
  },
});
