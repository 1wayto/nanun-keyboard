import { useState } from "react";
import BuildScene from "./BuildScene";
import BuildPanel from "./BuildPanel";

// Root of the Build & Flash tab. Owns its own UI state separate from the
// (deactivated) opts3d preview state.
export default function BuildView({ keys }) {
  const [buildOpts, setBuildOpts] = useState({
    visible: {
      bottomCase: true,
      accessCover: true,
      electrical: true,
      switchPlate: true,
      topCase: true,
    },
    explode: 12,
    bedWidth: 220, // Adventurer 5M default
  });

  return (
    <>
      <BuildScene keys={keys} buildOpts={buildOpts} />
      <BuildPanel keys={keys} buildOpts={buildOpts} setBuildOpts={setBuildOpts} />
    </>
  );
}
