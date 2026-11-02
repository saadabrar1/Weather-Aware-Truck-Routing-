import Shield from "./Shield";

// What the map's lines and marks mean. The risk scale has its own key in the
// forecast bar, so it is not repeated here.
export default function MapLegend() {
  return (
    <div className="border-rule w-56 rounded-md border bg-white/95 p-2.5 text-[12px] shadow-sm">
      <ul className="text-ink-2 space-y-1.5">
        <Item swatch={<Shield letter="A" recommended size={18} />}>Recommended route</Item>
        <Item swatch={<Shield letter="B" recommended={false} size={18} />}>Alternative route</Item>
        <Item swatch={<Line color="#1f4e9c" thick />}>Selected route is drawn thicker</Item>
        <Item
          swatch={
            <span className="border-ink inline-block h-3 w-3 rounded-full border-[3px] bg-white" />
          }
        >
          Start
        </Item>
        <Item swatch={<span className="bg-ink inline-block h-2.5 w-2.5 rotate-45 rounded-[1px]" />}>
          Destination
        </Item>
        <Item
          swatch={
            <span className="bg-ink ring-shield/30 inline-block h-3 w-3 rounded-full border-2 border-white ring-4" />
          }
        >
          Truck at the chosen hour
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

function Line({ color, thick }: { color: string; thick?: boolean }) {
  return (
    <span
      className={`inline-block w-6 rounded-full ${thick ? "h-[5px]" : "h-[3px]"}`}
      style={{ background: color }}
    />
  );
}
