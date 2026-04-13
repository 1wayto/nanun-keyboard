import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { C, KEY_SIZES, FONT_PRIMARY, FONT_MONO, inputStyle, setTheme, THEMES } from "../constants";
import { getBounds } from "../utils";
import { PRESETS } from "../layouts";
import { exportSVG, exportDXF, exportKLE, importKLE, exportKiCadCSV, download } from "../export";
import ThreePreview from "./ThreePreview";
import LayoutEditor from "./LayoutEditor";
import ViewGizmo from "./ViewGizmo";
import LayersPanel from "./LayersPanel";
import { BtnSmall, SectionLabel, PropLabel, ExportBtn, GitHubIcon } from "./ui";
import HowToModal from "./HowToModal";

export default function App() {
  const [themeMode, setThemeMode] = useState("light");
  const toggleTheme = () => {
    const next = themeMode === "light" ? "dark" : "light";
    setTheme(next);
    setThemeMode(next);
  };

  const [keys, setKeys] = useState(PRESETS["60% ANSI"]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("layout");
  const [plateSettings, setPlateSettings] = useState({ thickness: 1.5, margin: 5, cornerRadius: 2 });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [opts3d, setOpts3d] = useState({ switches: false, capProfile: "cherry", caseStyle: "tray", slope: 6, ledEnabled: false, ledFacing: "south", ledMode: "static", ledBrightness: 80, ledSpeed: 1.0, cameraMode: "perspective", switchExplode: 0, layerExplode: 0, showPlate: true, showPCB: true });
  const [layersPanelCollapsed, setLayersPanelCollapsed] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [camAngles, setCamAngles] = useState({ theta: Math.PI / 4, phi: Math.PI / 3.5 });
  const selectedKey = keys.find((k) => k.id === selectedId) || null;
  const nextId = useRef(2000);
  const previewRef = useRef(null);

  const updateKey = (id, patch) => setKeys((p) => p.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const moveKey = useCallback((id, x, y) => setKeys((p) => p.map((k) => (k.id === id ? { ...k, x, y } : k))), []);
  const addKey = () => {
    const mx = keys.length ? Math.max(...keys.map((k) => k.x + k.w)) : 0;
    const my = keys.length ? Math.max(...keys.map((k) => k.y)) : 0;
    const id = nextId.current++;
    setKeys((p) => [...p, { id, x: mx, y: my, w: 1, h: 1, label: "K" }]);
    setSelectedId(id);
  };
  const deleteKey = () => {
    if (!selectedId) return;
    setKeys((p) => p.filter((k) => k.id !== selectedId));
    setSelectedId(null);
  };
  const loadPreset = (name) => {
    if (!PRESETS[name]) return;
    const off = nextId.current;
    setKeys(PRESETS[name].map((k, i) => ({ ...k, id: off + i })));
    nextId.current += PRESETS[name].length + 1;
    setSelectedId(null);
  };
  const handleImport = () => {
    const r = importKLE(importText);
    if (r) {
      const off = nextId.current;
      setKeys(r.map((k, i) => ({ ...k, id: off + i })));
      nextId.current += r.length + 1;
      setShowImport(false);
      setImportText("");
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteKey();
      }
      if (e.key === "ArrowLeft" && selectedId) {
        e.preventDefault();
        updateKey(selectedId, { x: Math.max(0, (selectedKey?.x || 0) - (e.shiftKey ? 1 : 0.25)) });
      }
      if (e.key === "ArrowRight" && selectedId) {
        e.preventDefault();
        updateKey(selectedId, { x: (selectedKey?.x || 0) + (e.shiftKey ? 1 : 0.25) });
      }
      if (e.key === "ArrowUp" && selectedId) {
        e.preventDefault();
        updateKey(selectedId, { y: Math.max(0, (selectedKey?.y || 0) - (e.shiftKey ? 1 : 0.25)) });
      }
      if (e.key === "ArrowDown" && selectedId) {
        e.preventDefault();
        updateKey(selectedId, { y: (selectedKey?.y || 0) + (e.shiftKey ? 1 : 0.25) });
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedKey]);

  const plateDims = useMemo(() => {
    const b = getBounds(keys, plateSettings.margin);
    return { w: (b.maxX - b.minX).toFixed(1), h: (b.maxY - b.minY).toFixed(1) };
  }, [keys, plateSettings.margin]);

  return (
    <div style={{ fontFamily: FONT_PRIMARY, background: C.bg, color: C.text, height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}::selection{background:${C.accent}40;color:${C.text}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* HEADER */}
      <header
        style={{
          padding: "0 16px",
          height: 48,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: `linear-gradient(180deg,${C.surfaceAlt} 0%,${C.bg} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.5 }}>nanun</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: C.textDim }}>.me</span>
          <div style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: C.textDim, letterSpacing: 1.5, textTransform: "uppercase" }}>keyboard studio</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {[
              ["layout", "Layout"],
              ["3d", "3D"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "4px 14px",
                  fontSize: 11,
                  fontFamily: FONT_PRIMARY,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: view === v ? C.accentDim : "transparent",
                  color: view === v ? C.accent : C.textDim,
                  transition: "all 0.15s",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={toggleTheme} style={{
            padding: "4px 10px", fontSize: 11, fontFamily: FONT_PRIMARY, fontWeight: 600,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer",
            background: "transparent", color: C.textMuted, transition: "0.15s",
          }}>
            {themeMode === "light" ? "☀" : "☽"}
          </button>
          <button onClick={() => setShowHowTo(true)} style={{
            width: 24, height: 24, fontSize: 13, fontWeight: 700,
            border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer",
            background: "transparent", color: C.textMuted, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 0,
          }}>
            ?
          </button>
          <a href="https://github.com/1wayto/nanun-keyboard" target="_blank" rel="noopener noreferrer" style={{ padding: 6, display: "flex", opacity: 0.6 }}>
            <GitHubIcon />
          </a>
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{ padding: "6px 16px", borderBottom: `1px solid ${C.border}22`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", background: C.bg }}>
        <select
          onChange={(e) => e.target.value && loadPreset(e.target.value)}
          value=""
          style={{
            background: C.surface,
            color: C.textMuted,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "5px 8px",
            fontSize: 11,
            fontFamily: FONT_PRIMARY,
            fontWeight: 500,
            cursor: "pointer",
            maxWidth: 140,
          }}
        >
          <option value="">Presets…</option>
          {Object.keys(PRESETS).map((p) =>
            PRESETS[p] === null ? (
              <option key={p} disabled style={{ color: C.textDim, fontWeight: 700, fontSize: 10 }}>{`── ${p.toUpperCase()} ──`}</option>
            ) : (
              <option key={p} value={p}>
                {p}
              </option>
            ),
          )}
        </select>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <BtnSmall accent onClick={addKey}>
          + Key
        </BtnSmall>
        <BtnSmall danger disabled={!selectedId} onClick={deleteKey}>
          Delete
        </BtnSmall>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <BtnSmall onClick={() => setShowImport(!showImport)}>KLE Import</BtnSmall>
        {view === "3d" && (
          <>
            <BtnSmall onClick={() => setOpts3d(o => ({...o, cameraMode: o.cameraMode === "perspective" ? "iso" : "perspective"}))}>
              {opts3d.cameraMode === "perspective" ? "Persp" : "ISO"}
            </BtnSmall>
            <BtnSmall onClick={() => previewRef.current?.focusView()}>Focus</BtnSmall>
          </>
        )}
        <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 10, color: C.textDim, display: "flex", gap: 12 }}>
          <span>{keys.length} keys</span>
          <span>
            {plateDims.w} × {plateDims.h} mm
          </span>
        </div>
      </div>

      {/* KLE IMPORT MODAL */}
      {showImport && (
        <div
          style={{
            position: "absolute",
            top: 96,
            left: 16,
            right: 16,
            zIndex: 100,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 16,
            boxShadow: "0 12px 40px #00000080",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Import KLE JSON</div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste KLE JSON here"
            style={{
              width: "100%",
              height: 100,
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 10,
              fontSize: 12,
              fontFamily: FONT_MONO,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <BtnSmall
              onClick={() => {
                setShowImport(false);
                setImportText("");
              }}
            >
              Cancel
            </BtnSmall>
            <BtnSmall accent onClick={handleImport}>
              Import
            </BtnSmall>
          </div>
        </div>
      )}

      {/* MAIN CANVAS */}
      <div style={{ flex: 1, position: "relative", minHeight: 420, overflow: "hidden" }}>
        {view === "layout" ? (
          <LayoutEditor keys={keys} selectedId={selectedId} onSelect={setSelectedId} onMove={moveKey} />
        ) : (
          <>
            <ThreePreview keys={keys} plateSettings={plateSettings} opts3d={opts3d}
              onReady={(ctrl) => { previewRef.current = ctrl; }}
              onCameraMove={setCamAngles} />
            <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
              <ViewGizmo theta={camAngles.theta} phi={camAngles.phi}
                onSnap={(t, p) => previewRef.current?.snapCamera(t, p)} />
            </div>
            <LayersPanel opts3d={opts3d} setOpts3d={setOpts3d}
              collapsed={layersPanelCollapsed} setCollapsed={setLayersPanelCollapsed} />
          </>
        )}
      </div>

      {/* BOTTOM PANEL */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          background: `linear-gradient(180deg,${C.surfaceAlt} 0%,${C.bg} 100%)`,
          padding: "10px 16px",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* Key props */}
        <div style={{ minWidth: 160 }}>
          <SectionLabel>Key</SectionLabel>
          {selectedKey ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <PropLabel label="Lbl">
                <input
                  type="text"
                  value={selectedKey.label}
                  onChange={(e) => updateKey(selectedId, { label: e.target.value })}
                  style={{ ...inputStyle, width: 52, fontFamily: FONT_MONO }}
                />
              </PropLabel>
              <PropLabel label="W">
                <select value={selectedKey.w} onChange={(e) => updateKey(selectedId, { w: parseFloat(e.target.value) })} style={{ ...inputStyle, width: 56 }}>
                  {KEY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}u
                    </option>
                  ))}
                </select>
              </PropLabel>
              <PropLabel label="H">
                <select
                  value={selectedKey.h || 1}
                  onChange={(e) => updateKey(selectedId, { h: parseFloat(e.target.value) })}
                  style={{ ...inputStyle, width: 50 }}
                >
                  {[1, 1.5, 2].map((s) => (
                    <option key={s} value={s}>
                      {s}u
                    </option>
                  ))}
                </select>
              </PropLabel>
            </div>
          ) : (
            <span style={{ color: C.textDim, fontSize: 10, fontStyle: "italic" }}>Select a key</span>
          )}
        </div>

        {/* Plate */}
        <div style={{ minWidth: 180 }}>
          <SectionLabel>Plate</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["T", "thickness", 0.5, 5],
              ["M", "margin", 1, 20],
              ["R", "cornerRadius", 0, 10],
            ].map(([l, k, mn, mx]) => (
              <PropLabel key={k} label={l}>
                <input
                  type="number"
                  step={0.5}
                  min={mn}
                  max={mx}
                  value={plateSettings[k]}
                  onChange={(e) => setPlateSettings((p) => ({ ...p, [k]: parseFloat(e.target.value) || mn }))}
                  style={{ ...inputStyle, width: 40, fontFamily: FONT_MONO }}
                />
                <span style={{ fontSize: 9, color: C.textDim }}>mm</span>
              </PropLabel>
            ))}
          </div>
        </div>

        {/* 3D options now in floating LayersPanel */}

        {/* Export */}
        <div style={{ minWidth: 200 }}>
          <SectionLabel>Export</SectionLabel>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <ExportBtn label="SVG" sub="Plate" onClick={() => download(exportSVG(keys, plateSettings), "plate.svg", "image/svg+xml")} />
            <ExportBtn label="DXF" sub="Plate" onClick={() => download(exportDXF(keys, plateSettings), "plate.dxf")} />
            <ExportBtn label="JSON" sub="KLE" onClick={() => download(exportKLE(keys), "layout.json", "application/json")} />
            <ExportBtn label="CSV" sub="KiCad" onClick={() => download(exportKiCadCSV(keys), "switches.csv")} />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div
        style={{
          padding: "6px 16px",
          borderTop: `1px solid ${C.border}22`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 9,
          color: C.textDim,
          fontFamily: FONT_MONO,
          letterSpacing: 0.5,
        }}
      >
        <span>nanun.me · open-source keyboard design studio</span>
        <span style={{ display: "flex", gap: 10 }}>
          <span>MIT License</span>
          <span>v1.1</span>
        </span>
      </div>

      {/* How-To Modal */}
      {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
