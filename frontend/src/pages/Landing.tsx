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
          <FeatureCarousel />
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
