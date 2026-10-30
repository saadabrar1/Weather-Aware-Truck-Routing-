import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LEVELS } from "../risk";

const SLIDE_MS = 5000;
const TICK_MS = 100;

const FEATURES = [
  {
    title: "3 route options",
    body: "Every trip is compared across three distinct routes, ranked by weather risk, then time.",
    Scene: RoutesScene,
  },
  {
    title: "Weather at your ETA",
    body: "Forecasts are read every 10, 25 or 50 miles at the hour the truck actually arrives there.",
    Scene: EtaScene,
  },
  {
    title: "Load-aware risk",
    body: "The same wind is riskier for a heavier truck: over 30,000 lb, 45–54 mph becomes No Travel.",
    Scene: LoadScene,
  },
  {
    title: "48-hour corridor view",
    body: "A heatmap of the trip corridor with a slider across the next 0–48 hours.",
    Scene: CorridorScene,
  },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Auto-advances every 5 s, pauses while hovered or focused, and stays still
// for people who ask their system for reduced motion.
export default function FeatureCarousel() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Bumped on every slide change so each scene's animation restarts from the top.
  const [cycle, setCycle] = useState(0);
  const paused = reduced || hovered || focused;

  const go = (i: number) => {
    setActive((i + FEATURES.length) % FEATURES.length);
    setElapsed(0);
    setCycle((c) => c + 1);
  };

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (elapsed >= SLIDE_MS) go(active + 1);
  }, [elapsed, active]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What the planner does"
      className="mx-auto mt-14 max-w-4xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="border-ink-600 bg-ink-900 shadow-turq/10 overflow-hidden rounded-2xl border shadow-2xl">
        <div className="border-ink-700 flex items-center gap-1.5 border-b px-4 py-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="bg-ink-600 h-2.5 w-2.5 rounded-full" />
          ))}
          <span className="ml-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {FEATURES[active].title}
          </span>
        </div>
        <div className="relative aspect-[820/360] bg-[#0b1014]">
          {FEATURES.map(({ title, Scene }, i) => (
            <div
              key={title}
              id={`feature-slide-${i}`}
              role="tabpanel"
              aria-label={title}
              aria-hidden={i !== active}
              className={`absolute inset-0 transition-all duration-700 ease-out motion-reduce:transition-none ${
                i === active
                  ? "translate-x-0 scale-100 opacity-100"
                  : i < active
                    ? "-translate-x-8 scale-[0.98] opacity-0"
                    : "translate-x-8 scale-[0.98] opacity-0"
              }`}
            >
              <Scene animate={!reduced && i === active} cycle={cycle} />
            </div>
          ))}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Features"
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FEATURES.map((f, i) => (
          <button
            key={f.title}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`feature-slide-${i}`}
            onClick={() => go(i)}
            className={`relative overflow-hidden rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
              i === active
                ? "border-turq/50 bg-ink-800"
                : "border-ink-700 bg-ink-900 hover:bg-ink-800"
            }`}
          >
            <h3 className={`font-bold ${i === active ? "text-white" : "text-slate-200"}`}>
              {f.title}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
            <span className="bg-ink-700 absolute inset-x-0 bottom-0 h-0.5">
              <span
                className="bg-turq block h-full transition-[width] duration-100 ease-linear"
                style={{
                  width: i === active ? `${reduced ? 100 : (elapsed / SLIDE_MS) * 100}%` : "0%",
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

type SceneProps = { animate: boolean; cycle: number };

const C = {
  bg: "#0b1014",
  card: "#16222a",
  line: "#6b7f8a",
  turq: "#40e0d0",
  text: "#e2e8f0",
  dim: "#94a3b8",
};

function Svg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 820 360" className="block h-full w-full" role="img" aria-label={label}>
      <defs>
        <radialGradient id="fc-wash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fc-storm" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#f97316" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>
      {children}
    </svg>
  );
}

// SMIL timing counts from page load, so an animation added later would
// already be "over". Each one waits (begin="indefinite") and starts here when
// its slide mounts it; the cycle key remounts it on every visit.
const start = (el: SVGAnimationElement | null) => el?.beginElement();

type Dot = { x: number; y: number; level: number };

// Measures each path and places checkpoints evenly along it.
function useDotsOnPaths(levels: number[][]) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const [dots, setDots] = useState<Dot[][]>([]);
  useLayoutEffect(() => {
    setDots(
      levels.map((lv, i) => {
        const path = paths.current[i];
        if (!path) return [];
        const len = path.getTotalLength();
        return lv.map((level, k) => {
          const p = path.getPointAtLength((len * (k + 1)) / (lv.length + 1));
          return { x: p.x, y: p.y, level };
        });
      }),
    );
    // Levels are constants per scene; measuring once is enough.
  }, []);
  return { paths, dots };
}

function Checkpoint({ x, y, level, r = 6 }: Dot & { r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={LEVELS[level].color} stroke={C.bg} strokeWidth="2" />;
}

function Endpoints({ from, to }: { from: [number, number]; to: [number, number] }) {
  return (
    <>
      <circle cx={from[0]} cy={from[1]} r="8" fill={C.bg} stroke="#fff" strokeWidth="3" />
      <rect
        x={to[0] - 8}
        y={to[1] - 8}
        width="16"
        height="16"
        rx="3"
        transform={`rotate(45 ${to[0]} ${to[1]})`}
        fill={C.turq}
        stroke="#fff"
        strokeWidth="3"
      />
    </>
  );
}

function Tag({ x, y, title, value }: { x: number; y: number; title: string; value: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="236" height="64" rx="10" fill={C.card} stroke={C.turq} strokeOpacity="0.5" />
      <text x="14" y="24" fill={C.turq} fontSize="11" fontWeight="700" letterSpacing="1">
        {title}
      </text>
      <text x="14" y="46" fill={C.text} fontSize="14" fontWeight="700">
        {value}
      </text>
    </g>
  );
}

const ROUTES = [
  "M60 250 C 180 120, 330 120, 480 150 S 680 120, 760 90",
  "M60 250 C 200 260, 360 230, 500 220 S 690 160, 760 90",
  "M60 250 C 160 330, 380 330, 540 280 S 700 170, 760 90",
];
const ROUTE_LEVELS = [
  [0, 0, 0, 1, 0, 0],
  [0, 1, 2, 1, 0],
  [0, 2, 3, 2, 1],
];

// 1. Three routes; the recommended one avoids the storm on the southern route.
function RoutesScene({ animate, cycle }: SceneProps) {
  const { paths, dots } = useDotsOnPaths(ROUTE_LEVELS);
  const storm = dots[2]?.[2];
  return (
    <Svg label="Three compared routes; the recommended one avoids a storm">
      <ellipse cx="400" cy="190" rx="420" ry="190" fill="url(#fc-wash)" />
      {storm && <ellipse cx={storm.x} cy={storm.y} rx="150" ry="80" fill="url(#fc-storm)" />}
      {[2, 1, 0].map((i) => (
        <path
          key={i}
          ref={(el) => {
            paths.current[i] = el;
          }}
          d={ROUTES[i]}
          fill="none"
          stroke={i === 0 ? C.turq : C.line}
          strokeWidth={i === 0 ? 5 : 3}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={animate ? 1 : undefined}
          strokeDashoffset={animate ? 1 : undefined}
        >
          {animate && (
            <animate
              begin="indefinite"
              ref={start}
              key={cycle}
              attributeName="stroke-dashoffset"
              from="1"
              to="0"
              dur={`${0.9 + i * 0.25}s`}
              fill="freeze"
            />
          )}
        </path>
      ))}
      {dots.flat().map((d) => (
        <Checkpoint key={`${d.x.toFixed(1)}-${d.y.toFixed(1)}`} {...d} />
      ))}
      <Endpoints from={[60, 250]} to={[760, 90]} />
      <Tag x={40} y={24} title="★ RECOMMENDED" value="Route A · 0 Severe mi" />
    </Svg>
  );
}

const ETA_PATH = "M70 270 C 220 120, 420 300, 600 170 S 740 110, 760 100";
const ETA_STOPS = [
  { level: 0, label: "25 mi · 8:28" },
  { level: 0, label: "50 mi · 8:55" },
  { level: 1, label: "75 mi · 9:24" },
  { level: 2, label: "100 mi · 9:51" },
  { level: 0, label: "125 mi · 10:19" },
];

// 2. A truck drives the route; each checkpoint shows the hour it is reached.
function EtaScene({ animate, cycle }: SceneProps) {
  const { paths, dots } = useDotsOnPaths([ETA_STOPS.map((s) => s.level)]);
  return (
    <Svg label="Checkpoints every 25 miles, each with the truck's arrival time">
      <ellipse cx="420" cy="200" rx="420" ry="190" fill="url(#fc-wash)" />
      <path
        ref={(el) => {
          paths.current[0] = el;
        }}
        id="fc-eta-path"
        d={ETA_PATH}
        fill="none"
        stroke={C.turq}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {(dots[0] ?? []).map((d, i) => (
        <g key={i}>
          <Checkpoint {...d} r={7} />
          <g transform={`translate(${d.x - 52} ${d.y + (i % 2 ? 18 : -46)})`}>
            <rect width="104" height="28" rx="6" fill={C.card} stroke="#2c3f4a" />
            <text x="52" y="18" textAnchor="middle" fill={C.text} fontSize="12" fontWeight="600">
              {ETA_STOPS[i].label}
            </text>
          </g>
        </g>
      ))}
      <Endpoints from={[70, 270]} to={[760, 100]} />
      {animate && (
        <g key={cycle}>
          <rect
            x="-13"
            y="-8"
            width="26"
            height="16"
            rx="4"
            fill="#fff"
            stroke={C.bg}
            strokeWidth="2"
          />
          <rect x="5" y="-6" width="6" height="12" rx="2" fill={C.turq} />
          <animateMotion
            begin="indefinite"
            ref={start}
            dur="4.6s"
            fill="freeze"
            rotate="auto"
            calcMode="linear"
          >
            <mpath href="#fc-eta-path" />
          </animateMotion>
        </g>
      )}
      <Tag x={40} y={24} title="DEPART 8:00 · EVERY 25 MI" value="Forecast at each ETA" />
    </Svg>
  );
}

// 3. One wind speed, two loads. A weight bar with the 30,000 lb limit marked
// shows why the same wind grades differently: the heavier truck crosses it.
const LOAD_SCALE_LB = 50_000;
const LOAD_LIMIT_LB = 30_000;

function Truck({ weight }: { weight: string }) {
  return (
    <g>
      <rect width="150" height="50" rx="6" fill="#2c3f4a" />
      <rect x="6" y="6" width="138" height="3" rx="1.5" fill="#3b5260" />
      <text x="75" y="33" textAnchor="middle" fill={C.text} fontSize="15" fontWeight="700">
        {weight}
      </text>
      <path d="M156 50 V18 a6 6 0 0 1 6 -6 h22 l14 16 v22 z" fill="#3b5260" />
      <path d="M166 18 h16 l9 11 h-25 z" fill="#0f171c" />
      {[22, 52, 128, 180].map((x) => (
        <g key={x}>
          <circle cx={x} cy="56" r="10" fill={C.bg} stroke={C.dim} strokeWidth="3" />
          <circle cx={x} cy="56" r="3" fill={C.dim} />
        </g>
      ))}
    </g>
  );
}

function LoadCard(props: {
  x: number;
  weightLb: number;
  level: number;
  reason: string;
  animate: boolean;
  cycle: number;
}) {
  const { x, weightLb, level, reason, animate, cycle } = props;
  const barW = 282;
  const fillW = (barW * weightLb) / LOAD_SCALE_LB;
  const limitX = 24 + (barW * LOAD_LIMIT_LB) / LOAD_SCALE_LB;
  const over = weightLb > LOAD_LIMIT_LB;
  const color = LEVELS[level].color;
  return (
    <g transform={`translate(${x} 104)`}>
      <rect
        width="330"
        height="236"
        rx="14"
        fill={C.card}
        stroke={over ? color : "#2c3f4a"}
        strokeOpacity={over ? 0.6 : 1}
      />
      <g transform="translate(70 18)">
        <Truck weight={`${weightLb.toLocaleString("en-US")} lb`} />
      </g>

      <text x="24" y="122" fill={C.dim} fontSize="11" fontWeight="700" letterSpacing="1">
        GROSS WEIGHT
      </text>
      <text x={limitX} y="122" textAnchor="middle" fill={C.turq} fontSize="11" fontWeight="700">
        30,000 lb limit
      </text>
      <rect x="24" y="132" width={barW} height="8" rx="4" fill="#0f171c" />
      <rect x="24" y="132" width={fillW} height="8" rx="4" fill={over ? color : C.dim}>
        {animate && (
          <animate
            begin="indefinite"
            ref={start}
            key={cycle}
            attributeName="width"
            from="0"
            to={fillW}
            dur="1.2s"
            fill="freeze"
            calcMode="spline"
            keySplines="0.2 0.8 0.2 1"
          />
        )}
      </rect>
      <line
        x1={limitX}
        x2={limitX}
        y1="127"
        y2="145"
        stroke={C.turq}
        strokeWidth="2"
        strokeDasharray="3 2"
      />
      <text x="24" y="160" fill="#64748b" fontSize="10">
        0
      </text>
      <text x={24 + barW} y="160" textAnchor="end" fill="#64748b" fontSize="10">
        50,000 lb
      </text>

      <text x="24" y="188" fill={C.dim} fontSize="11" fontWeight="700" letterSpacing="1">
        RISK
      </text>
      <text x="24" y="216" fill={color} fontSize="24" fontWeight="800">
        {LEVELS[level].label}
      </text>
      <text x={24 + barW} y="214" textAnchor="end" fill={C.dim} fontSize="12">
        {reason}
      </text>
    </g>
  );
}

function LoadScene({ animate, cycle }: SceneProps) {
  return (
    <Svg label="At 47 mph wind, a 25,000 lb truck is Severe and a 35,000 lb truck is No Travel, because 45 to 54 mph over 30,000 lb is No Travel">
      <g transform="translate(410 0)">
        <rect
          x="-150"
          y="28"
          width="300"
          height="46"
          rx="23"
          fill={C.card}
          stroke={C.turq}
          strokeOpacity="0.45"
        />
        <g transform="translate(-134 51)">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M0 ${-8 + i * 8} q 8 -4 16 0 t 16 0`}
              fill="none"
              stroke={C.turq}
              strokeWidth="2"
              strokeLinecap="round"
            >
              {animate && (
                <animateTransform
                  begin="indefinite"
                  ref={start}
                  key={cycle}
                  attributeName="transform"
                  type="translate"
                  values="-3 0; 3 0; -3 0"
                  dur={`${1.4 + i * 0.3}s`}
                  repeatCount="indefinite"
                />
              )}
            </path>
          ))}
        </g>
        <text x="24" y="57" textAnchor="middle" fill={C.text} fontSize="17" fontWeight="800">
          47 mph wind
          <tspan fill={C.dim} fontSize="12" fontWeight="600" dx="8">
            45–54 mph band
          </tspan>
        </text>
        <path
          d="M-60 74 C -60 92, -185 88, -185 104"
          fill="none"
          stroke="#2c3f4a"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M60 74 C 60 92, 185 88, 185 104"
          fill="none"
          stroke="#2c3f4a"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </g>
      <LoadCard
        x={60}
        weightLb={25_000}
        level={3}
        reason="under the limit"
        animate={animate}
        cycle={cycle}
      />
      <LoadCard
        x={430}
        weightLb={35_000}
        level={4}
        reason="over the limit"
        animate={animate}
        cycle={cycle}
      />
    </Svg>
  );
}

// 4. The corridor over 48 hours: a storm cell crosses as the slider moves.
function CorridorScene({ animate, cycle }: SceneProps) {
  const route = "M80 200 C 240 120, 420 260, 560 180 S 720 120, 760 130";
  return (
    <Svg label="Corridor heatmap: a storm crosses the route over the next 48 hours">
      <defs>
        <filter id="fc-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <g filter="url(#fc-blur)" opacity="0.8">
        <path d={route} fill="none" stroke="#22c55e" strokeOpacity="0.35" strokeWidth="90" />
        <g key={cycle}>
          <ellipse cx="180" cy="190" rx="70" ry="55" fill="#eab308" opacity="0.7">
            {animate && (
              <animate
                begin="indefinite"
                ref={start}
                attributeName="cx"
                from="180"
                to="680"
                dur="4.6s"
                fill="freeze"
              />
            )}
          </ellipse>
          <ellipse cx="180" cy="190" rx="38" ry="30" fill="#ef4444" opacity="0.8">
            {animate && (
              <animate
                begin="indefinite"
                ref={start}
                attributeName="cx"
                from="180"
                to="680"
                dur="4.6s"
                fill="freeze"
              />
            )}
          </ellipse>
        </g>
      </g>
      <path d={route} fill="none" stroke={C.turq} strokeWidth="4" strokeLinecap="round" />
      <Endpoints from={[80, 200]} to={[760, 130]} />
      <g transform="translate(160 300)">
        <rect width="500" height="6" y="-3" rx="3" fill="#2c3f4a" />
        <circle key={cycle} cx="0" cy="0" r="10" fill={C.turq} stroke={C.bg} strokeWidth="3">
          {animate && (
            <animate
              begin="indefinite"
              ref={start}
              attributeName="cx"
              from="0"
              to="500"
              dur="4.6s"
              fill="freeze"
            />
          )}
        </circle>
        {[0, 12, 24, 36, 48].map((h) => (
          <text key={h} x={(h / 48) * 500} y="30" textAnchor="middle" fill={C.dim} fontSize="12">
            {h}h
          </text>
        ))}
      </g>
      <Tag x={40} y={24} title="CORRIDOR · 0–48 H" value="Storm crosses the route" />
    </Svg>
  );
}
