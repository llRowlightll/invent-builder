import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/new")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("newPage.title")} — ${t("common.appName")}` },
        { name: "description", content: t("newPage.subheading") },
      ],
    };
  },
  component: NewPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryKey = "product" | "tech" | "software" | "sustain";

interface NewsItem {
  id: string;
  brand: string;
  brandSlug: string;
  brandColor: string;
  date: string;
  categoryKey: CategoryKey;
  title: string;
  summary: string;
  url: string;
  tags: string[];
}

interface VideoItem {
  id: string;
  brand: string;
  brandSlug: string;
  brandColor: string;
  videoId: string;
  channelUrl: string;
  title: string;
  description: string;
}

// ─── Locale-aware data builders ───────────────────────────────────────────────

function makeNews(t: ReturnType<typeof makeT>): NewsItem[] {
  return [
    {
      id: "festo-emmt-2025",
      brand: "Festo",
      brandSlug: "festo",
      brandColor: "#0091DC",
      date: "2025-03",
      categoryKey: "product",
      title: t("newPage.n_festo_emmt_title"),
      summary: t("newPage.n_festo_emmt_summary"),
      url: "https://www.festo.com/se/sv/e/produkter/elektrisk-automation/elektriska-axlar/",
      tags: ["elektrisk axel", "servomotor", "pick-and-place"],
    },
    {
      id: "festo-vtux-2025",
      brand: "Festo",
      brandSlug: "festo",
      brandColor: "#0091DC",
      date: "2025-01",
      categoryKey: "product",
      title: t("newPage.n_festo_vtux_title"),
      summary: t("newPage.n_festo_vtux_summary"),
      url: "https://www.festo.com/se/sv/e/produkter/ventilar-och-ventilterminaler/ventilterminaler/",
      tags: ["ventilterminal", "EtherNet/IP", "PROFINET", "IO-Link"],
    },
    {
      id: "smc-zp3-2025",
      brand: "SMC",
      brandSlug: "smc",
      brandColor: "#E60012",
      date: "2025-02",
      categoryKey: "product",
      title: t("newPage.n_smc_zp3_title"),
      summary: t("newPage.n_smc_zp3_summary"),
      url: "https://www.smc.eu/en-eu/products/vacuum-pads~ZP3-TB",
      tags: ["vakuum", "elektrisk automation", "energibesparing"],
    },
    {
      id: "smc-vqc-iolink-2025",
      brand: "SMC",
      brandSlug: "smc",
      brandColor: "#E60012",
      date: "2024-11",
      categoryKey: "tech",
      title: t("newPage.n_smc_vqc_title"),
      summary: t("newPage.n_smc_vqc_summary"),
      url: "https://www.smc.eu/en-eu/products/solenoid-valves~VQC",
      tags: ["ventil", "IO-Link", "diagnostik"],
    },
    {
      id: "parker-p1d-smart-2025",
      brand: "Parker",
      brandSlug: "parker",
      brandColor: "#FFCC00",
      date: "2025-01",
      categoryKey: "product",
      title: t("newPage.n_parker_title"),
      summary: t("newPage.n_parker_summary"),
      url: "https://www.parker.com/",
      tags: ["cylinder", "smart sensor", "CANopen", "ISO 15552"],
    },
    {
      id: "bosch-ctrlx-2024",
      brand: "Bosch Rexroth",
      brandSlug: "bosch-rexroth",
      brandColor: "#E2001A",
      date: "2024-10",
      categoryKey: "tech",
      title: t("newPage.n_bosch_title"),
      summary: t("newPage.n_bosch_summary"),
      url: "https://www.boschrexroth.com/en/xc/products/product-groups/electric-drives-and-controls/drive-systems/ctrlx-drive",
      tags: ["drivsystem", "EtherCAT", "skåpsfritt", "ctrlX OS"],
    },
    {
      id: "norgren-v60-2025",
      brand: "Norgren",
      brandSlug: "norgren",
      brandColor: "#0033A0",
      date: "2025-02",
      categoryKey: "product",
      title: t("newPage.n_norgren_title"),
      summary: t("newPage.n_norgren_summary"),
      url: "https://www.norgren.com/en/products/valves/directional-control-valves/v60-series",
      tags: ["ventil", "IP67", "livsmedel", "fordon"],
    },
    {
      id: "metalwork-55-2024",
      brand: "Metal Work",
      brandSlug: "metalwork",
      brandColor: "#C8102E",
      date: "2024-12",
      categoryKey: "product",
      title: t("newPage.n_mw55_title"),
      summary: t("newPage.n_mw55_summary"),
      url: "https://www.metalwork.it/",
      tags: ["cylinder", "kompakt", "ISO 21287"],
    },
    {
      id: "metalwork-multifix-2025",
      brand: "Metal Work",
      brandSlug: "metalwork",
      brandColor: "#C8102E",
      date: "2025-01",
      categoryKey: "product",
      title: t("newPage.n_mwfix_title"),
      summary: t("newPage.n_mwfix_summary"),
      url: "https://www.metalwork.it/",
      tags: ["ventilö", "EtherNet/IP", "Modbus TCP"],
    },
  ];
}

function makeVideos(t: ReturnType<typeof makeT>): VideoItem[] {
  return [
    {
      id: "festo-bionic-cobot",
      brand: "Festo",
      brandSlug: "festo",
      brandColor: "#0091DC",
      videoId: "-xvOvYwEmww",
      channelUrl: "https://www.youtube.com/@FestoCorporate",
      title: t("newPage.v_festo_title"),
      description: t("newPage.v_festo_desc"),
    },
    {
      id: "bosch-ctrlx-video",
      brand: "Bosch Rexroth",
      brandSlug: "bosch-rexroth",
      brandColor: "#E2001A",
      videoId: "VTaMxdigNS0",
      channelUrl: "https://www.youtube.com/@BoschRexroth",
      title: "ctrlX AUTOMATION Platform",
      description: t("newPage.v_bosch_desc"),
    },
    {
      id: "smc-automation-video",
      brand: "SMC",
      brandSlug: "smc",
      brandColor: "#E60012",
      videoId: "cdox64vJwQI",
      channelUrl: "https://www.youtube.com/@SMCCorporationEurope",
      title: t("newPage.v_smc_title"),
      description: t("newPage.v_smc_desc"),
    },
    {
      id: "parker-motion-video",
      brand: "Parker",
      brandSlug: "parker",
      brandColor: "#FFCC00",
      videoId: "rbPMKgHF8dM",
      channelUrl: "https://www.youtube.com/@ParkerHannifin",
      title: "Parker Motion & Control",
      description: t("newPage.v_parker_desc"),
    },
    {
      id: "metalwork-video",
      brand: "Metal Work",
      brandSlug: "metal-work",
      brandColor: "#E30613",
      videoId: "PzCRMB6U_Rg",
      channelUrl: "https://www.youtube.com/@MetalWorkPneumatic",
      title: "Metal Work Pneumatic",
      description: t("newPage.v_mw_desc"),
    },
  ];
}

// ─── Category helpers ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  product:  "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  tech:     "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300",
  software: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  sustain:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
};

function categoryLabel(key: CategoryKey, t: ReturnType<typeof makeT>): string {
  const map: Record<CategoryKey, string> = {
    product:  t("newPage.catProduct"),
    tech:     t("newPage.catTech"),
    software: t("newPage.catSoftware"),
    sustain:  t("newPage.catSustain"),
  };
  return map[key];
}

// ─── Lazy-load YouTube embed ──────────────────────────────────────────────────

function VideoCard({ video, t }: { video: VideoItem; t: ReturnType<typeof makeT> }) {
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const thumbUrl = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Video area */}
      <div className="relative aspect-video bg-muted">
        {playing ? (
          <iframe
            src={embedUrl}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : thumbError ? (
          <a
            href={video.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted hover:bg-muted/80 transition"
          >
            <div className="size-14 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white ml-1" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">{t("newPage.openOnYoutube")}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group cursor-pointer"
            aria-label={`${t("newPage.playLabel")}: ${video.title}`}
          >
            <img
              src={thumbUrl}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-16 rounded-full bg-destructive shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white ml-1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </button>
        )}

        {/* Brand color stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: video.brandColor }}
        />
      </div>

      {/* Card info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-2">
          <img
            src={`/brands/${video.brandSlug}.svg`}
            alt={video.brand}
            className="h-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-xs font-semibold text-muted-foreground">{video.brand}</span>
        </div>
        <h3 className="font-semibold text-sm leading-snug">{video.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">{video.description}</p>
        <a
          href={video.channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[11px] text-destructive hover:underline font-medium flex items-center gap-1"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4 0-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.8C6.8 19 12 19 12 19s4.8 0 7-.1c.4 0 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM10 15V9l5.5 3-5.5 3z"/>
          </svg>
          {t("newPage.youtubeChannel")}
        </a>
      </div>
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

function NewPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const NEWS   = makeNews(t);
  const VIDEOS = makeVideos(t);

  const brands   = Array.from(new Set(NEWS.map((n) => n.brand)));
  const filtered = brandFilter ? NEWS.filter((n) => n.brand === brandFilter) : NEWS;

  return (
    <div className="container-page py-10 max-w-6xl">

      {/* ── Header ── */}
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-info font-medium mb-1">
          {t("newPage.sectionLabel")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("newPage.heading")}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t("newPage.subheading")}
        </p>
      </div>

      {/* ── Brand filter ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          type="button"
          onClick={() => setBrandFilter(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
            !brandFilter
              ? "bg-info text-primary-foreground border-info"
              : "border-border text-muted-foreground hover:border-info hover:text-info"
          }`}
        >
          {t("newPage.allBrands")}
        </button>
        {brands.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrandFilter(b === brandFilter ? null : b)}
            className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
              brandFilter === b
                ? "bg-info text-primary-foreground border-info"
                : "border-border text-muted-foreground hover:border-info hover:text-info"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* ── News grid ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
        {filtered.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-border bg-card hover:border-info transition flex flex-col overflow-hidden"
          >
            <div className="h-1.5" style={{ backgroundColor: item.brandColor }} />
            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img
                    src={`/brands/${item.brandSlug}.svg`}
                    alt={item.brand}
                    className="h-5 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-xs font-semibold text-muted-foreground">{item.brand}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {item.date.replace("-", "/")}
                </span>
              </div>

              <div className="mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.categoryKey]}`}>
                  {categoryLabel(item.categoryKey, t)}
                </span>
              </div>

              <h2 className="font-semibold text-sm leading-snug group-hover:text-info transition mb-2">
                {item.title}
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                {item.summary}
              </p>

              <div className="mt-3 flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-muted-foreground border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-[11px] text-info font-medium group-hover:underline">
                  {t("newPage.readMore")} {item.brand} →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── YouTube videos section ── */}
      {!brandFilter && (
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-9 rounded-full bg-destructive flex items-center justify-center shadow">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white ml-0.5" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold">{t("newPage.videosHeading")}</h2>
              <p className="text-xs text-muted-foreground">{t("newPage.videosSubhead")}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {VIDEOS.map((v) => (
              <VideoCard key={v.id} video={v} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── CTA row ── */}
      <div className="rounded-xl border border-border bg-surface-alt/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-semibold">{t("newPage.ctaHeading")}</div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("newPage.ctaBody")}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/$locale/products"
            params={{ locale: locale as Locale }}
            className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            {t("newPage.ctaBrowse")}
          </Link>
          <Link
            to="/$locale/chat"
            params={{ locale: locale as Locale }}
            className="px-4 py-2 rounded-md border border-border text-sm hover:border-info hover:text-info transition"
          >
            {t("newPage.ctaAI")}
          </Link>
        </div>
      </div>
    </div>
  );
}
