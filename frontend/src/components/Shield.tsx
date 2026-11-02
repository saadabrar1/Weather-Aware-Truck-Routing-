// Route marks drawn after US highway shields: the recommended route wears the
// blue Interstate shield, alternatives the black-on-white US-route shield.
// The same mark appears in the list, the table and on the map.

const INTERSTATE = "M3 6 Q3 2.5 7 3 Q16 4.5 25 3 Q29 2.5 29 6 L29 14 Q29 26 16 31 Q3 26 3 14 Z";
const US_ROUTE =
  "M6 3 L26 3 Q27.5 3 27.5 4.5 Q26 9 28 13 Q29.5 17 27 22 Q23.5 28.5 16 31 Q8.5 28.5 5 22 Q2.5 17 4 13 Q6 9 4.5 4.5 Q4.5 3 6 3 Z";

type Props = {
  letter: string;
  recommended: boolean;
  size?: number;
  className?: string;
};

export default function Shield({ letter, recommended, size = 28, className }: Props) {
  return (
    <svg
      viewBox="0 0 32 34"
      width={size}
      height={(size * 34) / 32}
      className={className}
      role="img"
      aria-label={`Route ${letter}${recommended ? ", recommended" : ""}`}
    >
      {recommended ? (
        <>
          <path d={INTERSTATE} fill="#1f4e9c" stroke="#ffffff" strokeWidth="1.6" />
          <path
            d="M4.2 6 Q4.2 3.8 7 4.2 Q16 5.7 25 4.2 Q27.8 3.8 27.8 6 L27.8 9.5 L4.2 9.5 Z"
            fill="#c8102e"
          />
        </>
      ) : (
        <path d={US_ROUTE} fill="#ffffff" stroke="#13253a" strokeWidth="2" />
      )}
      <text
        x="16"
        y={recommended ? 24.5 : 23}
        textAnchor="middle"
        fontFamily="Overpass, sans-serif"
        fontWeight="800"
        fontSize={recommended ? 14 : 15}
        fill={recommended ? "#ffffff" : "#13253a"}
      >
        {letter}
      </text>
    </svg>
  );
}

/** The same shield as an HTML string, for MapLibre DOM markers. */
export function shieldSvg(letter: string, recommended: boolean, size = 30): string {
  const body = recommended
    ? `<path d="${INTERSTATE}" fill="#1f4e9c" stroke="#ffffff" stroke-width="1.6"/>` +
      `<path d="M4.2 6 Q4.2 3.8 7 4.2 Q16 5.7 25 4.2 Q27.8 3.8 27.8 6 L27.8 9.5 L4.2 9.5 Z" fill="#c8102e"/>`
    : `<path d="${US_ROUTE}" fill="#ffffff" stroke="#13253a" stroke-width="2"/>`;
  const y = recommended ? 24.5 : 23;
  const fill = recommended ? "#ffffff" : "#13253a";
  return (
    `<svg viewBox="0 0 32 34" width="${size}" height="${(size * 34) / 32}" aria-hidden="true">` +
    body +
    `<text x="16" y="${y}" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="800" font-size="${recommended ? 14 : 15}" fill="${fill}">${letter}</text></svg>`
  );
}
