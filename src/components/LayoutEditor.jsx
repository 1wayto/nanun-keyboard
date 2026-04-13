import { useRef, useCallback, useEffect } from "react";
import { C, UNIT, CUTOUT, ACCENT_LABELS } from "../constants";
import { snap, isISOEnter } from "../utils";

export default function LayoutEditor({ keys, selectedId, onSelect, onMove }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const minKX = keys.length ? Math.min(...keys.map((k) => (isISOEnter(k) ? k.x - 0.25 : k.x))) : 0;
  const minKY = keys.length ? Math.min(...keys.map((k) => k.y)) : 0;
  const maxX = keys.length ? Math.max(...keys.map((k) => k.x + k.w)) : 4;
  const maxY = keys.length ? Math.max(...keys.map((k) => k.y + (k.h || 1))) : 2;
  const pad = 0.8,
    vw = maxX - minKX + pad * 2,
    vh = maxY - minKY + pad * 2,
    ox = minKX - pad,
    oy = minKY - pad;

  const toSVG = useCallback(
    (e) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: ((cx - r.left) / r.width) * vw + ox, y: ((cy - r.top) / r.height) * vh + oy };
    },
    [vw, vh, ox, oy],
  );

  const hDown = (e, key) => {
    e.stopPropagation();
    onSelect(key.id);
    const p = toSVG(e);
    dragRef.current = { id: key.id, offX: p.x - key.x, offY: p.y - key.y };
  };

  const hMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      const p = toSVG(e);
      onMove(dragRef.current.id, Math.max(0, snap(p.x - dragRef.current.offX)), Math.max(0, snap(p.y - dragRef.current.offY)));
    },
    [toSVG, onMove],
  );

  const hUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", hMove);
    window.addEventListener("mouseup", hUp);
    window.addEventListener("touchmove", hMove);
    window.addEventListener("touchend", hUp);
    return () => {
      window.removeEventListener("mousemove", hMove);
      window.removeEventListener("mouseup", hUp);
      window.removeEventListener("touchmove", hMove);
      window.removeEventListener("touchend", hUp);
    };
  }, [hMove, hUp]);

  const grids = [];
  for (let i = Math.floor(minKX - 1); i <= Math.ceil(maxX + 1); i++)
    grids.push(<line key={`v${i}`} x1={i} y1={minKY - 1} x2={i} y2={maxY + 1} stroke={C.border} strokeOpacity={0.25} strokeWidth={0.012} />);
  for (let i = Math.floor(minKY - 1); i <= Math.ceil(maxY + 1); i++)
    grids.push(<line key={`h${i}`} x1={minKX - 1} y1={i} x2={maxX + 1} y2={i} stroke={C.border} strokeOpacity={0.25} strokeWidth={0.012} />);

  return (
    <svg
      ref={svgRef}
      viewBox={`${ox} ${oy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", minHeight: 200, cursor: "crosshair", display: "block", background: C.bg }}
      onMouseDown={() => onSelect(null)}
      onTouchStart={() => onSelect(null)}
    >
      <defs>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <rect x={ox} y={oy} width={vw} height={vh} fill={C.bg} />
      <rect x={ox} y={oy} width={vw} height={vh} filter="url(#noise)" opacity="0.03" />
      {grids}
      {keys.map((k) => {
        const sel = k.id === selectedId;
        const g = 0.04;
        const kh = k.h || 1;
        const isA = ACCENT_LABELS.has(k.label);
        const isISO = isISOEnter(k);
        const fs = k.w < 1.2 && k.label.length > 2 ? 0.18 : k.label.length > 3 ? 0.21 : 0.26;

        // ISO Enter L-shape path
        if (isISO) {
          const lx = k.x - 0.25 + g,
            rx = k.x + k.w - g,
            ty = k.y + g,
            by = k.y + kh - g;
          const mx = k.x + g,
            my = k.y + 1;
          const r = 0.06;

          // L-shape with rounded corners — 6 outer convex + 1 inner concave corner
          // Path goes clockwise: top-left → top-right → bottom-right → bottom-inner → inner-corner → left-mid → back to top-left
          const d = [
            `M${lx + r} ${ty}`,                                              // start top-left (after corner)
            `L${rx - r} ${ty}`,                                              // top edge
            `A${r} ${r} 0 0 1 ${rx} ${ty + r}`,                            // top-right corner
            `L${rx} ${by - r}`,                                              // right edge
            `A${r} ${r} 0 0 1 ${rx - r} ${by}`,                            // bottom-right corner
            `L${mx + r} ${by}`,                                              // bottom edge
            `A${r} ${r} 0 0 1 ${mx} ${by - r}`,                            // bottom-left corner (narrow part)
            `L${mx} ${my + r}`,                                              // inner left edge going up
            `A${r} ${r} 0 0 0 ${mx + r} ${my}`,                            // INNER corner (concave, counter-clockwise)
            `L${lx + r} ${my}`,                                              // mid horizontal edge
            `A${r} ${r} 0 0 1 ${lx} ${my - r}`,                            // left-mid corner
            `L${lx} ${ty + r}`,                                              // left edge going up
            `A${r} ${r} 0 0 1 ${lx + r} ${ty}`,                            // top-left corner
          ].join(" ");

          // Shadow path (offset)
          const o = 0.02;
          const ds = d.replace(/[\d.]+/g, (match, offset, str) => {
            // Simple shadow offset — just use the same path shifted
            return match;
          });
          // Build shadow separately with offset
          const dsShadow = [
            `M${lx + r + o} ${ty + o}`,
            `L${rx - r + o} ${ty + o}`,
            `A${r} ${r} 0 0 1 ${rx + o} ${ty + r + o}`,
            `L${rx + o} ${by - r + o}`,
            `A${r} ${r} 0 0 1 ${rx - r + o} ${by + o}`,
            `L${mx + r + o} ${by + o}`,
            `A${r} ${r} 0 0 1 ${mx + o} ${by - r + o}`,
            `L${mx + o} ${my + r + o}`,
            `A${r} ${r} 0 0 0 ${mx + r + o} ${my + o}`,
            `L${lx + r + o} ${my + o}`,
            `A${r} ${r} 0 0 1 ${lx + o} ${my - r + o}`,
            `L${lx + o} ${ty + r + o}`,
            `A${r} ${r} 0 0 1 ${lx + r + o} ${ty + o}`,
          ].join(" ");

          return (
            <g key={k.id} onMouseDown={(e) => hDown(e, k)} onTouchStart={(e) => hDown(e, k)}>
              <path d={dsShadow} fill="#00000030" />
              <path
                d={d}
                fill={sel ? C.keySelected : C.keyAccent}
                stroke={sel ? C.keySelectedBorder : C.keyAccentBorder}
                strokeWidth={sel ? 0.035 : 0.018}
                style={{ cursor: "grab" }}
              />
              <text
                x={k.x + k.w / 2 - 0.1}
                y={k.y + kh / 2 + 0.08}
                textAnchor="middle"
                fill={sel ? C.accent : "#b89060"}
                fontSize={0.26}
                fontFamily="'Plus Jakarta Sans',sans-serif"
                fontWeight={600}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {k.label}
              </text>
            </g>
          );
        }

        return (
          <g key={k.id} onMouseDown={(e) => hDown(e, k)} onTouchStart={(e) => hDown(e, k)}>
            <rect x={k.x + g + 0.02} y={k.y + g + 0.02} width={k.w - g * 2} height={kh - g * 2} rx={0.07} fill="#00000030" />
            <rect
              x={k.x + g}
              y={k.y + g}
              width={k.w - g * 2}
              height={kh - g * 2}
              rx={0.07}
              fill={sel ? C.keySelected : isA ? C.keyAccent : C.keySurface}
              stroke={sel ? C.keySelectedBorder : isA ? C.keyAccentBorder : C.keyBorder}
              strokeWidth={sel ? 0.035 : 0.018}
              style={{ cursor: "grab" }}
            />
            <rect
              x={k.x + 0.1}
              y={k.y + 0.08}
              width={k.w - 0.2}
              height={kh - 0.22}
              rx={0.05}
              fill="none"
              stroke={sel ? `${C.accent}40` : `${C.border}30`}
              strokeWidth={0.01}
            />
            <rect
              x={k.x + k.w / 2 - CUTOUT / UNIT / 2}
              y={k.y + kh / 2 - CUTOUT / UNIT / 2}
              width={CUTOUT / UNIT}
              height={CUTOUT / UNIT}
              rx={0.015}
              fill="none"
              stroke={sel ? `${C.accent}25` : `${C.border}15`}
              strokeWidth={0.008}
              strokeDasharray="0.025 0.02"
            />
            <text
              x={k.x + k.w / 2}
              y={k.y + kh / 2 + 0.08}
              textAnchor="middle"
              fill={sel ? C.accent : isA ? "#b89060" : C.textMuted}
              fontSize={fs}
              fontFamily="'Plus Jakarta Sans',sans-serif"
              fontWeight={600}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {k.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
