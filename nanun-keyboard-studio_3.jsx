import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";

const UNIT = 19.05, CUTOUT = 14, SNAP = 0.25;
const KEY_SIZES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 6.25, 7];
const C = {
  bg:"#1c1c1f",surface:"#252528",surfaceAlt:"#2c2c30",border:"#3a3a3f",
  borderLight:"#48484e",text:"#e8e6e3",textMuted:"#8a8a8f",textDim:"#5a5a60",
  accent:"#e2a049",accentHover:"#f0b060",accentDim:"#e2a04930",
  danger:"#d95555",success:"#4caf6a",keySurface:"#2a2a2e",keyAccent:"#33302a",
  keyBorder:"#3c3c42",keyAccentBorder:"#4a4035",keySelected:"#e2a04944",keySelectedBorder:"#e2a049",
};

/* ═══ LAYOUT DSL ═══ */
function R(y,s){const t=s.split(" ").filter(Boolean),k=[];t.forEach(t=>{const p=t.split(":");if(p[0]==="_"){k.push({gap:parseFloat(p[1])});return;}const o={l:p[0]};if(p[1])o.w=parseFloat(p[1]);if(p[2])o.h=parseFloat(p[2]);k.push(o);});return{y,keys:k};}
function gen(rows){let id=1;const r=[];rows.forEach(row=>{let x=0;row.keys.forEach(k=>{if(k.gap!==undefined){x+=k.gap;return;}r.push({id:id++,x,y:row.y,w:k.w||1,h:k.h||1,label:k.l});x+=k.w||1;});});return r;}

/* ═══ LAYOUTS ═══ */
const A40=[R(0,"Tab Q W E R T Y U I O P Bksp"),R(1,"Esc:1.25 A S D F G H J K L Ent:1.75"),R(2,"Shft:1.75 Z X C V B N M , . Shft:1.25"),R(3,"Ctrl Fn Win Alt Sp:3 Alt Fn ← ↓ →")];
const A60=[R(0,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2"),R(1,"Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5"),R(2,"Caps:1.75 A S D F G H J K L ; ' Ent:2.25"),R(3,"Shft:2.25 Z X C V B N M , . / Shft:2.75"),R(4,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Fn:1.25 Ctrl:1.25")];
const A65=[R(0,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Del"),R(1,"Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 Hm"),R(2,"Caps:1.75 A S D F G H J K L ; ' Ent:2.25 PU"),R(3,"Shft:2.25 Z X C V B N M , . / Shft:1.75 ↑ PD"),R(4,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →")];
const A75=[R(0,"Esc _:0.25 F1 F2 F3 F4 _:0.25 F5 F6 F7 F8 _:0.25 F9 F10 F11 F12 _:0.25 Del"),R(1.25,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Hm"),R(2.25,"Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 PU"),R(3.25,"Caps:1.75 A S D F G H J K L ; ' Ent:2.25 PD"),R(4.25,"Shft:2.25 Z X C V B N M , . / Shft:1.75 ↑ End"),R(5.25,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →")];
const ATKL=[R(0,"Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),R(1.5,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU"),R(2.5,"Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 _:0.25 Del End PD"),R(3.5,"Caps:1.75 A S D F G H J K L ; ' Ent:2.25"),R(4.5,"Shft:2.25 Z X C V B N M , . / Shft:2.75 _:1.25 ↑"),R(5.5,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ →")];
const A100=[R(0,"Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),R(1.5,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU _:0.25 Nm / * -"),R(2.5,"Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 _:0.25 Del End PD _:0.25 7 8 9 +:1:2"),R(3.5,"Caps:1.75 A S D F G H J K L ; ' Ent:2.25 _:3.5 4 5 6"),R(4.5,"Shft:2.25 Z X C V B N M , . / Shft:2.75 _:1.25 ↑ _:1.25 1 2 3 En:1:2"),R(5.5,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ → _:0.25 0:2 .")];

const I60=[R(0,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2"),R(1,"Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2"),R(2,"Caps:1.75 A S D F G H J K L ; ' #"),R(3,"Shft:1.25 \\ Z X C V B N M , . / Shft:2.75"),R(4,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Fn:1.25 Ctrl:1.25")];
const I65=[R(0,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Del"),R(1,"Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 Hm"),R(2,"Caps:1.75 A S D F G H J K L ; ' # _:1.25 PU"),R(3,"Shft:1.25 \\ Z X C V B N M , . / Shft:1.75 ↑ PD"),R(4,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →")];
const I75=[R(0,"Esc _:0.25 F1 F2 F3 F4 _:0.25 F5 F6 F7 F8 _:0.25 F9 F10 F11 F12 _:0.25 Del"),R(1.25,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Hm"),R(2.25,"Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 PU"),R(3.25,"Caps:1.75 A S D F G H J K L ; ' # _:1.25 PD"),R(4.25,"Shft:1.25 \\ Z X C V B N M , . / Shft:1.75 ↑ End"),R(5.25,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →")];
const ITKL=[R(0,"Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),R(1.5,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU"),R(2.5,"Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 _:0.25 Del End PD"),R(3.5,"Caps:1.75 A S D F G H J K L ; ' #"),R(4.5,"Shft:1.25 \\ Z X C V B N M , . / Shft:2.75 _:1.25 ↑"),R(5.5,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ →")];
const I100=[R(0,"Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),R(1.5,"~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU _:0.25 Nm / * -"),R(2.5,"Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 _:0.25 Del End PD _:0.25 7 8 9 +:1:2"),R(3.5,"Caps:1.75 A S D F G H J K L ; ' # _:4.75 4 5 6"),R(4.5,"Shft:1.25 \\ Z X C V B N M , . / Shft:2.75 _:1.25 ↑ _:1.25 1 2 3 En:1:2"),R(5.5,"Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ → _:0.25 0:2 .")];

const PRESETS = {
  "macropads":null,
  "2×4 Pad":[{id:1,x:0,y:0,w:1,h:1,label:"M1"},{id:2,x:1,y:0,w:1,h:1,label:"M2"},{id:3,x:2,y:0,w:1,h:1,label:"M3"},{id:4,x:3,y:0,w:1,h:1,label:"M4"},{id:5,x:0,y:1,w:1,h:1,label:"M5"},{id:6,x:1,y:1,w:1,h:1,label:"M6"},{id:7,x:2,y:1,w:1,h:1,label:"M7"},{id:8,x:3,y:1,w:1,h:1,label:"M8"}],
  "3×3 Numpad":[{id:1,x:0,y:0,w:1,h:1,label:"7"},{id:2,x:1,y:0,w:1,h:1,label:"8"},{id:3,x:2,y:0,w:1,h:1,label:"9"},{id:4,x:0,y:1,w:1,h:1,label:"4"},{id:5,x:1,y:1,w:1,h:1,label:"5"},{id:6,x:2,y:1,w:1,h:1,label:"6"},{id:7,x:0,y:2,w:1,h:1,label:"1"},{id:8,x:1,y:2,w:1,h:1,label:"2"},{id:9,x:2,y:2,w:1,h:1,label:"3"}],
  "ansi":null,"40% ANSI":gen(A40),"60% ANSI":gen(A60),"65% ANSI":gen(A65),"75% ANSI":gen(A75),"TKL ANSI":gen(ATKL),"Full ANSI":gen(A100),
  "iso":null,"60% ISO":gen(I60),"65% ISO":gen(I65),"75% ISO":gen(I75),"TKL ISO":gen(ITKL),"Full ISO":gen(I100),
};

const ACCENT_LABELS = new Set(["Esc","Ent","Enter","En","Bk","Bksp","Del","Tab","Caps","Shft","Shift","Ctrl","Alt","Win","Fn","Mn","Space","Sp","Nm","NmL","Prt","Scr","Pse","Ins"]);
const snap = v => Math.round(v/SNAP)*SNAP;
const isISOEnter = k => k.h >= 2 && k.w <= 1.5 && /^(Ent|Enter|En)$/i.test(k.label);

function getBounds(keys,margin){
  if(!keys.length)return{minX:0,minY:0,maxX:UNIT*4,maxY:UNIT*2};
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  keys.forEach(k=>{
    const lx = isISOEnter(k) ? (k.x-0.25)*UNIT : k.x*UNIT;
    a=Math.min(a,lx);b=Math.min(b,k.y*UNIT);c=Math.max(c,(k.x+k.w)*UNIT);d=Math.max(d,(k.y+(k.h||1))*UNIT);
  });
  return{minX:a-margin,minY:b-margin,maxX:c+margin,maxY:d+margin};
}

/* ═══ EXPORTS ═══ */
function exportSVG(keys,s){const{margin,cornerRadius}=s;const b=getBounds(keys,margin);const w=b.maxX-b.minX,h=b.maxY-b.minY;const r=Math.min(cornerRadius,w/2,h/2);let svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="${b.minX.toFixed(2)} ${b.minY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">\n<desc>Generated by nanun.me</desc>\n<g id="outline" fill="none" stroke="#000" stroke-width="0.2">\n  <rect x="${b.minX.toFixed(2)}" y="${b.minY.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}"/>\n</g>\n<g id="cutouts" fill="none" stroke="#f00" stroke-width="0.1">\n`;keys.forEach((k,i)=>{const cx=(k.x+k.w/2)*UNIT-CUTOUT/2,cy=(k.y+(k.h||1)/2)*UNIT-CUTOUT/2;svg+=`  <rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${CUTOUT}" height="${CUTOUT}" id="sw${i+1}"/>\n`;});svg+=`</g>\n</svg>`;return svg;}

function exportDXF(keys,s){const{margin,cornerRadius}=s;const b=getBounds(keys,margin);const r=Math.min(cornerRadius,(b.maxX-b.minX)/2,(b.maxY-b.minY)/2);let d="0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n0\nLAYER\n2\nOUTLINE\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nCUTOUTS\n70\n0\n62\n1\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";const pts=r>0.1?[[b.minX+r,b.minY],[b.maxX-r,b.minY],[b.maxX,b.minY+r],[b.maxX,b.maxY-r],[b.maxX-r,b.maxY],[b.minX+r,b.maxY],[b.minX,b.maxY-r],[b.minX,b.minY+r]]:[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]];d+=`0\nLWPOLYLINE\n8\nOUTLINE\n90\n${pts.length}\n70\n1\n`;pts.forEach(([x,y])=>{d+=`10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n`;});keys.forEach(k=>{const cx=(k.x+k.w/2)*UNIT,cy=(k.y+(k.h||1)/2)*UNIT,hl=CUTOUT/2;d+=`0\nLWPOLYLINE\n8\nCUTOUTS\n90\n4\n70\n1\n10\n${(cx-hl).toFixed(4)}\n20\n${(cy-hl).toFixed(4)}\n10\n${(cx+hl).toFixed(4)}\n20\n${(cy-hl).toFixed(4)}\n10\n${(cx+hl).toFixed(4)}\n20\n${(cy+hl).toFixed(4)}\n10\n${(cx-hl).toFixed(4)}\n20\n${(cy+hl).toFixed(4)}\n`;});d+="0\nENDSEC\n0\nEOF\n";return d;}

function exportKLE(keys){if(!keys.length)return"[]";const sorted=[...keys].sort((a,b)=>a.y-b.y||a.x-b.x);const rows=[];let cY=-1,cR=[],cX=0;sorted.forEach(k=>{if(k.y!==cY){if(cR.length)rows.push(cR);cR=[];cY=k.y;cX=0;}const p={};if(k.x!==cX)p.x=+(k.x-cX).toFixed(2);if(k.w!==1)p.w=k.w;if((k.h||1)!==1)p.h=k.h;if(Object.keys(p).length)cR.push(p);cR.push(k.label);cX=k.x+k.w;});if(cR.length)rows.push(cR);return JSON.stringify(rows,null,2);}

function importKLE(json){try{const d=JSON.parse(json);if(!Array.isArray(d))return null;const keys=[];let id=1,y=0;d.forEach(row=>{if(!Array.isArray(row))return;let x=0,w=1,h=1;row.forEach(item=>{if(typeof item==="object"&&item!==null){if(item.x)x+=item.x;if(item.y)y+=item.y;if(item.w)w=item.w;if(item.h)h=item.h;}else{keys.push({id:id++,x,y,w,h,label:String(item)});x+=w;w=1;h=1;}});y+=1;});return keys.length?keys:null;}catch{return null;}}

function exportKiCadCSV(keys){let c="# nanun.me KiCad Switch Positions\n# Units: mm\nRef,PosX,PosY,Rot,Side\n";keys.forEach((k,i)=>{c+=`SW${i+1},${((k.x+k.w/2)*UNIT).toFixed(3)},${((k.y+(k.h||1)/2)*UNIT).toFixed(3)},0,top\n`;});return c;}

function download(content,filename,mime="text/plain"){const b=new Blob([content],{type:mime});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u);}

/* ═══ THREE.JS PLATE BUILDER ═══ */
function buildPlate(keys,s){
  const b=getBounds(keys,s.margin);const r=Math.min(s.cornerRadius,(b.maxX-b.minX)/2,(b.maxY-b.minY)/2);
  const sh=new THREE.Shape();
  sh.moveTo(b.minX+r,b.minY);sh.lineTo(b.maxX-r,b.minY);sh.quadraticCurveTo(b.maxX,b.minY,b.maxX,b.minY+r);sh.lineTo(b.maxX,b.maxY-r);sh.quadraticCurveTo(b.maxX,b.maxY,b.maxX-r,b.maxY);sh.lineTo(b.minX+r,b.maxY);sh.quadraticCurveTo(b.minX,b.maxY,b.minX,b.maxY-r);sh.lineTo(b.minX,b.minY+r);sh.quadraticCurveTo(b.minX,b.minY,b.minX+r,b.minY);
  keys.forEach(k=>{const cx=(k.x+k.w/2)*UNIT,cy=(k.y+(k.h||1)/2)*UNIT,hl=CUTOUT/2;const hole=new THREE.Path();hole.moveTo(cx-hl,cy-hl);hole.lineTo(cx+hl,cy-hl);hole.lineTo(cx+hl,cy+hl);hole.lineTo(cx-hl,cy+hl);hole.lineTo(cx-hl,cy-hl);sh.holes.push(hole);});
  return new THREE.ExtrudeGeometry(sh,{depth:s.thickness,bevelEnabled:false});
}

/* ═══ KEYCAP PROFILES ═══ */
const CAP_PROFILES = {
  cherry: { height: 6, topInset: 1.5, label: "Cherry" },
  sa:     { height: 11, topInset: 2.5, label: "SA" },
  dsa:    { height: 7, topInset: 2, label: "DSA" },
};

/* ═══ 3D PREVIEW ═══ */
function ThreePreview({ keys, plateSettings, opts3d }) {
  const mountRef = useRef(null);
  const st = useRef({});

  // Scene setup (once)
  useEffect(() => {
    const el = mountRef.current; if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18181b);
    scene.fog = new THREE.FogExp2(0x18181b, 0.002);
    const w = el.clientWidth, h = el.clientHeight;
    const cam = new THREE.PerspectiveCamera(40, w/h, 0.1, 2000);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setSize(w,h); ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.1;
    el.appendChild(ren.domElement);

    scene.add(new THREE.AmbientLight(0xffeedd, 0.35));
    const sun = new THREE.DirectionalLight(0xfff5e6, 0.9);
    sun.position.set(80,150,100); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.near=10; sun.shadow.camera.far=500;
    sun.shadow.camera.left=-250; sun.shadow.camera.right=250; sun.shadow.camera.top=250; sun.shadow.camera.bottom=-250;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xe2a049, 0.15).translateX(-60).translateY(40));
    scene.add(new THREE.PointLight(0xffffff, 0.3, 400).translateY(60).translateZ(-80));

    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshStandardMaterial({color:0x1a1a1e,roughness:0.95}));
    gnd.rotation.x = -Math.PI/2; gnd.position.y = -2; gnd.receiveShadow = true; scene.add(gnd);

    st.current = { scene, cam, ren, el, meshes: [], theta: Math.PI/4, phi: Math.PI/3.2, radius: 160 };

    let drag = false, px = 0, py = 0;
    const cv = ren.domElement;
    const oD = e => { drag=true; const p=e.touches?e.touches[0]:e; px=p.clientX; py=p.clientY; };
    const oM = e => { if(!drag) return; const p=e.touches?e.touches[0]:e;
      st.current.theta -= (p.clientX-px)*0.007;
      st.current.phi = Math.max(0.15,Math.min(1.5,st.current.phi-(p.clientY-py)*0.007));
      px=p.clientX; py=p.clientY; };
    const oU = () => { drag=false; };
    const oW = e => { e.preventDefault(); st.current.radius=Math.max(30,Math.min(800,st.current.radius+e.deltaY*0.18)); };
    cv.addEventListener("mousedown",oD);cv.addEventListener("mousemove",oM);cv.addEventListener("mouseup",oU);cv.addEventListener("mouseleave",oU);
    cv.addEventListener("wheel",oW,{passive:false});cv.addEventListener("touchstart",oD,{passive:true});cv.addEventListener("touchmove",oM,{passive:true});cv.addEventListener("touchend",oU);

    let anim;
    const loop = () => {
      anim = requestAnimationFrame(loop);
      // update cam from orbit state
      const {theta,phi,radius,centerX:cx2,centerZ:cz2} = st.current;
      if (cx2 !== undefined) {
        cam.position.set(cx2+radius*Math.sin(phi)*Math.cos(theta), radius*Math.cos(phi), cz2+radius*Math.sin(phi)*Math.sin(theta));
        cam.lookAt(cx2,0,cz2);
      }
      ren.render(scene,cam);
    };
    loop();
    const onR = () => { const ww=el.clientWidth,hh=el.clientHeight;cam.aspect=ww/hh;cam.updateProjectionMatrix();ren.setSize(ww,hh); };
    window.addEventListener("resize",onR);
    return () => { cancelAnimationFrame(anim); window.removeEventListener("resize",onR); ren.dispose(); if(el.contains(cv)) el.removeChild(cv); };
  }, []);

  // Rebuild meshes
  useEffect(() => {
    const { scene, meshes } = st.current; if (!scene) return;
    meshes?.forEach(m => { scene.remove(m); m.geometry?.dispose(); if(Array.isArray(m.material))m.material.forEach(mt=>mt.dispose());else m.material?.dispose(); });
    st.current.meshes = [];
    if (!keys.length) return;

    const profile = CAP_PROFILES[opts3d.capProfile] || CAP_PROFILES.cherry;
    const minKX = Math.min(...keys.map(k=>isISOEnter(k)?k.x-0.25:k.x));
    const maxKX = Math.max(...keys.map(k=>k.x+k.w));
    const minKY = Math.min(...keys.map(k=>k.y));
    const maxKY = Math.max(...keys.map(k=>k.y+(k.h||1)));
    const centerX = ((minKX+maxKX)/2)*UNIT;
    const centerZ = -((minKY+maxKY)/2)*UNIT;
    const span = Math.max((maxKX-minKX)*UNIT,(maxKY-minKY)*UNIT);
    st.current.radius = span*1.2+50;
    st.current.centerX = centerX;
    st.current.centerZ = centerZ;

    const add = m => { scene.add(m); st.current.meshes.push(m); };

    // ── Case ──
    if (opts3d.caseStyle !== "none") {
      const bds = getBounds(keys, plateSettings.margin);
      const cw = bds.maxX-bds.minX, ch = bds.maxY-bds.minY;
      const cx = (bds.minX+bds.maxX)/2, cy = (bds.minY+bds.maxY)/2;
      const wall = 3;
      const caseH = opts3d.caseStyle==="high" ? plateSettings.thickness+profile.height+6 : opts3d.caseStyle==="low" ? plateSettings.thickness+4 : plateSettings.thickness+8;

      const caseMat = new THREE.MeshStandardMaterial({color:0x222225,metalness:0.5,roughness:0.4});
      // outer shell
      const outerG = new THREE.BoxGeometry(cw+wall*2, caseH, ch+wall*2);
      const outer = new THREE.Mesh(outerG, caseMat);
      outer.position.set(cx, -caseH/2+plateSettings.thickness, -cy);
      outer.castShadow = true; outer.receiveShadow = true; add(outer);
      // inner cutout (slightly smaller, shifted up)
      const innerG = new THREE.BoxGeometry(cw, caseH, ch);
      const innerMat = new THREE.MeshStandardMaterial({color:0x151518,metalness:0.3,roughness:0.6});
      const inner = new THREE.Mesh(innerG, innerMat);
      inner.position.set(cx, -caseH/2+plateSettings.thickness+wall/2, -cy);
      add(inner);
    }

    // ── Plate ──
    const pGeo = buildPlate(keys, plateSettings);
    const pMat = new THREE.MeshStandardMaterial({color:0x303035,metalness:0.7,roughness:0.28});
    const plate = new THREE.Mesh(pGeo, pMat);
    plate.rotation.x = -Math.PI/2;
    plate.castShadow = true; plate.receiveShadow = true;
    add(plate);

    // Materials
    const capBase = new THREE.MeshStandardMaterial({color:0x3a3a3f,metalness:0.08,roughness:0.7});
    const capAcct = new THREE.MeshStandardMaterial({color:0x8a6530,metalness:0.1,roughness:0.65});
    const capTop = new THREE.MeshStandardMaterial({color:0x4a4a50,metalness:0.05,roughness:0.6});
    const swBody = new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:0.15,roughness:0.8});
    const swStem = new THREE.MeshStandardMaterial({color:0xd4a04a,metalness:0.2,roughness:0.5});

    keys.forEach(k => {
      const kw = k.w*UNIT-1.2, kh = (k.h||1)*UNIT-1.2;
      const px = (k.x+k.w/2)*UNIT;
      const pz = -(k.y+(k.h||1)/2)*UNIT; // NEGATED Z to match plate rotation
      const isA = ACCENT_LABELS.has(k.label);
      const isISO = isISOEnter(k);

      // ── Switch (below plate, visible through cutout) ──
      if (opts3d.switches) {
        const swG = new THREE.BoxGeometry(CUTOUT-0.5, 5, CUTOUT-0.5);
        const sw = new THREE.Mesh(swG, swBody);
        sw.position.set(px, -2.5, pz);
        add(sw);
        // stem cross
        const stemV = new THREE.BoxGeometry(1.2, 3, 4);
        const stemH = new THREE.BoxGeometry(4, 3, 1.2);
        const sv = new THREE.Mesh(stemV, swStem);
        sv.position.set(px, plateSettings.thickness+0.5, pz);
        add(sv);
        const sh2 = new THREE.Mesh(stemH, swStem);
        sh2.position.set(px, plateSettings.thickness+0.5, pz);
        add(sh2);
      }

      // ── Keycap ──
      if (opts3d.capProfile !== "none") {
        let capGeo;
        if (isISO) {
          // L-shaped keycap for ISO Enter
          const isoShape = new THREE.Shape();
          const topW = 1.5*UNIT-1.2, botW = 1.25*UNIT-1.2;
          const rowH = 1*UNIT-0.6;
          const ofsX = -0.25*UNIT+0.6;
          isoShape.moveTo(ofsX, 0);
          isoShape.lineTo(ofsX+topW, 0);
          isoShape.lineTo(ofsX+topW, rowH*2);
          isoShape.lineTo(ofsX+topW-botW, rowH*2);
          isoShape.lineTo(ofsX+topW-botW, rowH);
          isoShape.lineTo(ofsX, rowH);
          isoShape.lineTo(ofsX, 0);
          capGeo = new THREE.ExtrudeGeometry(isoShape, {depth:profile.height,bevelEnabled:true,bevelSize:0.4,bevelThickness:0.4,bevelSegments:2});
          capGeo.rotateX(-Math.PI/2);
          capGeo.translate(0, profile.height, 0);
        } else {
          capGeo = new THREE.BoxGeometry(kw, profile.height, kh);
        }
        const cap = new THREE.Mesh(capGeo, isA?capAcct:capBase);
        cap.position.set(px, plateSettings.thickness+profile.height/2, pz);
        cap.castShadow = true; add(cap);

        // top dish
        if (!isISO) {
          const dw = Math.min(kw-profile.topInset*2, 16);
          const dh = Math.min(kh-profile.topInset*2, 16);
          if (dw > 2 && dh > 2) {
            const tG = new THREE.BoxGeometry(dw, 0.3, dh);
            const top = new THREE.Mesh(tG, capTop);
            top.position.set(px, plateSettings.thickness+profile.height+0.15, pz);
            add(top);
          }
        }
      }
    });
  }, [keys, plateSettings, opts3d]);

  return <div ref={mountRef} style={{width:"100%",height:"100%",minHeight:280}}/>;
}

/* ═══ SVG LAYOUT EDITOR ═══ */
function LayoutEditor({keys,selectedId,onSelect,onMove}){
  const svgRef=useRef(null);const dragRef=useRef(null);
  const minKX=keys.length?Math.min(...keys.map(k=>isISOEnter(k)?k.x-0.25:k.x)):0;
  const minKY=keys.length?Math.min(...keys.map(k=>k.y)):0;
  const maxX=keys.length?Math.max(...keys.map(k=>k.x+k.w)):4;
  const maxY=keys.length?Math.max(...keys.map(k=>k.y+(k.h||1))):2;
  const pad=0.8,vw=maxX-minKX+pad*2,vh=maxY-minKY+pad*2,ox=minKX-pad,oy=minKY-pad;

  const toSVG=useCallback(e=>{const svg=svgRef.current;if(!svg)return{x:0,y:0};const r=svg.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;const cy=e.touches?e.touches[0].clientY:e.clientY;return{x:((cx-r.left)/r.width)*vw+ox,y:((cy-r.top)/r.height)*vh+oy};},[vw,vh,ox,oy]);
  const hDown=(e,key)=>{e.stopPropagation();onSelect(key.id);const p=toSVG(e);dragRef.current={id:key.id,offX:p.x-key.x,offY:p.y-key.y};};
  const hMove=useCallback(e=>{if(!dragRef.current)return;const p=toSVG(e);onMove(dragRef.current.id,Math.max(0,snap(p.x-dragRef.current.offX)),Math.max(0,snap(p.y-dragRef.current.offY)));},[toSVG,onMove]);
  const hUp=useCallback(()=>{dragRef.current=null;},[]);
  useEffect(()=>{window.addEventListener("mousemove",hMove);window.addEventListener("mouseup",hUp);window.addEventListener("touchmove",hMove);window.addEventListener("touchend",hUp);return()=>{window.removeEventListener("mousemove",hMove);window.removeEventListener("mouseup",hUp);window.removeEventListener("touchmove",hMove);window.removeEventListener("touchend",hUp);};},[hMove,hUp]);

  const grids=[];
  for(let i=Math.floor(minKX-1);i<=Math.ceil(maxX+1);i++)grids.push(<line key={`v${i}`} x1={i} y1={minKY-1} x2={i} y2={maxY+1} stroke={C.border} strokeOpacity={0.25} strokeWidth={0.012}/>);
  for(let i=Math.floor(minKY-1);i<=Math.ceil(maxY+1);i++)grids.push(<line key={`h${i}`} x1={minKX-1} y1={i} x2={maxX+1} y2={i} stroke={C.border} strokeOpacity={0.25} strokeWidth={0.012}/>);

  return(
    <svg ref={svgRef} viewBox={`${ox} ${oy} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet"
      style={{width:"100%",height:"100%",minHeight:200,cursor:"crosshair",display:"block",background:C.bg}}
      onMouseDown={()=>onSelect(null)} onTouchStart={()=>onSelect(null)}>
      <defs><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
      <rect x={ox} y={oy} width={vw} height={vh} fill={C.bg}/>
      <rect x={ox} y={oy} width={vw} height={vh} filter="url(#noise)" opacity="0.03"/>
      {grids}
      {keys.map(k=>{
        const sel=k.id===selectedId;const g=0.04;const kh=k.h||1;
        const isA=ACCENT_LABELS.has(k.label);const isISO=isISOEnter(k);
        const fs=k.w<1.2&&k.label.length>2?0.18:k.label.length>3?0.21:0.26;

        // ISO Enter L-shape path
        if(isISO){
          const lx=k.x-0.25+g, rx=k.x+k.w-g, ty=k.y+g, by=k.y+kh-g;
          const mx=k.x+g, my=k.y+1;
          const d=`M${lx} ${ty} L${rx} ${ty} L${rx} ${by} L${mx} ${by} L${mx} ${my} L${lx} ${my} Z`;
          return(
            <g key={k.id} onMouseDown={e=>hDown(e,k)} onTouchStart={e=>hDown(e,k)}>
              <path d={`M${lx+0.02} ${ty+0.02} L${rx+0.02} ${ty+0.02} L${rx+0.02} ${by+0.02} L${mx+0.02} ${by+0.02} L${mx+0.02} ${my+0.02} L${lx+0.02} ${my+0.02} Z`} fill="#00000030"/>
              <path d={d} fill={sel?C.keySelected:C.keyAccent} stroke={sel?C.keySelectedBorder:C.keyAccentBorder} strokeWidth={sel?0.035:0.018} style={{cursor:"grab"}}/>
              <text x={k.x+k.w/2-0.1} y={k.y+kh/2+0.08} textAnchor="middle" fill={sel?C.accent:"#b89060"} fontSize={0.26} fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={600} style={{pointerEvents:"none",userSelect:"none"}}>{k.label}</text>
            </g>
          );
        }

        return(
          <g key={k.id} onMouseDown={e=>hDown(e,k)} onTouchStart={e=>hDown(e,k)}>
            <rect x={k.x+g+0.02} y={k.y+g+0.02} width={k.w-g*2} height={kh-g*2} rx={0.07} fill="#00000030"/>
            <rect x={k.x+g} y={k.y+g} width={k.w-g*2} height={kh-g*2} rx={0.07}
              fill={sel?C.keySelected:isA?C.keyAccent:C.keySurface}
              stroke={sel?C.keySelectedBorder:isA?C.keyAccentBorder:C.keyBorder}
              strokeWidth={sel?0.035:0.018} style={{cursor:"grab"}}/>
            <rect x={k.x+0.1} y={k.y+0.08} width={k.w-0.2} height={kh-0.22} rx={0.05} fill="none" stroke={sel?`${C.accent}40`:`${C.border}30`} strokeWidth={0.01}/>
            <rect x={k.x+k.w/2-CUTOUT/UNIT/2} y={k.y+kh/2-CUTOUT/UNIT/2} width={CUTOUT/UNIT} height={CUTOUT/UNIT} rx={0.015} fill="none" stroke={sel?`${C.accent}25`:`${C.border}15`} strokeWidth={0.008} strokeDasharray="0.025 0.02"/>
            <text x={k.x+k.w/2} y={k.y+kh/2+0.08} textAnchor="middle" fill={sel?C.accent:isA?"#b89060":C.textMuted} fontSize={fs} fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={600} style={{pointerEvents:"none",userSelect:"none"}}>{k.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══ ICONS ═══ */
const GitHubIcon=()=><svg width={16} height={16} viewBox="0 0 24 24" fill={C.textMuted}><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>;

/* ═══ MAIN APP ═══ */
export default function App(){
  const [keys,setKeys]=useState(PRESETS["60% ANSI"]);
  const [selectedId,setSelectedId]=useState(null);
  const [view,setView]=useState("layout");
  const [plateSettings,setPlateSettings]=useState({thickness:1.5,margin:5,cornerRadius:2});
  const [showImport,setShowImport]=useState(false);
  const [importText,setImportText]=useState("");
  const [opts3d,setOpts3d]=useState({switches:false,capProfile:"cherry",caseStyle:"none"});
  const selectedKey=keys.find(k=>k.id===selectedId)||null;
  const nextId=useRef(2000);

  const updateKey=(id,patch)=>setKeys(p=>p.map(k=>k.id===id?{...k,...patch}:k));
  const moveKey=useCallback((id,x,y)=>setKeys(p=>p.map(k=>k.id===id?{...k,x,y}:k)),[]);
  const addKey=()=>{const mx=keys.length?Math.max(...keys.map(k=>k.x+k.w)):0;const my=keys.length?Math.max(...keys.map(k=>k.y)):0;const id=nextId.current++;setKeys(p=>[...p,{id,x:mx,y:my,w:1,h:1,label:"K"}]);setSelectedId(id);};
  const deleteKey=()=>{if(!selectedId)return;setKeys(p=>p.filter(k=>k.id!==selectedId));setSelectedId(null);};
  const loadPreset=name=>{if(!PRESETS[name])return;const off=nextId.current;setKeys(PRESETS[name].map((k,i)=>({...k,id:off+i})));nextId.current+=PRESETS[name].length+1;setSelectedId(null);};
  const handleImport=()=>{const r=importKLE(importText);if(r){const off=nextId.current;setKeys(r.map((k,i)=>({...k,id:off+i})));nextId.current+=r.length+1;setShowImport(false);setImportText("");}};

  useEffect(()=>{
    const handler=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;
      if((e.key==="Delete"||e.key==="Backspace")&&selectedId){e.preventDefault();deleteKey();}
      if(e.key==="ArrowLeft"&&selectedId){e.preventDefault();updateKey(selectedId,{x:Math.max(0,(selectedKey?.x||0)-(e.shiftKey?1:0.25))});}
      if(e.key==="ArrowRight"&&selectedId){e.preventDefault();updateKey(selectedId,{x:(selectedKey?.x||0)+(e.shiftKey?1:0.25)});}
      if(e.key==="ArrowUp"&&selectedId){e.preventDefault();updateKey(selectedId,{y:Math.max(0,(selectedKey?.y||0)-(e.shiftKey?1:0.25))});}
      if(e.key==="ArrowDown"&&selectedId){e.preventDefault();updateKey(selectedId,{y:(selectedKey?.y||0)+(e.shiftKey?1:0.25)});}
      if(e.key==="Escape")setSelectedId(null);
    };
    window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
  },[selectedId,selectedKey]);

  const plateDims=useMemo(()=>{const b=getBounds(keys,plateSettings.margin);return{w:(b.maxX-b.minX).toFixed(1),h:(b.maxY-b.minY).toFixed(1)};},[keys,plateSettings.margin]);
  const f="'Plus Jakarta Sans',sans-serif",m="'JetBrains Mono',monospace";

  const BtnSmall=({children,onClick,active,disabled,accent,danger})=>(
    <button onClick={onClick} disabled={disabled} style={{padding:"5px 10px",fontSize:11,fontFamily:f,fontWeight:600,letterSpacing:0.3,border:`1px solid ${disabled?C.border:danger?C.danger+"55":accent?C.accent+"55":active?C.accent:C.border}`,borderRadius:6,cursor:disabled?"not-allowed":"pointer",background:disabled?C.surface:active?C.accentDim:danger?C.danger+"15":"transparent",color:disabled?C.textDim:danger?C.danger:active||accent?C.accent:C.textMuted,transition:"all 0.15s"}}>{children}</button>
  );

  const Toggle=({label,checked,onChange})=>(
    <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:10,color:C.textMuted,fontWeight:500}}>
      <div onClick={onChange} style={{width:28,height:16,borderRadius:8,background:checked?C.accent:C.border,position:"relative",transition:"0.2s",cursor:"pointer"}}>
        <div style={{width:12,height:12,borderRadius:6,background:"#fff",position:"absolute",top:2,left:checked?14:2,transition:"0.2s"}}/>
      </div>
      {label}
    </label>
  );

  const Chip=({label,active,onClick})=>(
    <button onClick={onClick} style={{padding:"3px 8px",fontSize:9,fontFamily:f,fontWeight:600,letterSpacing:0.5,border:`1px solid ${active?C.accent:C.border}`,borderRadius:4,background:active?C.accentDim:"transparent",color:active?C.accent:C.textDim,cursor:"pointer",textTransform:"uppercase",transition:"0.15s"}}>{label}</button>
  );

  return(
    <div style={{fontFamily:f,background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}::selection{background:${C.accent}40;color:${C.text}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* HEADER */}
      <header style={{padding:"0 16px",height:48,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:`linear-gradient(180deg,${C.surfaceAlt} 0%,${C.bg} 100%)`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontWeight:800,fontSize:16,letterSpacing:-0.5}}>nanun</span>
          <span style={{fontWeight:500,fontSize:14,color:C.textDim}}>.me</span>
          <div style={{width:1,height:16,background:C.border,margin:"0 4px"}}/>
          <span style={{fontSize:10,fontWeight:500,color:C.textDim,letterSpacing:1.5,textTransform:"uppercase"}}>keyboard studio</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{display:"flex",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {[["layout","Layout"],["3d","3D"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"4px 14px",fontSize:11,fontFamily:f,fontWeight:600,border:"none",cursor:"pointer",background:view===v?C.accentDim:"transparent",color:view===v?C.accent:C.textDim,transition:"all 0.15s"}}>{l}</button>
            ))}
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{padding:6,display:"flex",opacity:0.6}}><GitHubIcon/></a>
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{padding:"6px 16px",borderBottom:`1px solid ${C.border}22`,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",background:C.bg}}>
        <select onChange={e=>e.target.value&&loadPreset(e.target.value)} value="" style={{background:C.surface,color:C.textMuted,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",fontSize:11,fontFamily:f,fontWeight:500,cursor:"pointer",maxWidth:140}}>
          <option value="">Presets…</option>
          {Object.keys(PRESETS).map(p=>PRESETS[p]===null?<option key={p} disabled style={{color:C.textDim,fontWeight:700,fontSize:10}}>{`── ${p.toUpperCase()} ──`}</option>:<option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{width:1,height:20,background:C.border}}/>
        <BtnSmall accent onClick={addKey}>+ Key</BtnSmall>
        <BtnSmall danger disabled={!selectedId} onClick={deleteKey}>Delete</BtnSmall>
        <div style={{width:1,height:20,background:C.border}}/>
        <BtnSmall onClick={()=>setShowImport(!showImport)}>KLE Import</BtnSmall>
        <div style={{marginLeft:"auto",fontFamily:m,fontSize:10,color:C.textDim,display:"flex",gap:12}}>
          <span>{keys.length} keys</span><span>{plateDims.w} × {plateDims.h} mm</span>
        </div>
      </div>

      {/* KLE IMPORT MODAL */}
      {showImport&&(
        <div style={{position:"absolute",top:96,left:16,right:16,zIndex:100,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,boxShadow:"0 12px 40px #00000080",animation:"fadeIn 0.2s ease"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Import KLE JSON</div>
          <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder='Paste KLE JSON here' style={{width:"100%",height:100,background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:10,fontSize:12,fontFamily:m,resize:"vertical"}}/>
          <div style={{display:"flex",gap:8,marginTop:8,justifyContent:"flex-end"}}>
            <BtnSmall onClick={()=>{setShowImport(false);setImportText("");}}>Cancel</BtnSmall>
            <BtnSmall accent onClick={handleImport}>Import</BtnSmall>
          </div>
        </div>
      )}

      {/* MAIN CANVAS */}
      <div style={{flex:1,position:"relative",minHeight:260,overflow:"hidden"}}>
        {view==="layout"
          ?<LayoutEditor keys={keys} selectedId={selectedId} onSelect={setSelectedId} onMove={moveKey}/>
          :<ThreePreview keys={keys} plateSettings={plateSettings} opts3d={opts3d}/>}
      </div>

      {/* BOTTOM PANEL */}
      <div style={{borderTop:`1px solid ${C.border}`,background:`linear-gradient(180deg,${C.surfaceAlt} 0%,${C.bg} 100%)`,padding:"10px 16px",display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        {/* Key props */}
        <div style={{minWidth:160}}>
          <SectionLabel>Key</SectionLabel>
          {selectedKey?(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <PropLabel label="Lbl"><input type="text" value={selectedKey.label} onChange={e=>updateKey(selectedId,{label:e.target.value})} style={{...inputSt,width:52,fontFamily:m}}/></PropLabel>
              <PropLabel label="W"><select value={selectedKey.w} onChange={e=>updateKey(selectedId,{w:parseFloat(e.target.value)})} style={{...inputSt,width:56}}>{KEY_SIZES.map(s=><option key={s} value={s}>{s}u</option>)}</select></PropLabel>
              <PropLabel label="H"><select value={selectedKey.h||1} onChange={e=>updateKey(selectedId,{h:parseFloat(e.target.value)})} style={{...inputSt,width:50}}>{[1,1.5,2].map(s=><option key={s} value={s}>{s}u</option>)}</select></PropLabel>
            </div>
          ):<span style={{color:C.textDim,fontSize:10,fontStyle:"italic"}}>Select a key</span>}
        </div>

        {/* Plate */}
        <div style={{minWidth:180}}>
          <SectionLabel>Plate</SectionLabel>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {[["T","thickness",0.5,5],["M","margin",1,20],["R","cornerRadius",0,10]].map(([l,k,mn,mx])=>(
              <PropLabel key={k} label={l}><input type="number" step={0.5} min={mn} max={mx} value={plateSettings[k]} onChange={e=>setPlateSettings(p=>({...p,[k]:parseFloat(e.target.value)||mn}))} style={{...inputSt,width:40,fontFamily:m}}/><span style={{fontSize:9,color:C.textDim}}>mm</span></PropLabel>
            ))}
          </div>
        </div>

        {/* 3D Options */}
        {view==="3d"&&(
          <div style={{minWidth:220}}>
            <SectionLabel>3D Display</SectionLabel>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <Toggle label="Switches" checked={opts3d.switches} onChange={()=>setOpts3d(p=>({...p,switches:!p.switches}))}/>
              <div style={{display:"flex",gap:3,alignItems:"center"}}>
                <span style={{fontSize:9,color:C.textDim,fontWeight:600,marginRight:2}}>CAP</span>
                {["cherry","sa","dsa","none"].map(p=>(
                  <Chip key={p} label={p} active={opts3d.capProfile===p} onClick={()=>setOpts3d(o=>({...o,capProfile:p}))}/>
                ))}
              </div>
              <div style={{display:"flex",gap:3,alignItems:"center"}}>
                <span style={{fontSize:9,color:C.textDim,fontWeight:600,marginRight:2}}>CASE</span>
                {["none","tray","high","low"].map(p=>(
                  <Chip key={p} label={p} active={opts3d.caseStyle===p} onClick={()=>setOpts3d(o=>({...o,caseStyle:p}))}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Export */}
        <div style={{minWidth:200}}>
          <SectionLabel>Export</SectionLabel>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            <ExportBtn label="SVG" sub="Plate" onClick={()=>download(exportSVG(keys,plateSettings),"plate.svg","image/svg+xml")}/>
            <ExportBtn label="DXF" sub="Plate" onClick={()=>download(exportDXF(keys,plateSettings),"plate.dxf")}/>
            <ExportBtn label="JSON" sub="KLE" onClick={()=>download(exportKLE(keys),"layout.json","application/json")}/>
            <ExportBtn label="CSV" sub="KiCad" onClick={()=>download(exportKiCadCSV(keys),"switches.csv")}/>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{padding:"6px 16px",borderTop:`1px solid ${C.border}22`,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:9,color:C.textDim,fontFamily:m,letterSpacing:0.5}}>
        <span>nanun.me · open-source keyboard design studio</span>
        <span style={{display:"flex",gap:10}}><span>MIT License</span><span>v1.1</span></span>
      </div>
    </div>
  );
}

function SectionLabel({children}){return <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:C.textDim,marginBottom:5}}>{children}</div>;}
function PropLabel({label,children}){return <label style={{display:"flex",alignItems:"center",gap:4,color:C.textMuted,fontSize:10,fontWeight:500}}><span style={{minWidth:16}}>{label}</span>{children}</label>;}
function ExportBtn({label,sub,onClick}){return <button onClick={onClick} style={{padding:"5px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,cursor:"pointer",transition:"all 0.15s",minWidth:52}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=C.accentDim}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface}}><span style={{fontSize:11,fontWeight:700,color:C.text,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{label}</span><span style={{fontSize:8,color:C.textDim,letterSpacing:0.5}}>{sub}</span></button>;}
const inputSt={background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 6px",fontSize:11,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none"};