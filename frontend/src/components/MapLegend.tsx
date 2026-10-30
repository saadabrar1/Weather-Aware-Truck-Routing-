// What the map's lines and pins mean. Risk colours have their own legend on
// the forecast panel, so they are not repeated here.
export default function MapLegend() {
  return (
    <div className="border-ink-600 bg-ink-900/90 w-52 rounded-xl border p-3 text-xs text-slate-300 shadow-xl backdrop-blur">
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Map key
      </div>
      <ul className="space-y-1.5">
        <Item swatch={<Line color="#40e0d0" />}>Recommended route</Item>
        <Item swatch={<Line color="#7b8f9a" />}>Alternative route</Item>
        <Item swatch={<Line color="#e2e8f0" thick glow />}>Selected (thicker, glowing)</Item>
        <Item
          swatch={
            <span className="bg-ink-950 inline-block h-3 w-3 rounded-full border-[3px] border-white" />
          }
        >
          Origin
        </Item>
        <Item
          swatch={
            <span className="bg-turq inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-white" />
          }
        >
          Destination
        </Item>
        <Item
          swatch={
            <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-r from-green-500 via-orange-500 to-purple-500" />
          }
        >
          Checkpoint, coloured by risk
        </Item>
      </ul>
    </div>
  );
}

function Item({ swatch, children }: { swatch: React.ReactNode; children: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex w-6 justify-center">{swatch}</span>
      {children}
    </li>
  );
}

function Line({ color, thick, glow }: { color: string; thick?: boolean; glow?: boolean }) {
  return (
    <span
      className={`inline-block w-6 rounded-full ${thick ? "h-1.5" : "h-1"}`}
      style={{ background: color, boxShadow: glow ? `0 0 6px ${color}` : undefined }}
    />
  );
}
