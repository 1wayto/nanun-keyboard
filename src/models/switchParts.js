import * as THREE from "three";

/**
 * Cherry MX switch — multi-part model based on engineering drawings.
 * All dimensions in mm. Origin at switch center, plate surface at Y=0.
 *
 * Assembled positions (Y axis):
 *  - Bottom housing: Y = -5 to 0  (below plate)
 *  - Top housing:    Y = 0 to 6.6 (above plate)
 *  - Spring:         Y = -2 to 4  (inside both housings)
 *  - Stem:           Y = 1 to 10.2 (inside + protruding above)
 *
 * Explode: ALL parts move UPWARD from plate level, stacking above each other.
 */

const DS = THREE.DoubleSide;

// ── Bottom Housing (Socket) ──
export function createBottomHousing(ledZ = -1) {
  const group = new THREE.Group();

  // Hollow outer shell — build walls individually for hollow interior
  const wallThick = 1.5;
  const bodyW = 14, bodyD = 14, bodyH = 5;

  // Four walls (hollow box)
  // Front wall
  const fWall = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, wallThick));
  fWall.position.set(0, -bodyH / 2, bodyD / 2 - wallThick / 2);
  group.add(fWall);
  // Back wall
  const bWall = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, wallThick));
  bWall.position.set(0, -bodyH / 2, -bodyD / 2 + wallThick / 2);
  group.add(bWall);
  // Left wall
  const lWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, bodyH, bodyD - wallThick * 2));
  lWall.position.set(-bodyW / 2 + wallThick / 2, -bodyH / 2, 0);
  group.add(lWall);
  // Right wall
  const rWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, bodyH, bodyD - wallThick * 2));
  rWall.position.set(bodyW / 2 - wallThick / 2, -bodyH / 2, 0);
  group.add(rWall);
  // Bottom floor (with LED light channel hole)
  const floorGeo = new THREE.BoxGeometry(bodyW, wallThick, bodyD);
  const floor = new THREE.Mesh(floorGeo);
  floor.position.set(0, -bodyH + wallThick / 2, 0);
  group.add(floor);

  // Central stem guide cylinder (hollow tube inside)
  const guideOuter = new THREE.CylinderGeometry(3.5, 3.5, 3, 16);
  const guide = new THREE.Mesh(guideOuter);
  guide.position.y = -bodyH + wallThick + 1.5;
  group.add(guide);

  // Light channel — hole through the bottom toward LED side
  const channelGeo = new THREE.BoxGeometry(3, wallThick + 0.5, 3);
  const channelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0, roughness: 0.9, side: DS });
  const channel = new THREE.Mesh(channelGeo, channelMat);
  channel.position.set(0, -bodyH + wallThick / 2, ledZ * 4.5);
  group.add(channel);

  // Clip tabs — wider bumps
  const clipGeo = new THREE.BoxGeometry(15.6, 1.5, 2);
  const clip1 = new THREE.Mesh(clipGeo);
  clip1.position.set(0, -0.75, -6.5);
  group.add(clip1);
  const clip2 = new THREE.Mesh(clipGeo);
  clip2.position.set(0, -0.75, 6.5);
  group.add(clip2);

  // PCB pins
  const pinGeo = new THREE.CylinderGeometry(0.5, 0.5, 3.3, 6);
  const pin1 = new THREE.Mesh(pinGeo);
  pin1.position.set(-2.54, -bodyH - 1.65, 0);
  group.add(pin1);
  const pin2 = new THREE.Mesh(pinGeo);
  pin2.position.set(2.54, -bodyH - 1.65, 0);
  group.add(pin2);
  // Ground pin
  const gPinGeo = new THREE.CylinderGeometry(0.85, 0.85, 3.3, 6);
  const gPin = new THREE.Mesh(gPinGeo);
  gPin.position.set(0, -bodyH - 1.65, ledZ * -5.08);
  group.add(gPin);

  // LED pad on bottom
  const ledPadGeo = new THREE.BoxGeometry(2.5, 0.3, 2.5);
  const ledPad = new THREE.Mesh(ledPadGeo);
  ledPad.position.set(0, -bodyH, ledZ * 4.7);
  group.add(ledPad);

  return {
    group,
    defaultColor: 0x1a1a1e,
    metalness: 0.1,
    roughness: 0.8,
    explodeY: 8, // first layer above plate
    label: "Bottom Housing",
  };
}

// ── Top Housing (Cover / Deckel — TRANSPARENT per Cherry spec) ──
// The top housing is translucent plastic that diffuses LED light upward
export function createTopHousing(ledZ = -1) {
  const group = new THREE.Group();

  const bodyW = 14, bodyD = 14, bodyH = 6.6;
  const wallThick = 1.5;
  const taper = 0.88;

  // Transparent outer shell — light passes through this
  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD, 1, 1, 1);
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * taper);
      pos.setZ(i, pos.getZ(i) * taper);
    }
  }
  pos.needsUpdate = true;
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo);
  body.position.y = bodyH / 2;
  group.add(body);

  // Internal cavity
  const cavityGeo = new THREE.BoxGeometry(bodyW - wallThick * 2, bodyH - wallThick, bodyD - wallThick * 2);
  const cavityMat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, metalness: 0, roughness: 0.9, side: DS });
  const cavity = new THREE.Mesh(cavityGeo, cavityMat);
  cavity.position.y = bodyH / 2 - wallThick / 2;
  group.add(cavity);

  // Stem hole on top
  const holeGeo = new THREE.CylinderGeometry(2.8, 2.8, wallThick + 0.5, 16);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.1, roughness: 0.7, side: DS });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.position.y = bodyH - wallThick / 2;
  group.add(hole);

  // LED light pipe — a clear channel from bottom to top on the LED side
  // This is where light travels through the housing
  const pipeGeo = new THREE.BoxGeometry(3.5, bodyH, 3.5);
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x888890,
    transparent: true,
    opacity: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0,
    side: DS,
  });
  const pipe = new THREE.Mesh(pipeGeo, pipeMat);
  pipe.position.set(0, bodyH / 2, ledZ * 4.5);
  pipe.userData.isLightPipe = true; // tag for LED animation
  group.add(pipe);

  return {
    group,
    // Transparent milky white — the default "cover transparent" from the drawing
    defaultColor: 0x3a3a40,
    metalness: 0.05,
    roughness: 0.6,
    transparent: true,
    opacity: 0.75,
    explodeY: 22,
    label: "Top Housing",
  };
}

// ── Stem ──
export function createStem() {
  const group = new THREE.Group();

  // Square base (matches engineering drawing — rectangular stem body)
  const baseGeo = new THREE.BoxGeometry(5.5, 5, 5.5);
  const base = new THREE.Mesh(baseGeo);
  base.position.y = 4;
  group.add(base);

  // Cross vertical bar
  const vBarGeo = new THREE.BoxGeometry(1.17, 3.6, 4.0);
  const vBar = new THREE.Mesh(vBarGeo);
  vBar.position.y = 8.4;
  group.add(vBar);

  // Cross horizontal bar
  const hBarGeo = new THREE.BoxGeometry(4.0, 3.6, 1.17);
  const hBar = new THREE.Mesh(hBarGeo);
  hBar.position.y = 8.4;
  group.add(hBar);

  // Stem rails
  const railGeo = new THREE.BoxGeometry(0.8, 5, 1.2);
  const rail1 = new THREE.Mesh(railGeo);
  rail1.position.set(-2.2, 3.5, 0);
  group.add(rail1);
  const rail2 = new THREE.Mesh(railGeo);
  rail2.position.set(2.2, 3.5, 0);
  group.add(rail2);

  // Bottom contact tabs (small prongs below the stem base)
  const tabGeo = new THREE.BoxGeometry(0.6, 2, 0.6);
  const tab1 = new THREE.Mesh(tabGeo);
  tab1.position.set(-1.5, 0.5, 0);
  group.add(tab1);
  const tab2 = new THREE.Mesh(tabGeo);
  tab2.position.set(1.5, 0.5, 0);
  group.add(tab2);

  return {
    group,
    defaultColor: 0xd4a04a,
    metalness: 0.15,
    roughness: 0.5,
    explodeY: 42, // top layer
    label: "Stem",
  };
}

// ── Spring ──
export function createSpring() {
  const group = new THREE.Group();

  const turns = 8;
  const height = 6;
  const radius = 2;
  const wireRadius = 0.2;

  class HelixCurve extends THREE.Curve {
    getPoint(t) {
      const angle = t * Math.PI * 2 * turns;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        t * height,
        Math.sin(angle) * radius,
      );
    }
  }

  const helixGeo = new THREE.TubeGeometry(new HelixCurve(), turns * 12, wireRadius, 6, false);
  const helix = new THREE.Mesh(helixGeo);
  helix.position.y = -2;
  group.add(helix);

  const capGeo = new THREE.TorusGeometry(radius, wireRadius, 6, 16);
  const topCap = new THREE.Mesh(capGeo);
  topCap.rotation.x = Math.PI / 2;
  topCap.position.y = 4;
  group.add(topCap);

  const botCap = new THREE.Mesh(capGeo);
  botCap.rotation.x = Math.PI / 2;
  botCap.position.y = -2;
  group.add(botCap);

  return {
    group,
    defaultColor: 0xc0c0c0,
    metalness: 0.6,
    roughness: 0.3,
    explodeY: 32, // between top housing and stem
    label: "Spring",
  };
}

/**
 * Create a complete switch assembly at the origin.
 * Each part has an explodeY — when explode factor > 0, all parts lift UP
 * from the plate surface, stacking vertically.
 */
export function createSwitchAssembly(facing = "south", stemColor = "#d4a04a", topHousingColor = "#2a2a30", bottomHousingColor = "#1a1a1e") {
  const ledZ = facing === "north" ? 1 : -1;
  const colorOverrides = {
    bottomHousing: bottomHousingColor,
    topHousing: topHousingColor,
    stem: stemColor,
  };
  const builders = [
    ["bottomHousing", () => createBottomHousing(ledZ)],
    ["topHousing", () => createTopHousing(ledZ)],
    ["stem", createStem],
    ["spring", createSpring],
  ];

  const assemblyGroup = new THREE.Group();
  const parts = new Map();

  for (const [name, builder] of builders) {
    const part = builder();
    const matOpts = {
      color: colorOverrides[name] || part.defaultColor,
      metalness: part.metalness,
      roughness: part.roughness,
      side: DS,
    };
    if (part.transparent) {
      matOpts.transparent = true;
      matOpts.opacity = part.opacity || 0.75;
    }
    const mat = new THREE.MeshStandardMaterial(matOpts);
    part.group.traverse((child) => {
      // Apply default material only to meshes that don't have a custom one
      if (child.isMesh && !child.material?.isMeshStandardMaterial) child.material = mat;
    });

    assemblyGroup.add(part.group);
    parts.set(name, { group: part.group, material: mat, explodeY: part.explodeY, label: part.label });
  }

  return { parts, assemblyGroup };
}

export const SWITCH_PART_NAMES = ["bottomHousing", "topHousing", "spring", "stem"];
export const SWITCH_PART_LABELS = {
  bottomHousing: "Bottom Housing",
  topHousing: "Top Housing",
  spring: "Spring",
  stem: "Stem",
};
