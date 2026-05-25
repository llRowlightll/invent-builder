import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { addToShoppingList } from "@/lib/cart";

export const Route = createFileRoute("/$locale/projects")({
  head: () => ({
    meta: [
      { title: "Mina projekt — Maskinval" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  locale: string;
  answers: Record<string, string>;
  bom_lines: BomLineSaved[];
  created_at: string;
  updated_at: string;
}

interface BomLineSaved {
  sku: string;
  role: string;
  qty: number;
  unit_price?: number;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    picking: "bg-yellow-100 text-yellow-700",
    shipped: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    invoiced: "bg-orange-100 text-orange-700",
    paid: "bg-green-200 text-green-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function ProjectsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setProjects((data as ProjectRow[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  async function deleteProject(id: string) {
    if (!window.confirm(t("projects.confirmDelete"))) return;
    setDeleting(id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  function openProject(project: ProjectRow) {
    // Spara projektdata i sessionStorage — machine-builder läser det vid mount
    try {
      sessionStorage.setItem("mv_load_project", JSON.stringify({
        id: project.id,
        name: project.name,
        description: project.description,
        answers: project.answers,
        bom_lines: project.bom_lines,
        locale: project.locale,
      }));
    } catch {
      // sessionStorage kan vara blockerat i privat läge — ignorera
    }
    navigate({
      to: "/$locale/machine-builder" as never,
      params: { locale } as never,
    });
  }

  if (!user) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-muted-foreground mb-4">{t("projects.notLoggedIn")}</p>
        <Link
          to="/$locale/login"
          params={{ locale }}
          className="btn-primary px-6 py-2 rounded-md text-sm font-medium"
        >
          {t("auth.submitLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("projects.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("projects.subtitle")}</p>
        </div>
        <Link
          to="/$locale/machine-builder"
          params={{ locale }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
        >
          ✦ {t("nav.machineBuilder")}
        </Link>
      </div>

      {/* Portal tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {[
          { to: "/$locale/projects", label: t("projects.title") },
          { to: "/$locale/orders", label: t("ordersPage.myOrders") },
          { to: "/$locale/profile", label: t("profilePage.title") },
        ].map((tab) => (
          <Link
            key={tab.to}
            to={tab.to as never}
            params={{ locale } as never}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            activeProps={{ className: "border-primary text-foreground" }}
            inactiveProps={{ className: "border-transparent text-muted-foreground hover:text-foreground" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Project list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">📐</div>
          <p className="text-muted-foreground text-sm">{t("projects.empty")}</p>
          <Link
            to="/$locale/machine-builder"
            params={{ locale }}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            ✦ {t("nav.machineBuilder")} →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const lines = Array.isArray(project.bom_lines) ? project.bom_lines : [];
            const totalPrice = lines.reduce(
              (sum, l) => sum + (l.unit_price ?? 0) * (l.qty ?? 1),
              0
            );
            return (
              <div
                key={project.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {lines.length} {t("projects.bomLines")}
                    </span>
                    {totalPrice > 0 && (
                      <span className="text-xs font-medium text-primary">
                        ~{totalPrice.toLocaleString("sv-SE")} kr
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{project.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("projects.createdAt")}{" "}
                    {new Date(project.updated_at).toLocaleDateString(locale === "sv" ? "sv-SE" : locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openProject(project)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                  >
                    {t("projects.loadProject")}
                  </button>
                  {lines.length > 0 && (
                    <button
                      onClick={() => {
                        lines.forEach((l) => addToShoppingList({ id: l.sku, sku: l.sku, name: l.role || l.sku }));
                        navigate({ to: "/$locale/contact", params: { locale } as never });
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:border-info hover:text-info transition"
                    >
                      📋 {t("productPage.requestQuote")}
                    </button>
                  )}
                  <button
                    onClick={() => deleteProject(project.id)}
                    disabled={deleting === project.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition disabled:opacity-40"
                  >
                    {deleting === project.id ? "..." : t("projects.deleteProject")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
