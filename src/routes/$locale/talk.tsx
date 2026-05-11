import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/talk")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("talk.title")} — ${t("common.appName")}` },
        { name: "description", content: t("talk.lead") },
      ],
    };
  },
  component: TalkPage,
});

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(5).max(2000),
});

function TalkPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [tab, setTab] = useState<"ai" | "human">("ai");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setStatus("sending");
    const { error } = await supabase.from("inquiries").insert({ ...parsed.data, locale });
    if (error) {
      setErr(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
      setForm({ name: "", email: "", message: "" });
    }
  }

  return (
    <div className="container-page py-10 max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("talk.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("talk.lead")}</p>

      <div className="mt-6 inline-flex rounded-md border border-border overflow-hidden text-sm">
        <button
          onClick={() => setTab("ai")}
          className={`px-4 py-2 ${tab === "ai" ? "bg-foreground text-background" : "bg-card hover:bg-accent"}`}
        >
          {t("talk.tabAi")}
        </button>
        <button
          onClick={() => setTab("human")}
          className={`px-4 py-2 ${tab === "human" ? "bg-foreground text-background" : "bg-card hover:bg-accent"}`}
        >
          {t("talk.tabHuman")}
        </button>
      </div>

      {tab === "ai" ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {locale === "sv"
              ? "Vår AI-ingenjör finns i Projekt-vyn. Beskriv vad du vill göra så får du Bästa + Billigaste lösning."
              : "Our AI engineer lives in the Project view. Describe what you want and get a Best + Cheapest solution."}
          </p>
          <Link
            to="/$locale/project"
            params={{ locale }}
            className="mt-4 inline-block text-sm rounded-md bg-primary text-primary-foreground px-4 py-2"
          >
            {locale === "sv" ? "Öppna Projekt" : "Open Project"} →
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 space-y-3">
          {status === "sent" ? (
            <p className="text-sm text-foreground">{t("talk.sent")}</p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="text-muted-foreground">{t("talk.name")}</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={100}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">{t("talk.email")}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={255}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">{t("talk.message")}</span>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  maxLength={2000}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </label>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <button
                onClick={submit}
                disabled={status === "sending"}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
              >
                {status === "sending" ? t("common.loading") : t("talk.submit")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
