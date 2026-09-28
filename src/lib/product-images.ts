// Flat 2D technical-style category illustrations

const svgs: Record<string, string> = {

  "cylinder": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- end cap left -->
    <rect x="90" y="100" width="28" height="80" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- body -->
    <rect x="118" y="110" width="244" height="60" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- end cap right -->
    <rect x="362" y="100" width="28" height="80" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- piston rod -->
    <rect x="390" y="133" width="80" height="14" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- rod eye -->
    <rect x="466" y="124" width="16" height="32" rx="2" fill="#6b7280" stroke="#4b5563" stroke-width="1.5"/>
    <!-- tie rods -->
    <line x1="90" y1="108" x2="390" y2="108" stroke="#6b7280" stroke-width="2"/>
    <line x1="90" y1="172" x2="390" y2="172" stroke="#6b7280" stroke-width="2"/>
    <!-- air ports -->
    <rect x="152" y="100" width="12" height="12" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="316" y="100" width="12" height="12" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- mounting feet -->
    <rect x="110" y="180" width="30" height="10" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="340" y="180" width="30" height="10" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- centerline -->
    <line x1="80" y1="140" x2="400" y2="140" stroke="#9ca3af" stroke-width="1" stroke-dasharray="6 3"/>
    <!-- label -->
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Pneumatisk cylinder</text>
  </svg>`,

  "electric-actuator": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- motor housing -->
    <rect x="60" y="96" width="160" height="112" rx="4" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- cooling fins -->
    <line x1="78" y1="96" x2="78" y2="208" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="96" y1="96" x2="96" y2="208" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="114" y1="96" x2="114" y2="208" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="132" y1="96" x2="132" y2="208" stroke="#9ca3af" stroke-width="1.5"/>
    <!-- shaft -->
    <rect x="220" y="134" width="140" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- end block -->
    <rect x="356" y="120" width="20" height="44" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- encoder circle -->
    <circle cx="140" cy="152" r="30" fill="none" stroke="#6b7280" stroke-width="2"/>
    <circle cx="140" cy="152" r="14" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- lightning bolt -->
    <path d="M136 138 L128 154 L137 154 L133 170 L148 150 L137 150 L143 138Z" fill="#f59e0b"/>
    <!-- cable entry -->
    <rect x="60" y="148" width="12" height="20" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="226" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Elektrisk aktuator</text>
  </svg>`,

  "valve": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- valve body -->
    <rect x="160" y="130" width="160" height="60" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- ports left/right -->
    <rect x="88" y="142" width="74" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="318" y="142" width="74" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- exhaust ports top -->
    <rect x="196" y="104" width="16" height="28" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="268" y="104" width="16" height="28" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- solenoid on top -->
    <rect x="182" y="72" width="56" height="34" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- solenoid windings -->
    <line x1="190" y1="80" x2="230" y2="80" stroke="#9ca3af" stroke-width="2"/>
    <line x1="190" y1="87" x2="230" y2="87" stroke="#9ca3af" stroke-width="2"/>
    <line x1="190" y1="94" x2="230" y2="94" stroke="#9ca3af" stroke-width="2"/>
    <!-- LED indicator -->
    <circle cx="248" cy="84" r="5" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
    <!-- DIN plug -->
    <rect x="188" y="60" width="44" height="14" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- spring symbol right side -->
    <path d="M338 150 L342 148 L346 152 L350 148 L354 152 L358 148 L362 152 L366 150" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="222" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Solenoidventil</text>
  </svg>`,

  "valve-terminal": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- manifold base -->
    <rect x="58" y="178" width="340" height="28" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- supply ports on manifold -->
    <rect x="78" y="192" width="10" height="16" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <rect x="118" y="192" width="10" height="16" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <rect x="226" y="192" width="10" height="16" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <rect x="336" y="192" width="10" height="16" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <!-- 4 valve stations -->
    <rect x="68" y="114" width="54" height="66" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="136" y="114" width="54" height="66" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="204" y="114" width="54" height="66" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="272" y="114" width="54" height="66" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- solenoid tops -->
    <rect x="72" y="96" width="46" height="20" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="140" y="96" width="46" height="20" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="208" y="96" width="46" height="20" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="276" y="96" width="46" height="20" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- LEDs -->
    <circle cx="96" cy="106" r="4" fill="#22c55e"/>
    <circle cx="164" cy="106" r="4" fill="#22c55e"/>
    <circle cx="232" cy="106" r="4" fill="#9ca3af"/>
    <circle cx="300" cy="106" r="4" fill="#22c55e"/>
    <!-- fieldbus module -->
    <rect x="344" y="100" width="54" height="80" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <rect x="350" y="108" width="42" height="14" rx="1" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
    <text x="371" y="119" font-family="Arial,sans-serif" font-size="7" fill="white" text-anchor="middle">FIELDBUS</text>
    <text x="240" y="232" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Ventiläterminal</text>
  </svg>`,

  "gripper": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- body -->
    <rect x="186" y="70" width="108" height="76" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- guide rails -->
    <rect x="196" y="146" width="12" height="62" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="272" y="146" width="12" height="62" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- left jaw -->
    <rect x="140" y="150" width="58" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="130" y="162" width="14" height="44" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- right jaw -->
    <rect x="282" y="150" width="58" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="336" y="162" width="14" height="44" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- bore indicator -->
    <line x1="186" y1="108" x2="294" y2="108" stroke="#9ca3af" stroke-width="1" stroke-dasharray="5 3"/>
    <!-- air ports -->
    <rect x="214" y="62" width="12" height="10" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="254" y="62" width="12" height="10" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- sensor slots -->
    <rect x="198" y="80" width="6" height="40" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <rect x="276" y="80" width="6" height="40" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <text x="240" y="230" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Gripper</text>
  </svg>`,

  "vacuum": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- generator body -->
    <rect x="142" y="90" width="196" height="80" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- vacuum port top -->
    <rect x="218" y="70" width="44" height="22" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- supply/exhaust ports -->
    <rect x="88" y="118" width="56" height="14" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="336" y="118" width="56" height="14" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- 3 suction cups -->
    <rect x="153" y="170" width="10" height="34" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <path d="M136 204 Q158 220 174 204" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="235" y="170" width="10" height="34" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <path d="M218 204 Q240 220 256 204" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="317" y="170" width="10" height="34" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <path d="M300 204 Q322 220 338 204" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>
    <!-- vacuum symbol -->
    <circle cx="240" cy="130" r="18" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="227" y1="117" x2="253" y2="143" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="253" y1="117" x2="227" y2="143" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="234" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Vakuumsystem</text>
  </svg>`,

  "air-preparation": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- connecting pipe -->
    <line x1="60" y1="130" x2="420" y2="130" stroke="#9ca3af" stroke-width="8" stroke-linecap="round"/>
    <!-- unit 1: filter -->
    <rect x="68" y="96" width="76" height="100" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="78" y="90" width="56" height="10" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- filter bowl -->
    <rect x="76" y="170" width="52" height="22" rx="1" fill="#bfdbfe" stroke="#6b7280" stroke-width="1.5"/>
    <!-- filter element lines -->
    <line x1="82" y1="114" x2="82" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="90" y1="110" x2="90" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="98" y1="108" x2="98" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="106" y1="108" x2="106" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="114" y1="110" x2="114" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="122" y1="114" x2="122" y2="165" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="106" y="202" font-family="Arial,sans-serif" font-size="9" fill="#6b7280" text-anchor="middle">FILTER</text>
    <!-- unit 2: regulator -->
    <rect x="202" y="96" width="76" height="100" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="212" y="90" width="56" height="10" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- pressure gauge -->
    <circle cx="240" cy="150" r="22" fill="white" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="240" y1="150" x2="250" y2="134" stroke="#374151" stroke-width="2"/>
    <line x1="222" y1="150" x2="258" y2="150" stroke="#d1d5db" stroke-width="1"/>
    <!-- adjustment knob -->
    <rect x="228" y="83" width="24" height="10" rx="5" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="202" font-family="Arial,sans-serif" font-size="9" fill="#6b7280" text-anchor="middle">REGUL.</text>
    <!-- unit 3: lubricator -->
    <rect x="336" y="96" width="76" height="100" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <rect x="346" y="90" width="56" height="10" rx="1" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- oil bowl -->
    <rect x="344" y="170" width="52" height="22" rx="1" fill="#fef3c7" stroke="#6b7280" stroke-width="1.5"/>
    <!-- drip tube -->
    <line x1="374" y1="115" x2="374" y2="170" stroke="#9ca3af" stroke-width="2" stroke-dasharray="4 2"/>
    <circle cx="374" cy="148" r="4" fill="#9ca3af"/>
    <text x="374" y="202" font-family="Arial,sans-serif" font-size="9" fill="#6b7280" text-anchor="middle">SMÖRJ.</text>
    <text x="240" y="234" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Luftberedning FRL</text>
  </svg>`,

  "hose": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- hose path -->
    <path d="M80 180 C80 90 180 80 240 120 C300 160 380 150 400 100" fill="none" stroke="#e5e7eb" stroke-width="18" stroke-linecap="round"/>
    <path d="M80 180 C80 90 180 80 240 120 C300 160 380 150 400 100" fill="none" stroke="#9ca3af" stroke-width="14" stroke-linecap="round"/>
    <path d="M80 180 C80 90 180 80 240 120 C300 160 380 150 400 100" fill="none" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round" stroke-dasharray="14 8"/>
    <!-- end fittings -->
    <rect x="60" y="168" width="24" height="24" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <rect x="60" y="172" width="10" height="16" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <rect x="396" y="88" width="24" height="24" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <rect x="410" y="92" width="10" height="16" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
    <!-- size label on hose -->
    <text x="240" y="168" font-family="Arial,sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">Ø6 / Ø8 / Ø10</text>
    <text x="240" y="228" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Pneumatisk slang</text>
  </svg>`,

  "fitting": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- horizontal tube left -->
    <rect x="80" y="128" width="110" height="24" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- horizontal tube right -->
    <rect x="290" y="128" width="110" height="24" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- vertical tube up -->
    <rect x="228" y="64" width="24" height="100" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- hex body -->
    <polygon points="240,106 264,119 264,146 240,159 216,146 216,119" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- push-in collets -->
    <rect x="80" y="132" width="14" height="16" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="386" y="132" width="14" height="16" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="232" y="64" width="16" height="14" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- tube inserts indicator -->
    <line x1="90" y1="140" x2="216" y2="140" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 3"/>
    <line x1="264" y1="140" x2="390" y2="140" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 3"/>
    <text x="240" y="222" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Push-in koppling</text>
  </svg>`,

  "speed-controller": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- inlet tube -->
    <rect x="68" y="128" width="100" height="24" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- body -->
    <rect x="168" y="108" width="144" height="64" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- outlet tube -->
    <rect x="312" y="128" width="100" height="24" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- needle valve symbol (diagonal inside body) -->
    <line x1="188" y1="170" x2="292" y2="108" stroke="#9ca3af" stroke-width="2"/>
    <!-- check valve symbol -->
    <polygon points="226,130 226,150 246,140" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="246" y1="128" x2="246" y2="152" stroke="#6b7280" stroke-width="2"/>
    <!-- adjustment knob -->
    <rect x="214" y="86" width="52" height="24" rx="12" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <line x1="240" y1="86" x2="240" y2="98" stroke="#6b7280" stroke-width="2"/>
    <!-- flow arrow -->
    <path d="M90 140 L120 140 M112 133 L122 140 L112 147" fill="none" stroke="#6b7280" stroke-width="2"/>
    <text x="240" y="224" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Hastighetsbegränsare</text>
  </svg>`,

  "coupling": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- male nipple body -->
    <rect x="80" y="128" width="130" height="24" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- nipple tip -->
    <rect x="206" y="132" width="40" height="16" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- female socket body -->
    <rect x="270" y="118" width="130" height="44" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- socket opening -->
    <rect x="270" y="126" width="20" height="28" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>
    <!-- locking sleeve -->
    <rect x="256" y="124" width="20" height="32" rx="2" fill="#9ca3af" stroke="#6b7280" stroke-width="2"/>
    <!-- separator line -->
    <line x1="248" y1="108" x2="248" y2="172" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3"/>
    <!-- push arrows -->
    <path d="M222 108 L238 108 M232 102 L240 108 L232 114" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <path d="M274 108 L258 108 M264 102 L256 108 L264 114" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="222" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Snabbkoppling</text>
  </svg>`,

  "seal-kit": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- O-ring 1 (large) -->
    <ellipse cx="240" cy="170" rx="88" ry="24" fill="none" stroke="#6b7280" stroke-width="14"/>
    <!-- O-ring 2 -->
    <ellipse cx="240" cy="148" rx="70" ry="18" fill="none" stroke="#9ca3af" stroke-width="11"/>
    <!-- O-ring 3 (small) -->
    <ellipse cx="240" cy="130" rx="52" ry="13" fill="none" stroke="#6b7280" stroke-width="9"/>
    <!-- wiper seal (flat) -->
    <rect x="130" y="186" width="220" height="14" rx="7" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- backup ring -->
    <ellipse cx="240" cy="116" rx="38" ry="9" fill="none" stroke="#9ca3af" stroke-width="7"/>
    <!-- cross section indicator -->
    <line x1="328" y1="170" x2="360" y2="170" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="360" y1="170" x2="360" y2="130" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="354" y="124" width="12" height="12" rx="6" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <text x="380" y="152" font-family="Arial,sans-serif" font-size="9" fill="#6b7280">NBR/FKM</text>
    <text x="240" y="228" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Tätningssats</text>
  </svg>`,

  "linear-module": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- profile rail -->
    <rect x="58" y="148" width="364" height="26" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- rail grooves -->
    <line x1="58" y1="156" x2="422" y2="156" stroke="#d1d5db" stroke-width="2"/>
    <line x1="58" y1="168" x2="422" y2="168" stroke="#d1d5db" stroke-width="2"/>
    <!-- carriage -->
    <rect x="178" y="110" width="124" height="66" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- carriage mounting holes -->
    <circle cx="198" cy="130" r="5" fill="white" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="282" cy="130" r="5" fill="white" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="198" cy="158" r="5" fill="white" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="282" cy="158" r="5" fill="white" stroke="#6b7280" stroke-width="1.5"/>
    <!-- ball recirculating indicators -->
    <ellipse cx="240" cy="148" rx="50" ry="6" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 2"/>
    <!-- motor -->
    <rect x="58" y="114" width="60" height="60" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <circle cx="88" cy="144" r="20" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="88" cy="144" r="8" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- travel arrows -->
    <path d="M302 120 L334 120 M327 114 L336 120 L327 126" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <path d="M178 120 L146 120 M153 114 L144 120 L153 126" fill="none" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="230" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Linjärmodul</text>
  </svg>`,

  // ── Kategorier som saknade ritning helt ────────────────────────────────
  // De föll ner på FALLBACK_SVG, alltså en grå ruta med texten
  // "Industrikomponent". En backventil, en kabel och ett fäste såg likadana
  // ut. 116 produkter delade på en bild som inte föreställde någon av dem.

  "rotary-actuator": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- kropp -->
    <rect x="150" y="96" width="180" height="96" rx="6" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- kugg/drev -->
    <circle cx="240" cy="144" r="34" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <circle cx="240" cy="144" r="12" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- utgående axel -->
    <rect x="234" y="60" width="12" height="36" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- rotationsbåge -->
    <path d="M 296 118 A 62 62 0 0 1 296 170" fill="none" stroke="#6b7280" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="M 296 170 l -7 -9 l 13 -2 z" fill="#6b7280"/>
    <!-- anslag -->
    <rect x="330" y="104" width="22" height="12" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="330" y="172" width="22" height="12" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- portar -->
    <rect x="132" y="112" width="18" height="12" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="132" y="164" width="18" height="12" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Vridcylinder</text>
  </svg>`,

  "sensor": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- givarkropp -->
    <rect x="150" y="124" width="112" height="34" rx="4" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- gängad nos -->
    <rect x="262" y="131" width="44" height="20" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <line x1="270" y1="131" x2="270" y2="151" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="280" y1="131" x2="280" y2="151" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="290" y1="131" x2="290" y2="151" stroke="#9ca3af" stroke-width="1.5"/>
    <!-- aktiv yta -->
    <rect x="306" y="133" width="8" height="16" rx="2" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- avkänningsfält -->
    <path d="M 326 126 q 14 15 0 30" fill="none" stroke="#9ca3af" stroke-width="2"/>
    <path d="M 340 118 q 20 23 0 46" fill="none" stroke="#d1d5db" stroke-width="2"/>
    <!-- indikatorlampa -->
    <circle cx="176" cy="141" r="7" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- kabel -->
    <path d="M 150 141 q -40 0 -56 26 t -54 22" fill="none" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Givare</text>
  </svg>`,

  "mounting": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- vinkelfäste, stående ben -->
    <rect x="166" y="86" width="26" height="110" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- liggande ben -->
    <rect x="166" y="170" width="148" height="26" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- förstyvning -->
    <path d="M 192 156 L 192 170 L 206 170 z" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- hål i stående ben -->
    <circle cx="179" cy="108" r="7" fill="#f8f9fb" stroke="#6b7280" stroke-width="2"/>
    <circle cx="179" cy="136" r="7" fill="#f8f9fb" stroke="#6b7280" stroke-width="2"/>
    <!-- hål i liggande ben -->
    <circle cx="246" cy="183" r="7" fill="#f8f9fb" stroke="#6b7280" stroke-width="2"/>
    <circle cx="292" cy="183" r="7" fill="#f8f9fb" stroke="#6b7280" stroke-width="2"/>
    <!-- skruv -->
    <rect x="240" y="120" width="12" height="46" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="232" y="110" width="28" height="12" rx="2" fill="#6b7280" stroke="#4b5563" stroke-width="1.5"/>
    <text x="240" y="230" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Fäste</text>
  </svg>`,

  "silencer": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- gänga -->
    <rect x="150" y="130" width="46" height="22" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <line x1="158" y1="130" x2="158" y2="152" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="168" y1="130" x2="168" y2="152" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="178" y1="130" x2="178" y2="152" stroke="#9ca3af" stroke-width="1.5"/>
    <line x1="188" y1="130" x2="188" y2="152" stroke="#9ca3af" stroke-width="1.5"/>
    <!-- nyckelgrepp -->
    <rect x="196" y="124" width="20" height="34" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- sintrad kropp -->
    <rect x="216" y="114" width="114" height="54" rx="8" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- porer -->
    <circle cx="240" cy="132" r="3" fill="#9ca3af"/><circle cx="258" cy="126" r="3" fill="#9ca3af"/>
    <circle cx="276" cy="134" r="3" fill="#9ca3af"/><circle cx="296" cy="127" r="3" fill="#9ca3af"/>
    <circle cx="312" cy="136" r="3" fill="#9ca3af"/><circle cx="248" cy="150" r="3" fill="#9ca3af"/>
    <circle cx="268" cy="156" r="3" fill="#9ca3af"/><circle cx="288" cy="148" r="3" fill="#9ca3af"/>
    <circle cx="308" cy="155" r="3" fill="#9ca3af"/>
    <!-- utströmning -->
    <path d="M 340 128 q 16 -6 30 -2" fill="none" stroke="#d1d5db" stroke-width="2"/>
    <path d="M 340 142 q 20 0 36 0" fill="none" stroke="#d1d5db" stroke-width="2"/>
    <path d="M 340 156 q 16 6 30 2" fill="none" stroke="#d1d5db" stroke-width="2"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Ljuddämpare</text>
  </svg>`,

  "shock-absorber": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- gängad kropp -->
    <rect x="150" y="124" width="170" height="34" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <g stroke="#9ca3af" stroke-width="1.5">
      <line x1="162" y1="124" x2="162" y2="158"/><line x1="176" y1="124" x2="176" y2="158"/>
      <line x1="190" y1="124" x2="190" y2="158"/><line x1="204" y1="124" x2="204" y2="158"/>
      <line x1="218" y1="124" x2="218" y2="158"/><line x1="232" y1="124" x2="232" y2="158"/>
    </g>
    <!-- låsmutter -->
    <rect x="246" y="116" width="26" height="50" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- kolvstång -->
    <rect x="320" y="134" width="70" height="14" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- anslagshuvud -->
    <rect x="390" y="126" width="18" height="30" rx="4" fill="#6b7280" stroke="#4b5563" stroke-width="1.5"/>
    <!-- slagriktning -->
    <path d="M 430 141 l -22 0" stroke="#6b7280" stroke-width="2"/>
    <path d="M 408 141 l 10 -6 l 0 12 z" fill="#6b7280"/>
    <line x1="140" y1="141" x2="330" y2="141" stroke="#9ca3af" stroke-width="1" stroke-dasharray="6 3"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Stötdämpare</text>
  </svg>`,

  "servo-motor": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- motorkropp -->
    <rect x="164" y="100" width="130" height="88" rx="4" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- kylflänsar -->
    <g stroke="#9ca3af" stroke-width="1.5">
      <line x1="180" y1="100" x2="180" y2="188"/><line x1="200" y1="100" x2="200" y2="188"/>
      <line x1="220" y1="100" x2="220" y2="188"/><line x1="240" y1="100" x2="240" y2="188"/>
      <line x1="260" y1="100" x2="260" y2="188"/><line x1="278" y1="100" x2="278" y2="188"/>
    </g>
    <!-- fläns -->
    <rect x="294" y="110" width="20" height="68" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <circle cx="304" cy="120" r="4" fill="#f8f9fb" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="304" cy="168" r="4" fill="#f8f9fb" stroke="#6b7280" stroke-width="1.5"/>
    <!-- axel med kil -->
    <rect x="314" y="136" width="54" height="16" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="330" y="132" width="16" height="5" fill="#6b7280"/>
    <!-- givare bak -->
    <rect x="140" y="122" width="24" height="44" rx="3" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- kontakt -->
    <rect x="200" y="82" width="34" height="18" rx="3" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <text x="240" y="222" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Servomotor</text>
  </svg>`,

  "servo-drive": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- kapsling -->
    <rect x="176" y="72" width="128" height="140" rx="4" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- display -->
    <rect x="196" y="88" width="88" height="30" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="208" y1="103" x2="240" y2="103" stroke="#6b7280" stroke-width="3"/>
    <!-- lysdioder -->
    <circle cx="204" cy="132" r="4" fill="#9ca3af" stroke="#4b5563" stroke-width="1.2"/>
    <circle cx="220" cy="132" r="4" fill="#9ca3af" stroke="#4b5563" stroke-width="1.2"/>
    <!-- plintar -->
    <g fill="#d1d5db" stroke="#6b7280" stroke-width="1.5">
      <rect x="196" y="148" width="88" height="16" rx="2"/>
      <rect x="196" y="170" width="88" height="16" rx="2"/>
    </g>
    <g stroke="#9ca3af" stroke-width="1.2">
      <line x1="214" y1="148" x2="214" y2="164"/><line x1="232" y1="148" x2="232" y2="164"/>
      <line x1="250" y1="148" x2="250" y2="164"/><line x1="268" y1="148" x2="268" y2="164"/>
      <line x1="214" y1="170" x2="214" y2="186"/><line x1="232" y1="170" x2="232" y2="186"/>
      <line x1="250" y1="170" x2="250" y2="186"/><line x1="268" y1="170" x2="268" y2="186"/>
    </g>
    <!-- DIN-skena -->
    <rect x="150" y="212" width="180" height="10" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="248" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Servodrivare</text>
  </svg>`,

  "check-valve": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- hus -->
    <rect x="166" y="116" width="148" height="50" rx="8" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- säte -->
    <path d="M 214 122 L 236 141 L 214 160" fill="none" stroke="#6b7280" stroke-width="2"/>
    <!-- kula -->
    <circle cx="246" cy="141" r="13" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- fjäder -->
    <path d="M 259 141 l 8 -8 l 8 16 l 8 -16 l 8 16 l 8 -8" fill="none" stroke="#6b7280" stroke-width="2"/>
    <!-- anslutningar -->
    <rect x="128" y="131" width="38" height="20" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <rect x="314" y="131" width="38" height="20" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <!-- flödesriktning -->
    <line x1="366" y1="141" x2="412" y2="141" stroke="#6b7280" stroke-width="2"/>
    <path d="M 412 141 l -11 -6 l 0 12 z" fill="#6b7280"/>
    <!-- spärrad riktning -->
    <line x1="114" y1="141" x2="68" y2="141" stroke="#d1d5db" stroke-width="2"/>
    <line x1="80" y1="130" x2="92" y2="152" stroke="#9ca3af" stroke-width="2"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Backventil</text>
  </svg>`,

  "cable": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- rak kontakt -->
    <rect x="96" y="126" width="46" height="30" rx="4" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <g stroke="#9ca3af" stroke-width="1.5">
      <line x1="106" y1="126" x2="106" y2="156"/><line x1="116" y1="126" x2="116" y2="156"/>
      <line x1="126" y1="126" x2="126" y2="156"/>
    </g>
    <circle cx="90" cy="141" r="9" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <!-- kabel -->
    <path d="M 142 141 q 60 -44 120 0 t 118 0" fill="none" stroke="#6b7280" stroke-width="7" stroke-linecap="round"/>
    <!-- vinklad kontakt -->
    <rect x="380" y="126" width="34" height="30" rx="4" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>
    <rect x="392" y="96" width="30" height="30" rx="4" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Kabel med kontakt</text>
  </svg>`,

  "rod-lock": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <!-- kolvstång genom bromsen -->
    <rect x="70" y="134" width="340" height="14" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <!-- bromshus -->
    <rect x="188" y="100" width="104" height="82" rx="5" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- klämbackar -->
    <rect x="206" y="118" width="68" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <rect x="206" y="148" width="68" height="16" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- klämkraft -->
    <path d="M 240 106 l 0 10" stroke="#6b7280" stroke-width="2"/>
    <path d="M 240 118 l -5 -7 l 10 0 z" fill="#6b7280"/>
    <path d="M 240 176 l 0 -10" stroke="#6b7280" stroke-width="2"/>
    <path d="M 240 164 l -5 7 l 10 0 z" fill="#6b7280"/>
    <!-- lossningsport -->
    <rect x="292" y="112" width="18" height="12" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <text x="240" y="218" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Stångbroms</text>
  </svg>`,

  "controller": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
    <rect width="480" height="280" fill="#f8f9fb"/>
    <rect x="146" y="88" width="188" height="108" rx="5" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
    <!-- skärm -->
    <rect x="166" y="104" width="76" height="46" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <g stroke="#6b7280" stroke-width="2.5">
      <line x1="178" y1="120" x2="214" y2="120"/><line x1="178" y1="132" x2="200" y2="132"/>
    </g>
    <!-- knappar -->
    <circle cx="266" cy="114" r="8" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="294" cy="114" r="8" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <circle cx="266" cy="140" r="8" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <circle cx="294" cy="140" r="8" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
    <!-- bussanslutningar -->
    <rect x="166" y="164" width="52" height="18" rx="2" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <rect x="228" y="164" width="52" height="18" rx="2" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
    <text x="240" y="230" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Styrenhet</text>
  </svg>`,
};

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">
  <rect width="480" height="280" fill="#f8f9fb"/>
  <rect x="140" y="96" width="200" height="100" rx="2" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>
  <rect x="88" y="134" width="54" height="24" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
  <rect x="338" y="134" width="54" height="24" rx="2" fill="#d1d5db" stroke="#6b7280" stroke-width="1.5"/>
  <line x1="80" y1="146" x2="400" y2="146" stroke="#9ca3af" stroke-width="1" stroke-dasharray="6 3"/>
  <text x="240" y="238" font-family="Arial,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">Industrikomponent</text>
</svg>`;

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Kategorislugen i databasen och ritningens namn hade glidit isär på tre
 * ställen. Ritningarna FANNS -- de låg bara under ett annat namn, och 71
 * produkter visade därför den grå "Industrikomponent"-rutan i onödan.
 *
 * Alias i stället för att döpa om: slugen i databasen är den som står i
 * URL:er och i kategorimenyn, och ritningens namn är det som står i den här
 * filen. Att tvinga ihop dem hade betytt en migration för ett stavfel.
 */
const RITNING_ALIAS: Record<string, string> = {
  tubing: "hose",                  // 24 produkter
  frl: "air-preparation",          // 24
  "flow-control": "speed-controller", // 23
};

export function getCategoryImage(categorySlug: string, _square = false): string {
  const nyckel = RITNING_ALIAS[categorySlug] ?? categorySlug;
  return toDataUrl(svgs[nyckel] ?? FALLBACK_SVG);
}

export function getBrandImage(_brandSlug: string): string {
  return toDataUrl(FALLBACK_SVG);
}

export function getProductImage(
  product: { category: { slug: string }; brand: { slug: string }; family?: string | null; image_url?: string | null },
  square = false
): string {
  // Always use the flat category illustration — consistent across all products.
  return getCategoryImage(product.category.slug, square);
}
