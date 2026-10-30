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
  ["Enter the trip", "Origin, destination, departure time and load weight."],
  [
    "Every checkpoint is graded",
    "Each route is sampled every 10, 25 or 50 miles and graded with the forecast at its ETA.",
  ],
  [
    "Take the safest route",
    "Fewest Severe miles, then fewest High miles, then lowest average risk, then time.",
  ],
];

const primaryCta =
  "bg-teal shadow-teal/25 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-bold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-[#009494] hover:shadow-xl hover:shadow-teal/30 motion-reduce:hover:translate-y-0";

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
          <div className="flex items-center gap-6 text-sm">
            <a href="#how" className="hidden text-slate-300 transition hover:text-white sm:inline">
              How it works
            </a>
            <a
              href="#rules"
              className="hidden text-slate-300 transition hover:text-white sm:inline"
            >
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
          className="absolute inset-0 [background-image:linear-gradient(#40e0d0_1px,transparent_1px),linear-gradient(90deg,#40e0d0_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)] [background-size:48px_48px] opacity-[0.08]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 text-center sm:pt-20 md:pt-24">
          <div className="motion-safe:animate-fade-up">
            <span className="border-turq/30 bg-turq/10 text-turq inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <span className="bg-turq h-1.5 w-1.5 rounded-full" />
              Weather at every checkpoint, at your arrival time
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl pb-1 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Route your truck around the <span className="text-turq">weather</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-slate-300 md:text-lg">
              Compare three routes by the forecast at the truck's arrival time, its load weight and
              travel time, and get a clear recommendation before the wheels turn.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/app" className={`${primaryCta} w-full sm:w-auto`}>
                Plan a route
                <span aria-hidden>→</span>
              </a>
              <a
                href="#rules"
                className="border-ink-600 hover:border-ink-600 hover:bg-ink-800 w-full rounded-lg border px-6 py-3 font-semibold text-slate-200 transition sm:w-auto"
              >
                See the risk rules
              </a>
            </div>
          </div>
          <div className="motion-safe:animate-fade-up [animation-delay:150ms]">
            <FeatureCarousel />
          </div>
        </div>
      </section>

      <section id="how" className="border-ink-800 bg-ink-900/50 scroll-mt-16 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <p className="text-turq text-center text-xs font-bold tracking-widest uppercase">
            How it works
          </p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-balance">
            From trip to recommendation in three steps
          </h2>
          <ol className="relative mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
            {/* The line that links the steps on wide screens. */}
            <span
              aria-hidden
              className="from-turq/0 via-turq/40 to-turq/0 absolute top-5 right-[16%] left-[16%] hidden h-px bg-gradient-to-r md:block"
            />
            {STEPS.map(([title, body], i) => (
              <li
                key={title}
                className="border-ink-700 bg-ink-900 hover:border-ink-600 relative rounded-xl border p-5 text-center transition md:border-0 md:bg-transparent md:p-0"
              >
                <span className="border-turq/40 bg-ink-900 text-turq relative mx-auto grid h-10 w-10 place-items-center rounded-full border font-extrabold">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-400">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="rules" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 md:py-20">
        <p className="text-turq text-center text-xs font-bold tracking-widest uppercase">
          Risk rules
        </p>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-balance">
          The thresholds behind every grade
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Each checkpoint takes the worst of its wind, rain and snow levels, then the load rules
          apply.
        </p>
        <div className="border-ink-700 mt-10 overflow-x-auto rounded-xl border">
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
                <tr key={r.name} className="border-ink-700 hover:bg-ink-900 border-t transition">
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
          <div className="border-ink-700 bg-ink-900 hover:border-ink-600 rounded-xl border p-5 transition">
            <h3 className="font-bold">Load rules</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>≥ 55 mph wind → No Travel for any load</li>
              <li>45–54 mph wind with a load over 30,000 lb → No Travel</li>
              <li>35–44 mph wind with a load over 40,000 lb → Severe</li>
            </ul>
          </div>
          <div className="border-ink-700 bg-ink-900 hover:border-ink-600 rounded-xl border p-5 transition">
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

      <section className="border-ink-800 relative overflow-hidden border-t">
        <div
          aria-hidden
          className="from-deep/80 to-ink-950 absolute inset-0 bg-gradient-to-br via-transparent"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance">
            Check your next trip before it starts
          </h2>
          <p className="max-w-xl text-slate-400">
            Three routes, graded checkpoint by checkpoint, in a few seconds.
          </p>
          <a href="/app" className={primaryCta}>
            Plan a route
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      <footer className="border-ink-800 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Weather: Open-Meteo · Routing: HERE truck routing when configured, otherwise OSRM · Map:
            © OpenStreetMap, © CARTO
          </span>
          <a
            href="https://github.com/saadabrar1/Weather-Aware-Truck-Routing-"
            className="transition hover:text-white"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
