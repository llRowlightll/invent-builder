import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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

function ProjectsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track which SKUs have been added to the offert list in this session
  const [addedSkus, setAddedSkus] = useState<Set<string>>(new Set());
  const addedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
      // sessionStorage kan vara blockerat i privat läge
    }
    navigate({ to: "/$locale/machine-builder" as never, params: { locale } as never });
  }

  function addLineToOffert(line: BomLineSaved) {
    addToShoppingList({ id: line.sku, sku: line.sku, name: line.role || line.sku });
    setAddedSkus((prev) => new Set(prev).add(line.sku));
    if (addedTimers.current[line.sku]) clearTimeout(addedTimers.current[line.sku]);
    addedTimers.current[line.sku] = setTimeout(() => {
      setAddedSkus((prev) => { const s = new Set(prev); s.delete(line.sku); return s; });
    }, 2000);
  }

  function addAllToOffert(lines: BomLineSaved[]) {
    lines.forEach((l) => addLineToOffert(l));
  }

  if (!user) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-muted-foreground mb-4">{t("projects.notLoggedIn")}</p>
        <Link to="/$locale/login" params={{ locale }}
          className="btn-primary px-6 py-2 rounded-md text-sm font-medium">
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
        <Link to="/$locale/machine-builder" params={{ locale }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">
          ✦ {t("nav.machineBuilder")}
        </Link>
      </div>

      {/* Portal tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {[
          { to: "/$locale/projects", label: t("projects.title") },
          { to: "/$locale/orders",   label: t("ordersPage.myOrders") },
          { to: "/$locale/profile",  label: t("profilePage.title") },
        ].map((tab) => (
          <Link key={tab.to} to={tab.to as never} params={{ locale } as never}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            activeProps={{ className: "border-primary text-foreground" }}
            inactiveProps={{ className: "border-transparent text-muted-foreground hover:text-foreground" }}>
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Project list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">📐</div>
          <p className="text-muted-foreground text-sm">{t("projects.empty")}</p>
          <Link to="/$locale/machine-builder" params={{ locale }}
            className="mt-4 inline-block text-sm text-primary hover:underline">
            ✦ {t("nav.machineBuilder")} →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const lines = Array.isArray(project.bom_lines) ? project.bom_lines : [];
            const totalPrice = lines.reduce((sum, l) => sum + (l.unit_price ?? 0) * (l.qty ?? 1), 0);
            const isExpanded = expandedId === project.id;

            return (
              <div key={project.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition">
                {/* Header row */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{project.name}</span>
                        <span className="text-xs text-muted-foreground">{lines.length} {t("projects.bomLines")}</span>
                        {totalPrice > 0 && (
                          <span className="text-xs font-medium text-primary">~{totalPrice.toLocaleString("sv-SE")} kr</span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{project.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("projects.createdAt")}{" "}
                        {new Date(project.updated_at).toLocaleDateString(locale === "sv" ? "sv-SE" : locale, {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Expand BOM */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : project.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
                      >
                        {isExpanded ? "▲ Dölj" : `▼ Produkter (${lines.length})`}
                      </button>
                      <button
                        onClick={() => openProject(project)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                      >
                        {t("projects.loadProject")}
                      </button>
                      <button
                        onClick={() => deleteProject(project.id)}
                        disabled={deleting === project.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition disabled:opacity-40"
                      >
                        {deleting === project.id ? "..." : t("projects.deleteProject")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable BOM panel */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 px-5 py-4">
                    {lines.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-4">
                          {lines.map((line, i) => {
                            const added = addedSkus.has(line.sku);
                            return (
                              <div key={i} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xs text-muted-foreground shrink-0 w-6 text-right">{line.qty}×</span>
                                  <div className="min-w-0">
                                    <Link
                                      to="/$locale/product/$sku"
                                      params={{ locale, sku: line.sku } as never}
                                      className="font-mono text-xs text-info hover:underline block"
                                    >
                                      {line.sku}
                                    </Link>
                                    <span className="text-xs text-muted-foreground truncate block">{line.role}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => addLineToOffert(line)}
                                  className={`shrink-0 text-xs px-3 py-1 rounded-md font-medium transition ${
                                    added
                                      ? "bg-[oklch(0.55_0.15_155)]/15 text-[oklch(0.45_0.15_155)]"
                                      : "border border-border hover:border-info hover:text-info text-muted-foreground"
                                  }`}
                                >
                                  {added ? "✓ Tillagd" : "+ Offert"}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            onClick={() => addAllToOffert(lines)}
                            className="text-xs px-3 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 transition font-medium"
                          >
                            📋 Lägg till alla i offert
                          </button>
                          <Link
                            to="/$locale/products"
                            params={{ locale }}
                            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
                          >
                            + Lägg till fler från katalog →
                          </Link>
                        </div>
                      </>
                    ) : (
                      /* Empty BOM — guide user to catalog */
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">Inga produkter i det här projektet ännu.</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            onClick={() => openProject(project)}
                            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                          >
                            ✦ Bygg med AI-verktyget
                          </button>
                          <Link
                            to="/$locale/products"
                            params={{ locale }}
                            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
                          >
                            Bläddra i katalogen →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
