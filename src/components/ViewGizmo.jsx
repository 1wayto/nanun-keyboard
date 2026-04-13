export default function ViewGizmo({ theta, phi, onSnap }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 30;

  const project = (vx, vy, vz) => {
    const x = vx * Math.cos(theta) + vz * Math.sin(theta);
    const y = -vx * Math.sin(theta) * Math.cos(phi) + vy * Math.sin(phi) - vz * Math.cos(theta) * Math.cos(phi);
    return [x * scale, -y * scale];
  };

  const axes = [
    { label: "X", color: "#e05050", vec: [1, 0, 0], snapT: -Math.PI / 2, snapP: Math.PI / 2 },
    { label: "Y", color: "#50c050", vec: [0, 1, 0], snapT: 0, snapP: 0.01 },
    { label: "Z", color: "#5080e0", vec: [0, 0, 1], snapT: 0, snapP: Math.PI / 2 },
  ];

  const negAxes = [
    { label: "X", color: "#e05050", vec: [-1, 0, 0], snapT: Math.PI / 2, snapP: Math.PI / 2 },
    { label: "Y", color: "#50c050", vec: [0, -1, 0], snapT: 0, snapP: Math.PI - 0.01 },
    { label: "Z", color: "#5080e0", vec: [0, 0, -1], snapT: Math.PI, snapP: Math.PI / 2 },
  ];

  // Sort all axis endpoints by depth (z in camera space) so we draw back-to-front
  const allEnds = [];
  for (const a of axes) {
    const [px, py] = project(a.vec[0], a.vec[1], a.vec[2]);
    // Depth: project onto camera forward direction (higher = further away)
    const depth = a.vec[0] * Math.sin(phi) * Math.cos(theta) + a.vec[1] * Math.cos(phi) + a.vec[2] * Math.sin(phi) * Math.sin(theta);
    allEnds.push({ ...a, px, py, depth, neg: false });
  }
  for (const a of negAxes) {
    const [px, py] = project(a.vec[0], a.vec[1], a.vec[2]);
    const depth = a.vec[0] * Math.sin(phi) * Math.cos(theta) + a.vec[1] * Math.cos(phi) + a.vec[2] * Math.sin(phi) * Math.sin(theta);
    allEnds.push({ ...a, px, py, depth, neg: true });
  }
  // Sort: draw furthest away first (painters algorithm)
  allEnds.sort((a, b) => a.depth - b.depth);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ cursor: "pointer", opacity: 0.85 }}
    >
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={38} fill="#1e1e22" fillOpacity={0.6} stroke="#444" strokeWidth={0.5} />

      {/* Draw axes sorted by depth */}
      {allEnds.map((a, i) => {
        const tipX = cx + a.px;
        const tipY = cy + a.py;
        const r = a.neg ? 5 : 8;
        const opacity = a.neg ? 0.4 : 1;
        return (
          <g key={`${a.label}-${a.neg ? "neg" : "pos"}-${i}`}>
            <line
              x1={cx}
              y1={cy}
              x2={tipX}
              y2={tipY}
              stroke={a.color}
              strokeWidth={a.neg ? 1 : 1.5}
              strokeOpacity={opacity}
            />
            <circle
              cx={tipX}
              cy={tipY}
              r={r}
              fill={a.color}
              fillOpacity={opacity}
              stroke="none"
              onClick={(e) => {
                e.stopPropagation();
                if (onSnap) onSnap(a.snapT, a.snapP);
              }}
            />
            {!a.neg && (
              <text
                x={tipX}
                y={tipY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={8}
                fontWeight={700}
                fontFamily="sans-serif"
                pointerEvents="none"
              >
                {a.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
