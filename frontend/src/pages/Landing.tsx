import { useLayoutEffect, useRef, useState } from "react";
import Logo from "../components/Logo";
import { LEVELS } from "../risk";

const FEATURES = [
  {
    title: "3 route options",
    body: "Every trip is compared across three distinct routes from a truck-aware routing API.",
  },
  {
    title: "Weather at your ETA",
    body: "Forecasts are read every 10, 25 or 50 miles at the hour the truck actually arrives there.",
  },
  {
    title: "Load-aware risk",
    body: "Wind, rain and snow are graded Low to No Travel, and heavy loads raise the wind risk.",
  },
  {
    title: "48-hour corridor view",
    body: "A heatmap of the trip corridor with a slider across the next 0–48 hours.",
  },
];

// The thresholds from the brief, shown exactly as the backend applies them.
const RULES = [
  { name: "Wind (mph)", values: ["< 25", "25–34", "35–44", "45–54", "≥ 55"] },
  { name: "Rain (in/hr)", values: ["< 0.10", "0.10–0.25", "0.25–0.50", "0.50–1.00", "> 1.00"] },
  { name: "Snow (in/hr)", values: ["< 0.5", "0.5–1.0", "1.0–2.0", "2.0–3.0", "> 3.0"] },
];

const STEPS = [
  ["Enter the trip", "Origin, destination, departure time and load weight."],
  ["We check every checkpoint", "Each route is sampled and graded with the forecast at its ETA."],
  ["Take the safest route", "Fewest Severe miles, then High miles, then average risk, then time."],
];

export default function Landing() {
  return (
    <div className="bg-ink-950 min-h-full">
      <header className="border-ink-700/60 bg-ink-950/80 sticky top-0 z-20 border-b backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Logo className="h-7 w-7" />
            <span>
              Weather<span className="text-turq">Route</span>
            </span>
          </a>
          <div className="flex items-center gap-5 text-sm">
            <a href="#how" className="hidden text-slate-300 hover:text-white sm:inline">
              How it works
            </a>
            <a href="#rules" className="hidden text-slate-300 hover:text-white sm:inline">
              Risk rules
            </a>
            <a
              href="/app"
              className="bg-teal rounded-lg px-4 py-2 font-bold text-white transition hover:bg-[#009494]"
            >
              Plan a route
            </a>
          </div>
        </nav>
      </header>

      <section className="from-deep via-ink-900 to-ink-950 relative overflow-hidden bg-gradient-to-b">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(#40e0d0_1px,transparent_1px),linear-gradient(90deg,#40e0d0_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.07]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center md:pt-24">
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
            Route your truck around the <span className="text-turq">weather</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
            Compare three routes by the forecast at the truck's arrival time, its load weight and
            travel time, and get a clear recommendation before the wheels turn.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/app"
              className="bg-teal shadow-teal/30 w-full rounded-lg px-6 py-3 font-bold text-white shadow-lg transition hover:bg-[#009494] sm:w-auto"
            >
              Plan a route
            </a>
            <a
              href="#rules"
              className="border-ink-600 hover:bg-ink-800 w-full rounded-lg border px-6 py-3 font-semibold text-slate-200 transition sm:w-auto"
            >
              See the risk rules
            </a>
          </div>
          <Preview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border-ink-700 bg-ink-900 border-t-turq/60 rounded-xl border border-t-2 p-5"
            >
              <h3 className="font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-ink-800 bg-ink-900/50 scroll-mt-16 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="bg-turq/15 text-turq grid h-10 w-10 shrink-0 place-items-center rounded-full font-extrabold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="rules" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Risk rules</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Each checkpoint takes the worst of its wind, rain and snow levels.
        </p>
        <div className="border-ink-700 mt-8 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-ink-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Condition</th>
                {LEVELS.map((l) => (
                  <th key={l.key} className="px-4 py-3 text-left font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.name} className="border-ink-700 border-t">
                  <td className="px-4 py-3 font-semibold text-slate-200">{r.name}</td>
                  {r.values.map((v) => (
                    <td key={v} className="px-4 py-3 text-slate-300 tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="border-ink-700 bg-ink-900 rounded-xl border p-5">
            <h3 className="font-bold">Load rules</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>≥ 55 mph wind → No Travel for any load</li>
              <li>45–54 mph wind with a load over 30,000 lb → No Travel</li>
              <li>35–44 mph wind with a load over 40,000 lb → Severe</li>
            </ul>
          </div>
          <div className="border-ink-700 bg-ink-900 rounded-xl border p-5">
            <h3 className="font-bold">Recommendation order</h3>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-300">
              <li>Fewest Severe miles</li>
              <li>Fewest High miles</li>
              <li>Lowest average risk</li>
              <li>Shortest travel time</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="from-deep to-ink-900 bg-gradient-to-br">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Check your next trip</h2>
          <a
            href="/app"
            className="bg-teal shadow-teal/30 rounded-lg px-6 py-3 font-bold text-white shadow-lg transition hover:bg-[#009494]"
          >
            Plan a route
          </a>
        </div>
      </section>

      <footer className="border-ink-800 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:justify-between">
          <span>Weather: Open-Meteo · Routing: HERE / OSRM · Map: © OpenStreetMap, © CARTO</span>
          <a
            href="https://github.com/saadabrar1/Weather-Aware-Truck-Routing-"
            className="hover:text-white"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

// A drawn preview of the planner: three routes, risk-coloured checkpoints and
// the recommended route in turquoise. Pure SVG, so it is sharp at any size.
// Checkpoints are placed on the paths themselves once they are measured.
const PREVIEW_ROUTES = [
  {
    d: "M60 250 C 180 120, 330 120, 480 150 S 680 120, 760 90",
    main: true,
    levels: [0, 0, 0, 1, 0, 0],
  },
  {
    d: "M60 250 C 200 260, 360 230, 500 220 S 690 160, 760 90",
    main: false,
    levels: [0, 1, 2, 1, 0],
  },
  {
    d: "M60 250 C 160 330, 380 330, 540 280 S 700 170, 760 90",
    main: false,
    levels: [0, 2, 3, 2, 1],
  },
];

type Dot = { x: number; y: number; level: number };

function Preview() {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const [dots, setDots] = useState<Dot[]>([]);

  useLayoutEffect(() => {
    const placed: Dot[] = [];
    PREVIEW_ROUTES.forEach((r, i) => {
      const path = paths.current[i];
      if (!path) return;
      const length = path.getTotalLength();
      r.levels.forEach((level, k) => {
        const p = path.getPointAtLength((length * (k + 1)) / (r.levels.length + 1));
        placed.push({ x: p.x, y: p.y, level });
      });
    });
    setDots(placed);
  }, []);

  // Centre the storm glow on the worst checkpoint it explains.
  const storm = dots.reduce<Dot | null>((w, d) => (!w || d.level > w.level ? d : w), null);

  return (
    <div className="border-ink-600 bg-ink-900 shadow-turq/10 mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border shadow-2xl">
      <div className="border-ink-700 flex items-center gap-1.5 border-b px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-ink-600 h-2.5 w-2.5 rounded-full" />
        ))}
      </div>
      <svg
        viewBox="0 0 820 360"
        className="block w-full"
        role="img"
        aria-label="Preview of three compared routes, the recommended one avoiding a storm"
      >
        <defs>
          <radialGradient id="wash" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="storm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="820" height="360" fill="#0b1014" />
        <ellipse cx="400" cy="190" rx="420" ry="190" fill="url(#wash)" />
        {storm && <ellipse cx={storm.x} cy={storm.y} rx="150" ry="80" fill="url(#storm)" />}
        {PREVIEW_ROUTES.map((r, i) => ({ r, i }))
          .reverse()
          .map(({ r, i }) => (
            <path
              key={r.d}
              ref={(el) => {
                paths.current[i] = el;
              }}
              d={r.d}
              fill="none"
              stroke={r.main ? "#40e0d0" : "#6b7f8a"}
              strokeWidth={r.main ? 5 : 3}
              strokeLinecap="round"
              opacity={r.main ? 1 : 0.8}
            />
          ))}
        {dots.map((d) => (
          <circle
            key={`${d.x.toFixed(1)}-${d.y.toFixed(1)}`}
            cx={d.x}
            cy={d.y}
            r={6}
            fill={LEVELS[d.level].color}
            stroke="#0b1014"
            strokeWidth="2"
          />
        ))}
        <circle cx="60" cy="250" r="8" fill="#0b1014" stroke="#fff" strokeWidth="3" />
        <rect
          x="752"
          y="82"
          width="16"
          height="16"
          rx="3"
          transform="rotate(45 760 90)"
          fill="#40e0d0"
          stroke="#fff"
          strokeWidth="3"
        />
        <g transform="translate(40 24)">
          <rect
            width="236"
            height="64"
            rx="10"
            fill="#16222a"
            stroke="#40e0d0"
            strokeOpacity="0.5"
          />
          <text x="14" y="24" fill="#40e0d0" fontSize="11" fontWeight="700" letterSpacing="1">
            ★ RECOMMENDED
          </text>
          <text x="14" y="46" fill="#e2e8f0" fontSize="14" fontWeight="700">
            Route A · 0 Severe mi
          </text>
        </g>
      </svg>
    </div>
  );
}
