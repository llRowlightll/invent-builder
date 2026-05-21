import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/new")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("newPage.title")} — ${t("common.appName")}` },
        { name: "description", content: "Senaste nytt från Festo, SMC, Parker, Bosch Rexroth, Norgren och Metal Work — produktnyheter, tekniska uppdateringar och inspiration." },
      ],
    };
  },
  component: NewPage,
});

// ─── Curated brand news ───────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  brand: string;
  brandSlug: string;
  brandColor: string;
  date: string;
  category: "Produktnyhet" | "Teknik" | "Programvara" | "Hållbarhet";
  title: string;
  summary: string;
  url: string;
  tags: string[];
}

const NEWS: NewsItem[] = [
  {
    id: "festo-emmt-2025",
    brand: "Festo",
    brandSlug: "festo",
    brandColor: "#0091DC",
    date: "2025-03",
    category: "Produktnyhet",
    title: "EMMT-AS — kompakt elektrisk axel med integrerad controller",
    summary: "Festos EMMT-AS kombinerar servomotor, drivsteg och positionsgivare i en enhet. Perfekt för pick & place-applikationer som kräver exakt styrning utan separat skåp. Finns i storlekar 28–58 mm flänsfäste.",
    url: "https://www.festo.com/se/sv/e/produkter/elektrisk-automation/elektriska-axlar/",
    tags: ["elektrisk axel", "servomotor", "pick-and-place"],
  },
  {
    id: "festo-vtux-2025",
    brand: "Festo",
    brandSlug: "festo",
    brandColor: "#0091DC",
    date: "2025-01",
    category: "Produktnyhet",
    title: "VTUX-EM ventilterminal med EtherNet/IP och PROFINET",
    summary: "Den nya VTUX-ventilterminalen stöder EtherNet/IP, PROFINET och IO-Link. Modulär design möjliggör upp till 32 ventilplatser per terminal. Upp till IP65/67-skydd och -10 till +60 °C driftstemperatur.",
    url: "https://www.festo.com/se/sv/e/produkter/ventilar-och-ventilterminaler/ventilterminaler/",
    tags: ["ventilterminal", "EtherNet/IP", "PROFINET", "IO-Link"],
  },
  {
    id: "smc-zp3-2025",
    brand: "SMC",
    brandSlug: "smc",
    brandColor: "#E60012",
    date: "2025-02",
    category: "Produktnyhet",
    title: "ZP3-TB vakuumpadserien för elektriska drivsystem",
    summary: "SMC:s ZP3-TB-serie är designad för modern elektrisk automation. Reducerar tryckluftskonsumtionen med upp till 80 % jämfört med traditionella pneumatiska system. Finns med M8-anslutning och integrerad sensor.",
    url: "https://www.smc.eu/en-eu/products/vacuum-pads~ZP3-TB",
    tags: ["vakuum", "elektrisk automation", "energibesparing"],
  },
  {
    id: "smc-vqc-iolink-2025",
    brand: "SMC",
    brandSlug: "smc",
    brandColor: "#E60012",
    date: "2024-11",
    category: "Teknik",
    title: "VQC-seriens ventiler nu med IO-Link 1.1",
    summary: "SMC:s populära VQC 4/5-vägsventiler uppgraderas med IO-Link 1.1-stöd. Möjliggör parameterstyrning, diagnostik och cykeltalsövervakning direkt från PLC:n. Kompatibel med befintliga VQC-manifold.",
    url: "https://www.smc.eu/en-eu/products/solenoid-valves~VQC",
    tags: ["ventil", "IO-Link", "diagnostik"],
  },
  {
    id: "parker-p1d-smart-2025",
    brand: "Parker",
    brandSlug: "parker",
    brandColor: "#FFCC00",
    date: "2025-01",
    category: "Produktnyhet",
    title: "Parker P1D Series — smart-cylinder med inbyggd positionsgivare",
    summary: "Parker utökar P1D ISO 15552-serien med smart sensor-alternativ. Magnetbaserad positionsgivare med CANopen-interface möjliggör exakt positionsstyrning utan extern givare. Slag 25–2000 mm, borr 32–125 mm.",
    url: "https://www.parker.com/",
    tags: ["cylinder", "smart sensor", "CANopen", "ISO 15552"],
  },
  {
    id: "bosch-ctrlx-2024",
    brand: "Bosch Rexroth",
    brandSlug: "bosch-rexroth",
    brandColor: "#E2001A",
    date: "2024-10",
    category: "Teknik",
    title: "ctrlX DRIVE — skåpsfritt drivsystem för moderna maskiner",
    summary: "Bosch Rexroths ctrlX DRIVE monteras direkt på motorn och eliminerar behovet av separat elskåp. App-baserad mjukvara via ctrlX OS, stöd för EtherCAT och PROFINET. Reducerar installationsutrymmet med upp till 50 %.",
    url: "https://www.boschrexroth.com/en/xc/products/product-groups/electric-drives-and-controls/drive-systems/ctrlx-drive",
    tags: ["drivsystem", "EtherCAT", "skåpsfritt", "ctrlX OS"],
  },
  {
    id: "norgren-v60-2025",
    brand: "Norgren",
    brandSlug: "norgren",
    brandColor: "#0033A0",
    date: "2025-02",
    category: "Produktnyhet",
    title: "Norgren V60-serien — kompakta 5/2-ventiler för tuffa miljöer",
    summary: "V60-serien riktar sig till livsmedels- och fordonsindustrin. IP67-skyddad, temperaturbeständig till +70 °C och tillverkad i korrosionsskyddad aluminium. Flöde upp till 760 Nl/min vid 6 bar.",
    url: "https://www.norgren.com/en/products/valves/directional-control-valves/v60-series",
    tags: ["ventil", "IP67", "livsmedel", "fordon"],
  },
  {
    id: "metalwork-55-2024",
    brand: "Metal Work",
    brandSlug: "metalwork",
    brandColor: "#C8102E",
    date: "2024-12",
    category: "Produktnyhet",
    title: "Metal Work Serie 55 — ultrakompakta cylindrar för trånga utrymmen",
    summary: "Serie 55 är Metal Works svar på ökande krav på kompakt design. ISO 21287-cylindrar med borr 12–63 mm och slag upp till 200 mm. Dubbelverkande med magnetkolv som standard, inbyggt stötdämpning tillval.",
    url: "https://www.metalwork.it/",
    tags: ["cylinder", "kompakt", "ISO 21287"],
  },
  {
    id: "metalwork-multifix-2025",
    brand: "Metal Work",
    brandSlug: "metalwork",
    brandColor: "#C8102E",
    date: "2025-01",
    category: "Produktnyhet",
    title: "Multifix ventilärer med Ethernet-anslutning",
    summary: "Metal Works Multifix-ventilö uppdateras med EtherNet/IP och Modbus TCP. Upp till 24 ventilstationer per enhet, integrerat trycktransducerkort och diagnostikfunktioner via webgränssnitt.",
    url: "https://www.metalwork.it/",
    tags: ["ventilö", "EtherNet/IP", "Modbus TCP"],
  },
];

// ─── Curated brand videos (embeddable) ───────────────────────────────────────

interface VideoItem {
  id: string;
  brand: string;
  brandSlug: string;
  brandColor: string;
  videoId: string;           // YouTube video ID
  channelUrl: string;        // Fallback channel link
  title: string;
  description: string;
}

const VIDEOS: VideoItem[] = [
  {
    id: "festo-bionic-cobot",
    brand: "Festo",
    brandSlug: "festo",
    brandColor: "#0091DC",
    videoId: "-xvOvYwEmww",
    channelUrl: "https://www.youtube.com/@FestoCorporate",
    title: "Festo — Inspiration från naturen",
    description: "Se hur Festo kombinerar bioinspirerad teknik med industriell automation för framtidens smarta fabriker.",
  },
  {
    id: "bosch-ctrlx-video",
    brand: "Bosch Rexroth",
    brandSlug: "bosch-rexroth",
    brandColor: "#E2001A",
    videoId: "Ax8Mb1wJL7g",
    channelUrl: "https://www.youtube.com/@BoschRexroth",
    title: "ctrlX AUTOMATION Platform",
    description: "Introduktion till ctrlX AUTOMATION — det öppna app-baserade systemet som förenklar maskinautomation med EtherCAT och skåpsfria lösningar.",
  },
  {
    id: "smc-automation-video",
    brand: "SMC",
    brandSlug: "smc",
    brandColor: "#E60012",
    videoId: "TyIvHXepGzo",
    channelUrl: "https://www.youtube.com/@SMCCorporationEurope",
    title: "SMC Automation Solutions",
    description: "Teknisk översikt av SMC:s pneumatiska och elektriska komponenter — cylindrar, ventiler, vakuumsystem och IO-Link-lösningar.",
  },
  {
    id: "parker-motion-video",
    brand: "Parker",
    brandSlug: "parker",
    brandColor: "#FFCC00",
    videoId: "Y7l18VJW6QE",
    channelUrl: "https://www.youtube.com/@ParkerHannifin",
    title: "Parker Motion & Control",
    description: "Parker Hannifins bredaste utbud av rörelsesstyrning — hydraulik, pneumatik och elektriska aktuatorer för industriell automation.",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Produktnyhet": "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  "Teknik":       "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300",
  "Programvara":  "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  "Hållbarhet":   "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
};

// ─── Lazy-load YouTube embed ──────────────────────────────────────────────────

function VideoCard({ video }: { video: VideoItem }) {
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
          /* Fallback when thumbnail can't load */
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
            <span className="text-sm text-muted-foreground">Öppna på YouTube →</span>
          </a>
        ) : (
          /* Thumbnail with play button overlay */
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group cursor-pointer"
            aria-label={`Spela upp: ${video.title}`}
          >
            <img
              src={thumbUrl}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
            {/* Dark overlay on hover */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition" />
            {/* Play button */}
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
          Se hela YouTube-kanalen →
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

  const brands = Array.from(new Set(NEWS.map((n) => n.brand)));
  const filtered = brandFilter ? NEWS.filter((n) => n.brand === brandFilter) : NEWS;

  return (
    <div className="container-page py-10 max-w-6xl">

      {/* ── Header ── */}
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-info font-medium mb-1">
          BRANSCHNYHETER & INSPIRATION
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Nyheter från branschen</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Senaste produktlanseringar, tekniska uppdateringar och inspirationsvideor från Festo, SMC, Parker, Bosch Rexroth, Norgren och Metal Work.
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
          Alla varumärken
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? ""}`}>
                  {item.category}
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
                  Läs mer hos {item.brand} →
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
              <h2 className="font-semibold">Inspiration & Utbildning</h2>
              <p className="text-xs text-muted-foreground">Klicka för att spela upp — videor från leverantörernas officiella YouTube-kanaler</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {VIDEOS.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </div>
      )}

      {/* ── CTA row ── */}
      <div className="rounded-xl border border-border bg-surface-alt/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Hittar du inte det du söker?</div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vår AI-ingenjör hjälper dig välja rätt komponent baserat på dina krav.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/$locale/products"
            params={{ locale: locale as Locale }}
            className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            Bläddra katalogen
          </Link>
          <Link
            to="/$locale/chat"
            params={{ locale: locale as Locale }}
            className="px-4 py-2 rounded-md border border-border text-sm hover:border-info hover:text-info transition"
          >
            ✦ AI-ingenjören
          </Link>
        </div>
      </div>
    </div>
  );
}
