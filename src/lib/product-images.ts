// SVG-based product category illustrations — always correct, no external dependency

const svgs: Record<string, string> = {
  "cylinder": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- mounting brackets -->
    <rect x="60" y="128" width="18" height="64" rx="3" fill="#475569"/>
    <rect x="402" y="128" width="18" height="64" rx="3" fill="#475569"/>
    <!-- cylinder body -->
    <rect x="78" y="118" width="324" height="84" rx="10" fill="#94a3b8"/>
    <rect x="78" y="118" width="324" height="84" rx="10" fill="url(#cg)" opacity="0.6"/>
    <!-- end caps -->
    <rect x="78" y="118" width="32" height="84" rx="6" fill="#64748b"/>
    <rect x="370" y="118" width="32" height="84" rx="6" fill="#64748b"/>
    <!-- rod -->
    <rect x="402" y="152" width="60" height="16" rx="4" fill="#cbd5e1"/>
    <rect x="458" y="146" width="14" height="28" rx="3" fill="#94a3b8"/>
    <!-- ports -->
    <rect x="150" y="112" width="14" height="14" rx="2" fill="#475569"/>
    <rect x="300" y="112" width="14" height="14" rx="2" fill="#475569"/>
    <!-- bore indicator lines -->
    <line x1="110" y1="118" x2="110" y2="202" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
    <!-- label -->
    <text x="240" y="242" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Pneumatisk cylinder</text>
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity=".4"/><stop offset="100%" stop-color="#000" stop-opacity=".15"/></linearGradient></defs>
  </svg>`,

  "electric-actuator": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- motor body -->
    <rect x="60" y="100" width="180" height="120" rx="10" fill="#475569"/>
    <rect x="60" y="100" width="180" height="120" rx="10" fill="url(#eg)" opacity="0.5"/>
    <!-- cooling fins -->
    <rect x="68" y="108" width="8" height="104" rx="2" fill="#334155"/>
    <rect x="84" y="108" width="8" height="104" rx="2" fill="#334155"/>
    <rect x="100" y="108" width="8" height="104" rx="2" fill="#334155"/>
    <!-- shaft/rod -->
    <rect x="240" y="151" width="130" height="18" rx="4" fill="#94a3b8"/>
    <rect x="366" y="144" width="18" height="32" rx="3" fill="#64748b"/>
    <!-- encoder/cable -->
    <circle cx="120" cy="160" r="28" fill="#334155"/>
    <circle cx="120" cy="160" r="18" fill="#1e293b"/>
    <circle cx="120" cy="160" r="8" fill="#94a3b8"/>
    <!-- bolt symbol -->
    <text x="240" y="156" font-family="Arial,sans-serif" font-size="28" fill="#f59e0b" text-anchor="middle">⚡</text>
    <text x="240" y="242" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Elektrisk aktuator</text>
    <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity=".3"/><stop offset="100%" stop-color="#000" stop-opacity=".2"/></linearGradient></defs>
  </svg>`,

  "valve": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- valve body -->
    <rect x="160" y="130" width="160" height="80" rx="8" fill="#64748b"/>
    <!-- ports top/bottom -->
    <rect x="214" y="90" width="28" height="42" rx="4" fill="#475569"/>
    <rect x="238" y="188" width="28" height="42" rx="4" fill="#475569"/>
    <!-- side connections -->
    <rect x="90" y="150" width="72" height="20" rx="4" fill="#94a3b8"/>
    <rect x="318" y="150" width="72" height="20" rx="4" fill="#94a3b8"/>
    <!-- solenoid coil -->
    <rect x="196" y="60" width="64" height="34" rx="5" fill="#334155"/>
    <rect x="208" y="64" width="40" height="10" rx="2" fill="#1e40af"/>
    <!-- indicator LED -->
    <circle cx="256" cy="77" r="5" fill="#22c55e"/>
    <!-- label -->
    <text x="240" y="260" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Solenoidventil</text>
  </svg>`,

  "valve-terminal": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- manifold base -->
    <rect x="60" y="180" width="360" height="40" rx="6" fill="#475569"/>
    <!-- 5 valve stations -->
    ${[0,1,2,3,4].map(i=>`
    <rect x="${80+i*68}" y="120" width="52" height="62" rx="5" fill="#64748b"/>
    <rect x="${86+i*68}" y="124" width="40" height="16" rx="3" fill="#1e40af"/>
    <circle cx="${106+i*68}" cy="132" r="4" fill="${i<3?"#22c55e":"#94a3b8"}"/>
    `).join("")}
    <!-- fieldbus connector -->
    <rect x="380" y="130" width="44" height="60" rx="5" fill="#334155"/>
    <rect x="386" y="136" width="32" height="12" rx="2" fill="#1d4ed8"/>
    <!-- label -->
    <text x="240" y="260" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Ventiläterminal</text>
  </svg>`,

  "gripper": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- gripper body -->
    <rect x="180" y="80" width="120" height="80" rx="8" fill="#64748b"/>
    <!-- left finger -->
    <path d="M180 160 L140 160 L120 200 L140 240 L180 240 Z" fill="#475569"/>
    <!-- right finger -->
    <path d="M300 160 L340 160 L360 200 L340 240 L300 240 Z" fill="#475569"/>
    <!-- jaw faces -->
    <rect x="122" y="198" width="18" height="36" rx="2" fill="#334155"/>
    <rect x="340" y="198" width="18" height="36" rx="2" fill="#334155"/>
    <!-- cylinder indicator -->
    <rect x="196" y="96" width="88" height="28" rx="4" fill="#94a3b8"/>
    <!-- guide rails -->
    <rect x="186" y="158" width="14" height="60" rx="2" fill="#94a3b8"/>
    <rect x="280" y="158" width="14" height="60" rx="2" fill="#94a3b8"/>
    <!-- label -->
    <text x="240" y="280" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Gripper</text>
  </svg>`,

  "vacuum": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- vacuum generator body -->
    <rect x="140" y="100" width="200" height="90" rx="8" fill="#64748b"/>
    <!-- suction cups (3x) -->
    <ellipse cx="160" cy="230" rx="28" ry="12" fill="#475569"/>
    <rect x="156" y="190" width="8" height="40" rx="3" fill="#94a3b8"/>
    <ellipse cx="240" cy="230" rx="28" ry="12" fill="#475569"/>
    <rect x="236" y="190" width="8" height="40" rx="3" fill="#94a3b8"/>
    <ellipse cx="320" cy="230" rx="28" ry="12" fill="#475569"/>
    <rect x="316" y="190" width="8" height="40" rx="3" fill="#94a3b8"/>
    <!-- vacuum port -->
    <rect x="216" y="80" width="48" height="24" rx="4" fill="#475569"/>
    <!-- vacuum symbol -->
    <circle cx="240" cy="144" r="24" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <text x="240" y="150" font-family="Arial,sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">⊗</text>
    <!-- label -->
    <text x="240" y="272" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Vakuumsystem</text>
  </svg>`,

  "air-preparation": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- 3 units: filter, regulator, lubricator -->
    <!-- unit 1 filter -->
    <rect x="72" y="100" width="84" height="120" rx="6" fill="#64748b"/>
    <ellipse cx="114" cy="220" rx="32" ry="16" fill="#475569" opacity="0.7"/>
    <rect x="100" y="86" width="28" height="18" rx="3" fill="#475569"/>
    <text x="114" y="156" font-family="Arial,sans-serif" font-size="10" fill="#e2e8f0" text-anchor="middle">FILTER</text>
    <!-- unit 2 regulator -->
    <rect x="196" y="100" width="84" height="120" rx="6" fill="#94a3b8"/>
    <circle cx="238" cy="148" r="22" fill="#475569"/>
    <line x1="238" y1="130" x2="238" y2="148" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="224" y="86" width="28" height="18" rx="3" fill="#475569"/>
    <text x="238" y="186" font-family="Arial,sans-serif" font-size="10" fill="#334155" text-anchor="middle">REGUL.</text>
    <!-- unit 3 lubricator -->
    <rect x="320" y="100" width="84" height="120" rx="6" fill="#64748b"/>
    <ellipse cx="362" cy="220" rx="32" ry="16" fill="#475569" opacity="0.7"/>
    <rect x="348" y="86" width="28" height="18" rx="3" fill="#475569"/>
    <text x="362" y="156" font-family="Arial,sans-serif" font-size="10" fill="#e2e8f0" text-anchor="middle">SMÖRJ.</text>
    <!-- connecting pipe -->
    <rect x="156" y="148" width="40" height="10" fill="#94a3b8"/>
    <rect x="280" y="148" width="40" height="10" fill="#94a3b8"/>
    <text x="240" y="270" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Luftberedning FRL</text>
  </svg>`,

  "hose": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- coiled hose -->
    <path d="M 100 200 Q 120 100 240 120 Q 360 140 380 220 Q 400 300 260 280 Q 120 260 110 180 Q 100 100 220 90 Q 340 80 370 160" fill="none" stroke="#64748b" stroke-width="14" stroke-linecap="round"/>
    <path d="M 100 200 Q 120 100 240 120 Q 360 140 380 220 Q 400 300 260 280 Q 120 260 110 180 Q 100 100 220 90 Q 340 80 370 160" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
    <!-- fittings at ends -->
    <rect x="82" y="188" width="22" height="24" rx="4" fill="#475569"/>
    <rect x="362" y="148" width="22" height="24" rx="4" fill="#475569"/>
    <text x="240" y="300" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Pneumatisk slang</text>
  </svg>`,

  "fitting": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- T-fitting -->
    <!-- horizontal pipe -->
    <rect x="100" y="142" width="280" height="36" rx="6" fill="#94a3b8"/>
    <!-- vertical pipe up -->
    <rect x="222" y="70" width="36" height="74" rx="6" fill="#94a3b8"/>
    <!-- hex body center -->
    <polygon points="240,118 264,132 264,160 240,174 216,160 216,132" fill="#64748b"/>
    <!-- thread details -->
    <rect x="100" y="148" width="20" height="24" rx="2" fill="#64748b"/>
    <rect x="360" y="148" width="20" height="24" rx="2" fill="#64748b"/>
    <rect x="228" y="70" width="24" height="18" rx="2" fill="#64748b"/>
    <!-- push-in indicator -->
    <circle cx="100" cy="160" r="10" fill="#475569"/>
    <circle cx="380" cy="160" r="10" fill="#475569"/>
    <circle cx="240" cy="70" r="10" fill="#475569"/>
    <text x="240" y="256" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Push-in koppling</text>
  </svg>`,

  "speed-controller": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- body -->
    <rect x="160" y="110" width="160" height="100" rx="8" fill="#64748b"/>
    <!-- inlet/outlet fittings -->
    <rect x="100" y="148" width="62" height="24" rx="4" fill="#94a3b8"/>
    <rect x="318" y="148" width="62" height="24" rx="4" fill="#94a3b8"/>
    <!-- adjustment screw on top -->
    <rect x="210" y="80" width="60" height="34" rx="20" fill="#475569"/>
    <rect x="226" y="72" width="28" height="14" rx="4" fill="#334155"/>
    <!-- slot indicator -->
    <line x1="240" y1="72" x2="240" y2="80" stroke="#94a3b8" stroke-width="3"/>
    <!-- flow direction arrow -->
    <path d="M 130 160 L 150 160 M 145 154 L 155 160 L 145 166" fill="none" stroke="#e2e8f0" stroke-width="2.5"/>
    <text x="240" y="242" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Hastighetsbegränsare</text>
  </svg>`,

  "coupling": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- male half -->
    <rect x="90" y="134" width="110" height="52" rx="6" fill="#64748b"/>
    <rect x="188" y="144" width="44" height="32" rx="4" fill="#94a3b8"/>
    <!-- female half -->
    <rect x="278" y="134" width="110" height="52" rx="6" fill="#475569"/>
    <rect x="248" y="140" width="34" height="40" rx="4" fill="#64748b"/>
    <!-- gap indicator -->
    <line x1="236" y1="120" x2="236" y2="200" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 3"/>
    <!-- locking ring -->
    <rect x="262" y="130" width="18" height="60" rx="9" fill="#334155" opacity="0.7"/>
    <!-- quick-release indicator arrows -->
    <path d="M 200 110 L 220 110 M 215 104 L 225 110 L 215 116" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <path d="M 280 110 L 260 110 M 265 104 L 255 110 L 265 116" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <text x="240" y="228" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Snabbkoppling</text>
  </svg>`,

  "seal-kit": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- O-rings stacked -->
    <ellipse cx="240" cy="180" rx="90" ry="30" fill="none" stroke="#64748b" stroke-width="16"/>
    <ellipse cx="240" cy="150" rx="90" ry="30" fill="none" stroke="#475569" stroke-width="14"/>
    <ellipse cx="240" cy="122" rx="90" ry="30" fill="none" stroke="#64748b" stroke-width="12"/>
    <!-- wiper seal -->
    <rect x="130" y="212" width="220" height="18" rx="9" fill="#334155"/>
    <rect x="148" y="215" width="184" height="12" rx="6" fill="#475569"/>
    <!-- backing ring -->
    <ellipse cx="240" cy="96" rx="70" ry="18" fill="none" stroke="#94a3b8" stroke-width="10"/>
    <text x="240" y="268" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Tätningssats</text>
  </svg>`,

  "linear-module": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f0f4f8"/>
    <!-- guide rail -->
    <rect x="60" y="148" width="360" height="24" rx="4" fill="#475569"/>
    <!-- carriage/slide -->
    <rect x="180" y="118" width="120" height="84" rx="6" fill="#64748b"/>
    <!-- bearing blocks -->
    <rect x="188" y="162" width="44" height="20" rx="3" fill="#334155"/>
    <rect x="248" y="162" width="44" height="20" rx="3" fill="#334155"/>
    <!-- drive belt/screw indicator -->
    <line x1="80" y1="160" x2="400" y2="160" stroke="#94a3b8" stroke-width="3" stroke-dasharray="8 4"/>
    <!-- motor end -->
    <rect x="60" y="128" width="50" height="64" rx="6" fill="#334155"/>
    <circle cx="85" cy="160" r="18" fill="#475569"/>
    <circle cx="85" cy="160" r="8" fill="#94a3b8"/>
    <!-- position arrow -->
    <path d="M 300 104 L 340 104 M 334 98 L 344 104 L 334 110" fill="none" stroke="#64748b" stroke-width="2.5"/>
    <text x="240" y="240" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Linjärmodul</text>
  </svg>`,
};

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
  <rect width="480" height="320" fill="#f0f4f8"/>
  <rect x="140" y="100" width="200" height="120" rx="10" fill="#94a3b8"/>
  <rect x="100" y="148" width="42" height="24" rx="4" fill="#64748b"/>
  <rect x="338" y="148" width="42" height="24" rx="4" fill="#64748b"/>
  <text x="240" y="252" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Industrikomponent</text>
</svg>`;

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getCategoryImage(categorySlug: string, _square = false): string {
  return toDataUrl(svgs[categorySlug] ?? FALLBACK_SVG);
}

export function getBrandImage(_brandSlug: string): string {
  return toDataUrl(FALLBACK_SVG);
}

export function getProductImage(
  product: { category: { slug: string }; brand: { slug: string } },
  square = false
): string {
  return getCategoryImage(product.category.slug, square);
}
