import FeatureCarousel from "../components/FeatureCarousel";
import Logo from "../components/Logo";
import { LEVELS } from "../risk";

// The thresholds from the brief, shown exactly as the backend applies them.
const RULES = [
  { name: "Wind (mph)", values: ["< 25", "25–34", "35–44", "45–54", "≥ 55"] },
  { name: "Rain (in/hr)", values: ["< 0.10", "0.10–0.25", "0.25–0.50", "0.50–1.00", "> 1.00"] },
  { name: "Snow (in/hr)", values: ["< 0.5", "0.5–1.0", "1.0–2.0", "2.0–3.0", "> 3.0"] },
];

const STEPS = [
  ["Enter the trip", "Start, destination, departure time and the load's weight."],
  [
    "Every checkpoint is graded",
    "Each route is checked every 10, 25 or 50 miles against the forecast for the hour the truck gets there.",
  ],
  [
    "Take the safest route",
    "Fewest Severe miles wins, then fewest High miles, then the lowest average risk, then the shortest time.",
  ],
];

const primaryButton =
  "bg-shield hover:bg-shield-dark inline-flex items-center justify-center rounded-md px-5 py-2.5 text-[15px] font-bold text-white transition-colors";

export default function Landing() {
  return (
    <div className="bg-paper min-h-full">
      <header className="border-rule bg-panel sticky top-0 z-20 border-b">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2 text-[17px] font-extrabold">
            <Logo className="h-7 w-7" />
            WeatherRoute
          </a>
          <div className="flex items-center gap-6 text-[15px]">
            <a href="#how" className="text-ink-2 hover:text-ink hidden sm:inline">
              How it works
            </a>
            <a href="#rules" className="text-ink-2 hover:text-ink hidden sm:inline">
              Risk rules
            </a>
            <a href="/app" className={primaryButton}>
              Plan a trip
            </a>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-12 pb-16 md:pt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
        <div className="motion-safe:animate-fade-up">
          <h1 className="text-[40px] leading-[1.04] font-black tracking-[-0.01em] text-balance sm:text-[52px] lg:text-[60px]">
            Route your truck around the weather
          </h1>
          <p className="text-ink-2 mt-5 max-w-[34rem] text-[17px] leading-relaxed text-pretty">
            Compare three routes by the forecast for the hour the truck reaches each stretch of
            road, its load weight and travel time. Get one recommendation, and the reason it won.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href="/app" className={primaryButton}>
              Plan a trip
            </a>
            <a
              href="#rules"
              className="text-shield decoration-shield/40 hover:decoration-shield text-[15px] font-semibold underline underline-offset-4"
            >
              See the risk rules
            </a>
          </div>
        </div>
        <div className="motion-safe:animate-fade-up min-w-0 [animation-delay:120ms]">
          <FeatureCarousel />
        </div>
      </section>

      <section id="how" className="border-rule bg-panel scroll-mt-16 border-y">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-[28px] font-extrabold">How it works</h2>
          <ol className="divide-rule mt-8 grid gap-y-6 md:grid-cols-3 md:divide-x">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="md:px-6 md:first:pl-0 md:last:pr-0">
                <span className="text-shield text-[40px] leading-none font-black tabular-nums">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[17px] font-bold">{title}</h3>
                <p className="text-ink-2 mt-1.5 max-w-xs text-[15px] leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="rules" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-14">
        <h2 className="text-[28px] font-extrabold">The thresholds behind every grade</h2>
        <p className="text-ink-2 mt-2 max-w-2xl text-[15px]">
          Each checkpoint takes the worst of its wind, rain and snow levels, then the load rules
          apply.
        </p>
        <div className="border-rule mt-8 overflow-x-auto rounded-md border bg-white">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead className="bg-[#f7f9fb] shadow-[inset_0_-1px_0_var(--color-rule)]">
              <tr>
                <th className="text-ink-2 px-4 py-3 text-left font-semibold">Condition</th>
                {LEVELS.map((l) => (
                  <th key={l.key} className="px-4 py-3 text-left font-bold">
                    <span className="inline-flex items-center gap-2" style={{ color: l.ink }}>
                      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.name} className="border-rule-2 border-t">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  {r.values.map((v) => (
                    <td key={v} className="text-ink-2 px-4 py-3 tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div className="border-ink border-t-2 pt-4">
            <h3 className="text-[17px] font-bold">Load rules</h3>
            <ul className="text-ink-2 mt-3 space-y-2 text-[15px]">
              <li>Wind at 55 mph or more is No Travel for any load.</li>
              <li>Wind of 45–54 mph with a load over 30,000 lb is No Travel.</li>
              <li>Wind of 35–44 mph with a load over 40,000 lb is Severe.</li>
            </ul>
          </div>
          <div className="border-ink border-t-2 pt-4">
            <h3 className="text-[17px] font-bold">How the recommendation is chosen</h3>
            <ol className="text-ink-2 mt-3 list-inside list-decimal space-y-2 text-[15px]">
              <li>Fewest Severe miles</li>
              <li>Fewest High miles</li>
              <li>Lowest average risk</li>
              <li>Shortest travel time</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-5 py-12 sm:flex-row sm:items-center">
          <h2 className="text-[26px] font-extrabold">Check your next trip before it starts.</h2>
          <a
            href="/app"
            className="text-ink inline-flex items-center rounded-md bg-white px-5 py-2.5 text-[15px] font-bold transition-colors hover:bg-[#e3e9f2]"
          >
            Plan a trip
          </a>
        </div>
      </section>

      <footer className="border-rule border-t">
        <div className="text-ink-3 mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[13px] sm:flex-row sm:justify-between">
          <p>
            Weather from Open-Meteo. Routing by Geoapify or HERE when configured, otherwise OSRM.
            Map data © OpenStreetMap, © CARTO.
          </p>
          <a
            href="https://github.com/saadabrar1/Weather-Aware-Truck-Routing-"
            className="hover:text-ink shrink-0"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
