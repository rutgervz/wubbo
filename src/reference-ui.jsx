import { useState, useRef, useEffect, useCallback, useMemo } from "react";

const C = {
  bg: "#08080A", bgWarm: "#111113", bgDeep: "#1A1A1E",
  surface: "#16161A", surfaceHover: "#1E1E24",
  ink: "#E8E4DC", inkSoft: "#C4BFB4", inkMu: "#7A766C", inkGhost: "#3A3835",
  sea: "#5ABFBF", seaLt: "#6DD4D4", seaSoft: "#122828", seaDeep: "#3D9E9E",
  coral: "#E8795D", coralSoft: "#2A1A14",
  dune: "#D4B98A", duneSoft: "#1E1A14",
  purple: "#9B8DD6", purpleSoft: "#1E1A28",
  green: "#6AAF7A", greenSoft: "#141E17",
  storm: "#8A9AB0",
  line: "#2A2825",
};
const F = {
  display: "'Instrument Serif', 'Playfair Display', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const KNOWLEDGE = {
  "Florida": { color: "#5ABFBF", connections: ["Re-Creation","Regeneratief","Coöperatie","Schiermonnikoog","NSW-landgoed","Energie","Fosfaatrechten","Jersey koeien","Food forest","Founding members","Artisanaal"] },
  "Re-Creation": { color: "#E8795D", connections: ["Florida","Spiritueel","Us Wente","Gastvrijheid","Zelfvernieuwing","Fysiek","Mentaal-emotioneel"] },
  "Regeneratief": { color: "#6AAF7A", connections: ["Florida","Bodemgezondheid","Kringlopen","Biodiversiteit","Gabe Brown","Joel Salatin","Mark Shepard","Mestvergisting"] },
  "Coöperatie": { color: "#5ABFBF", connections: ["Florida","NSW-landgoed","Founding members","Governance","Europees model","Inverted consumer"] },
  "Schiermonnikoog": { color: "#6DD4D4", connections: ["Florida","School","Us Wente","Gastvrijheid","Gemeenschap","Natuur","Seizoenen","Berkenplas","Toerisme"] },
  "School": { color: "#D4B98A", connections: ["Schiermonnikoog","Yn de Mande","Onderwijs","AI","Directeursvacature","Bohm-dialoog","Meendering"] },
  "NSW-landgoed": { color: "#8A9AB0", connections: ["Florida","Coöperatie","Natura 2000","Fiscaal","Fosfaatrechten"] },
  "Spiritueel": { color: "#9B8DD6", connections: ["Re-Creation","Zelfvernieuwing","Psychedelica","Schaduwwerk"] },
  "Us Wente": { color: "#D4B98A", connections: ["Re-Creation","Schiermonnikoog","Gastvrijheid"] },
  "Energie": { color: "#6AAF7A", connections: ["Florida","Mestvergisting","Kringlopen","Coöperatie"] },
  "Fosfaatrechten": { color: "#5ABFBF", connections: ["Florida","NSW-landgoed","Jersey koeien","Strategie","Vbr-regeling"] },
  "Jersey koeien": { color: "#D4B98A", connections: ["Florida","Fosfaatrechten","Artisanaal","Zuivel"] },
  "Gastvrijheid": { color: "#E8795D", connections: ["Re-Creation","Schiermonnikoog","Us Wente","Toerisme","Gemeenschap"] },
  "Founding members": { color: "#5ABFBF", connections: ["Florida","Coöperatie","Governance","Community"] },
  "Food forest": { color: "#6AAF7A", connections: ["Florida","Kustcondities","Biodiversiteit","Mark Shepard"] },
  "Bodemgezondheid": { color: "#6AAF7A", connections: ["Regeneratief","Kringlopen","Gabe Brown"] },
  "Kringlopen": { color: "#6AAF7A", connections: ["Regeneratief","Energie","Mestvergisting","Bodemgezondheid"] },
  "Biodiversiteit": { color: "#6AAF7A", connections: ["Regeneratief","Food forest","Natura 2000"] },
  "Gabe Brown": { color: "#E8795D", connections: ["Regeneratief","Bodemgezondheid","Joel Salatin"] },
  "Joel Salatin": { color: "#E8795D", connections: ["Regeneratief","Gabe Brown","Polyface"] },
  "Mestvergisting": { color: "#6AAF7A", connections: ["Regeneratief","Energie","Kringlopen","Coöperatie"] },
  "Onderwijs": { color: "#9B8DD6", connections: ["School","AI","Toekomst","Ouders"] },
  "AI": { color: "#9B8DD6", connections: ["School","Onderwijs","Toekomst"] },
  "Yn de Mande": { color: "#D4B98A", connections: ["School","Directeursvacature","Meendering"] },
  "Directeursvacature": { color: "#D4B98A", connections: ["School","Yn de Mande","Meendering"] },
  "Bohm-dialoog": { color: "#9B8DD6", connections: ["School","Gemeenschap","Ouders"] },
  "Meendering": { color: "#D4B98A", connections: ["School","Yn de Mande","Directeursvacature"] },
  "Berkenplas": { color: "#6AAF7A", connections: ["Schiermonnikoog","Waddenfonds","Roland Sikkema"] },
  "Natura 2000": { color: "#6DD4D4", connections: ["NSW-landgoed","Biodiversiteit","Schiermonnikoog"] },
  "Gemeenschap": { color: "#6DD4D4", connections: ["Schiermonnikoog","Gastvrijheid","Bohm-dialoog","Founding members"] },
  "Natuur": { color: "#6AAF7A", connections: ["Schiermonnikoog","Biodiversiteit","Natura 2000"] },
  "Seizoenen": { color: "#D4B98A", connections: ["Schiermonnikoog","Natuur"] },
  "Toerisme": { color: "#E8795D", connections: ["Schiermonnikoog","Gastvrijheid"] },
  "Zelfvernieuwing": { color: "#E8795D", connections: ["Re-Creation","Spiritueel"] },
  "Governance": { color: "#8A9AB0", connections: ["Coöperatie","Founding members"] },
  "Europees model": { color: "#8A9AB0", connections: ["Coöperatie"] },
  "Inverted consumer": { color: "#5ABFBF", connections: ["Coöperatie"] },
  "Fysiek": { color: "#E8795D", connections: ["Re-Creation"] },
  "Mentaal-emotioneel": { color: "#E8795D", connections: ["Re-Creation"] },
  "Fiscaal": { color: "#8A9AB0", connections: ["NSW-landgoed"] },
  "Vbr-regeling": { color: "#8A9AB0", connections: ["Fosfaatrechten"] },
  "Strategie": { color: "#5ABFBF", connections: ["Fosfaatrechten","Florida"] },
  "Artisanaal": { color: "#D4B98A", connections: ["Florida","Jersey koeien","Zuivel"] },
  "Zuivel": { color: "#D4B98A", connections: ["Jersey koeien","Artisanaal"] },
  "Mark Shepard": { color: "#E8795D", connections: ["Regeneratief","Food forest"] },
  "Kustcondities": { color: "#6DD4D4", connections: ["Food forest","Schiermonnikoog"] },
  "Polyface": { color: "#6AAF7A", connections: ["Joel Salatin"] },
  "Waddenfonds": { color: "#8A9AB0", connections: ["Berkenplas","Schiermonnikoog"] },
  "Roland Sikkema": { color: "#D4B98A", connections: ["Berkenplas"] },
  "Psychedelica": { color: "#9B8DD6", connections: ["Spiritueel"] },
  "Schaduwwerk": { color: "#9B8DD6", connections: ["Spiritueel"] },
  "Community": { color: "#5ABFBF", connections: ["Founding members","Gemeenschap"] },
  "Ouders": { color: "#D4B98A", connections: ["Onderwijs","Bohm-dialoog"] },
  "Toekomst": { color: "#9B8DD6", connections: ["Onderwijs","AI"] },
};

const ITEMS = [
  { id:1, type:"insight", size:"large", title:"De partiële verkoop van fosfaatrechten als strategische middenweg", who:"Rutger", source:"Claude chat", date:"2026-03-12", ts:20260312, tags:["Florida","Strategie"], color:C.sea, connected:["Jersey koeien","NSW-landgoed","Coöperatie"], excerpt:"Niet alles verkopen, niet alles houden. De 30-35 Jersey koeien als kern behouden." },
  { id:2, type:"media", size:"medium", title:"Gabe Brown — Five Principles of Soil Health", who:"Rutger", source:"YouTube", date:"2026-03-08", ts:20260308, tags:["Regeneratief","Inspiratie"], color:C.coral, connected:["Bodemgezondheid","Biodiversiteit","Florida"], excerpt:"Minimal disturbance. Armor the soil. Diversity. Living roots. Animal integration." },
  { id:3, type:"reflection", size:"medium", title:"Re-Creation is het fundament, niet de marketinglaag", who:"Annelie", source:"Claude chat", date:"2026-03-05", ts:20260305, tags:["Re-Creation","Visie"], color:C.purple, connected:["Spiritueel","Florida","Us Wente"], excerpt:"De drie pijlers van continue zelfvernieuwing." },
  { id:4, type:"document", size:"medium", title:"Brief aan burgemeester Meendering", who:"Rutger", source:"Document", date:"2026-02-22", ts:20260222, tags:["School","Advocacy"], color:C.dune, connected:["Yn de Mande","Directeursvacature","Bohm-dialoog"], excerpt:"Niet klagen maar bouwen." },
  { id:5, type:"connection", size:"small", title:"Joel Salatin × Florida = Polyface aan zee", who:"Rutger", source:"Notitie", date:"2026-02-25", ts:20260225, tags:["Regeneratief","Visie"], color:C.green, connected:["Gabe Brown","Regeneratief","Kringlopen"] },
  { id:6, type:"insight", size:"medium", title:"Anaerobe vergisting als coöperatieve infrastructuur", who:"Rutger", source:"Claude chat", date:"2026-02-15", ts:20260215, tags:["Florida","Energie"], color:C.sea, connected:["Mestvergisting","Coöperatie","Kringlopen"], excerpt:"De mestvergister als gedeelde infrastructuur." },
  { id:7, type:"question", size:"small", title:"Hoe combineer je NSW-status met actieve landbouw?", who:"Annelie", source:"Claude chat", date:"2026-02-18", ts:20260218, tags:["Juridisch","Florida"], color:C.storm, connected:["NSW-landgoed","Natura 2000","Fosfaatrechten"] },
  { id:8, type:"media", size:"small", title:"Mark Shepard — Restoration Agriculture", who:"Rutger", source:"YouTube", date:"2026-02-10", ts:20260210, tags:["Food forest","Regeneratief"], color:C.coral, connected:["Kustcondities","Biodiversiteit","Florida"] },
  { id:9, type:"insight", size:"medium", title:"77 founding members als draagvlak", who:"Annelie", source:"Claude chat", date:"2026-03-01", ts:20260301, tags:["Florida","Coöperatie"], color:C.sea, connected:["Founding members","Governance","Community"], excerpt:"Niet 77 klanten maar 77 mede-eigenaren." },
  { id:10, type:"media", size:"small", title:"Podcast: Boer zoekt toekomst", who:"Annelie", source:"Podcast", date:"2026-02-28", ts:20260228, tags:["Regeneratief","Nederland"], color:C.coral, connected:["Kringlopen","Transitie"] },
  { id:11, type:"document", size:"medium", title:"Investeringsplan De Berkenplas", who:"Rutger", source:"Document", date:"2026-02-14", ts:20260214, tags:["Berkenplas","Investering"], color:C.dune, connected:["Roland Sikkema","Waddenfonds","Schiermonnikoog"], excerpt:"Waddenfonds STUW subsidie als hefboom." },
  { id:12, type:"reflection", size:"small", title:"Schiermonnikoog als laboratorium", who:"Rutger", source:"Claude chat", date:"2026-03-03", ts:20260303, tags:["Schiermonnikoog","Visie"], color:C.seaLt, connected:["Gastvrijheid","Gemeenschap","Natuur"] },
  { id:13, type:"insight", size:"large", title:"Van toeristisch eiland naar gastvrije gemeenschap", who:"Annelie", source:"Claude chat", date:"2026-01-28", ts:20260128, tags:["Schiermonnikoog","Gastvrijheid"], color:C.seaLt, connected:["Toerisme","Gemeenschap","Seizoenen"], excerpt:"De omslag van 'we verdragen toeristen' naar 'we verwelkomen gasten'." },
  { id:14, type:"question", size:"small", title:"Wat Leert Jouw Kind Morgen?", who:"Rutger", source:"Claude chat", date:"2026-03-26", ts:20260326, tags:["School","AI","Onderwijs"], color:C.purple, connected:["Yn de Mande","Toekomst","Ouders"] },
];

const typeLabel = { insight:"Inzicht", media:"Media", reflection:"Reflectie", document:"Document", connection:"Verband", question:"Vraag" };
const typeIcon = { insight:"◆", media:"▶", reflection:"○", document:"▬", connection:"↗", question:"?" };
function fmtDate(d) { const m=["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]; const [y,mo,day]=d.split("-").map(Number); return `${day} ${m[mo-1]}`; }

const OVERVIEW_THEMES = ["Florida", "Re-Creation", "Regeneratief", "Coöperatie", "Schiermonnikoog", "School", "NSW-landgoed", "Spiritueel", "Us Wente", "Energie", "Onderwijs", "Gastvrijheid", "Berkenplas"];

function buildOverviewGraph() {
  const nodes = [];
  const edges = [];
  // Top-level theme nodes
  for (const id of OVERVIEW_THEMES) {
    const k = KNOWLEDGE[id];
    if (!k) continue;
    const connCount = k.connections.filter(c => OVERVIEW_THEMES.includes(c)).length;
    nodes.push({ id, level: 1, color: k.color, r: 1.0 + connCount * 0.2, shape: "sphere" });
  }
  // Edges between top-level themes only
  for (const n of nodes) {
    const k = KNOWLEDGE[n.id];
    if (!k) continue;
    for (const conn of k.connections) {
      if (nodes.find(nd => nd.id === conn) && !edges.find(([a,b]) => (a === n.id && b === conn) || (a === conn && b === n.id))) {
        edges.push([n.id, conn]);
      }
    }
  }
  // Rutger and Annelie as special foundation nodes
  nodes.push({ id: "Rutger", level: 2, color: "#5ABFBF", r: 1.8, shape: "lotus" });
  nodes.push({ id: "Annelie", level: 2, color: "#E8795D", r: 1.8, shape: "lotus" });
  // Connect them to everything as root connections
  for (const n of OVERVIEW_THEMES) {
    edges.push(["Rutger", n, "root"]);
    edges.push(["Annelie", n, "root"]);
  }
  return { nodes, edges };
}

function buildGraphForNode(centerId) {
  const center = KNOWLEDGE[centerId];
  if (!center) return { nodes: [], edges: [] };
  const nodes = [{ id: centerId, level: 0, color: center.color, r: 2.4 }];
  const edges = [];
  const seen = new Set([centerId]);
  for (const conn of center.connections) {
    if (KNOWLEDGE[conn] && !seen.has(conn)) {
      seen.add(conn);
      nodes.push({ id: conn, level: 1, color: KNOWLEDGE[conn].color, r: 1.4 });
      edges.push([centerId, conn]);
    }
  }
  const level1 = nodes.filter(n => n.level === 1).map(n => n.id);
  for (const l1 of level1) {
    const l1data = KNOWLEDGE[l1];
    if (!l1data) continue;
    let added = 0;
    for (const conn of l1data.connections) {
      if (conn === centerId) continue;
      if (seen.has(conn)) { if (nodes.find(n => n.id === conn)) edges.push([l1, conn]); continue; }
      if (KNOWLEDGE[conn] && added < 2) {
        seen.add(conn);
        nodes.push({ id: conn, level: 2, color: KNOWLEDGE[conn].color, r: 0.8 });
        edges.push([l1, conn]);
        added++;
      }
    }
  }
  // Always include Rutger and Annelie as foundation lotuses
  if (!seen.has("Rutger")) nodes.push({ id: "Rutger", level: 2, color: "#5ABFBF", r: 1.8, shape: "lotus" });
  if (!seen.has("Annelie")) nodes.push({ id: "Annelie", level: 2, color: "#E8795D", r: 1.8, shape: "lotus" });
  // Root connections: every theme node connects down to both persons
  const themeIds = nodes.filter(n => n.shape !== "lotus").map(n => n.id);
  for (const tid of themeIds) {
    edges.push([tid, "Rutger", "root"]);
    edges.push([tid, "Annelie", "root"]);
  }
  return { nodes, edges };
}

function ThreeGraph({ centerId, onNodeClick, path, fullscreen, onToggleFullscreen }) {
  const mountRef = useRef(null);
  const labelsRef = useRef(null);
  const stateRef = useRef({ renderer: null, scene: null, camera: null, frame: null, nodes: [], edges: [], labels: [], raycaster: null, mouse: null, hovered: null, clock: null, htmlLabels: [] });
  const graphDataRef = useRef({ nodes: [], edges: [] });

  const setupScene = useCallback(() => {
    const el = mountRef.current;
    if (!el || stateRef.current.renderer) return;
    const THREE = window.THREE;
    if (!THREE) return;

    const w = el.clientWidth, h = el.clientHeight || 420;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08080A, 0.006);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    camera.position.set(0, 8, 38);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0x606080, 0.8);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x5ABFBF, 1.5, 120);
    pointLight.position.set(10, 15, 10);
    scene.add(pointLight);
    const pointLight2 = new THREE.PointLight(0xE8795D, 0.8, 100);
    pointLight2.position.set(-10, -5, 8);
    scene.add(pointLight2);

    // Particle field background
    const particleCount = 200;
    const particleGeom = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePos[i*3] = (Math.random()-0.5)*120;
      particlePos[i*3+1] = (Math.random()-0.5)*80;
      particlePos[i*3+2] = (Math.random()-0.5)*60 - 20;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x5ABFBF, size: 0.08, transparent: true, opacity: 0.3, sizeAttenuation: true });
    scene.add(new THREE.Points(particleGeom, particleMat));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    const clock = new THREE.Clock();

    stateRef.current = { renderer, scene, camera, frame: null, nodes: [], edges: [], labels: [], raycaster, mouse, hovered: null, selected: null, clock, el, w, h, zoom: 1, drag: { active: false, prevX: 0, prevY: 0, rotX: 0, rotY: 0.3, autoSpeed: 0.08, idleTime: 0 }, lookTarget: { x: 0, y: 0, z: 0 }, lookCurrent: { x: 0, y: 0, z: 0 }, targetZoom: 1 };
  }, []);

  const buildGraph = useCallback((cid) => {
    const THREE = window.THREE;
    const st = stateRef.current;
    if (!THREE || !st.scene) return;

    // Remove old objects
    for (const obj of [...st.nodes, ...st.edges, ...st.labels]) st.scene.remove(obj);
    st.nodes = []; st.edges = []; st.labels = [];

    const isOverview = cid === "__overview__";
    const data = isOverview ? buildOverviewGraph() : buildGraphForNode(cid);
    graphDataRef.current = data;

    // Count connections per node for height calculation
    const connCount = {};
    for (const n of data.nodes) connCount[n.id] = 0;
    for (const [a, b] of data.edges) {
      connCount[a] = (connCount[a] || 0) + 1;
      connCount[b] = (connCount[b] || 0) + 1;
    }
    const maxConn = Math.max(1, ...Object.values(connCount));

    // MYCELIUM FLOOR PLANE — dark translucent disc at y = -12
    const floorY = -12;
    const floorGeom = new THREE.CircleGeometry(35, 64);
    const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#1A1916"), transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    st.scene.add(floor);
    st.labels.push(floor);

    // Mycelium network lines on the floor
    const myceliumGroup = new THREE.Group();
    myceliumGroup.position.y = floorY + 0.05;
    st.scene.add(myceliumGroup);
    st.labels.push(myceliumGroup);

    // Force-directed initial positions with connected nodes closer
    const positions = {};
    const themeNodes = data.nodes.filter(n => n.shape !== "lotus");
    const pyramidNodes = data.nodes.filter(n => n.shape === "lotus");

    // Initial layout: circle, but we'll run a mini force simulation
    themeNodes.forEach((n, i) => {
      const angle = (i / themeNodes.length) * Math.PI * 2 - Math.PI / 2;
      const dist = isOverview ? 12 + Math.random() * 3 : (n.level === 0 ? 0 : n.level === 1 ? 9 + Math.random() * 3 : 16 + Math.random() * 3);
      // Height based on connection count: more connections = higher
      const heightFrac = (connCount[n.id] || 0) / maxConn;
      const height = 2 + heightFrac * 14; // range: 2 to 16 above floor
      positions[n.id] = { x: Math.cos(angle) * dist, y: height, z: Math.sin(angle) * dist, vx: 0, vy: 0, vz: 0, height };
    });

    // Pyramids on the floor plane, slightly embedded
    pyramidNodes.forEach((n, i) => {
      const xOff = i === 0 ? -10 : 10;
      positions[n.id] = { x: xOff, y: floorY + 2.5, z: 0, vx: 0, vy: 0, vz: 0, height: 0 };
    });

    // Mini force simulation: 40 iterations to pull connected nodes closer on XZ plane
    for (let iter = 0; iter < 40; iter++) {
      // Repulsion between all theme nodes
      for (let i = 0; i < themeNodes.length; i++) {
        for (let j = i + 1; j < themeNodes.length; j++) {
          const a = positions[themeNodes[i].id], b = positions[themeNodes[j].id];
          const dx = a.x - b.x, dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dz * dz) + 0.1;
          const repulse = 8 / (dist * dist);
          a.vx += (dx / dist) * repulse;
          a.vz += (dz / dist) * repulse;
          b.vx -= (dx / dist) * repulse;
          b.vz -= (dz / dist) * repulse;
        }
      }
      // Attraction along edges
      for (const [aId, bId] of data.edges) {
        const a = positions[aId], b = positions[bId];
        if (!a || !b) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz) + 0.1;
        const attract = dist * 0.015;
        a.vx += (dx / dist) * attract;
        a.vz += (dz / dist) * attract;
        b.vx -= (dx / dist) * attract;
        b.vz -= (dz / dist) * attract;
      }
      // Apply velocities with damping
      for (const n of themeNodes) {
        const p = positions[n.id];
        p.x += p.vx * 0.3;
        p.z += p.vz * 0.3;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }
    }

    // Center the layout
    let cx = 0, cz = 0, cnt = 0;
    for (const n of themeNodes) { cx += positions[n.id].x; cz += positions[n.id].z; cnt++; }
    if (cnt > 0) { cx /= cnt; cz /= cnt; for (const n of themeNodes) { positions[n.id].x -= cx; positions[n.id].z -= cz; } }

    // Create node meshes
    // Helper: create a single parametric petal using BufferGeometry
    function createPetal(THREE, petalLength, petalWidth, curlHeight, segments) {
      const verts = [];
      const normals = [];
      const segsU = segments || 12;
      const segsV = 6;
      for (let iu = 0; iu <= segsU; iu++) {
        const u = iu / segsU; // 0..1 along petal length
        for (let iv = 0; iv <= segsV; iv++) {
          const v = (iv / segsV) * 2 - 1; // -1..1 across petal width
          // Petal shape: wider in middle, tapered at tip and base
          const widthScale = Math.sin(u * Math.PI) * (1 - 0.3 * u);
          const x = u * petalLength;
          const z = v * petalWidth * widthScale;
          // Curl upward at edges and tip
          const edgeCurl = Math.abs(v) * Math.abs(v) * curlHeight * 0.5;
          const tipCurl = u * u * curlHeight;
          const baseDip = (1 - u) * (1 - u) * curlHeight * 0.2;
          const y = tipCurl + edgeCurl - baseDip;
          verts.push(x, y, z);
          // Approximate normal (pointing mostly up)
          const ny = 1 - Math.abs(v) * 0.3;
          normals.push(0, ny, v * 0.3);
        }
      }
      const indices = [];
      for (let iu = 0; iu < segsU; iu++) {
        for (let iv = 0; iv < segsV; iv++) {
          const a = iu * (segsV + 1) + iv;
          const b = a + segsV + 1;
          indices.push(a, b, a + 1);
          indices.push(b, b + 1, a + 1);
        }
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setIndex(indices);
      return geom;
    }

    for (const n of data.nodes) {
      const color = new THREE.Color(n.color);
      let geom;
      const isLotus = n.shape === "lotus";
      if (isLotus) {
        // Lotus center: a glowing dome
        geom = new THREE.SphereGeometry(n.r * 0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
      } else {
        geom = new THREE.SphereGeometry(n.r, 24, 24);
      }
      const isCenter = !isOverview && n.level === 0;
      const mat = new THREE.MeshPhongMaterial({
        color: isLotus ? new THREE.Color(n.color).lerp(new THREE.Color("#ffffff"), 0.3) : color,
        emissive: color,
        emissiveIntensity: isLotus ? 0.8 : isCenter ? 0.5 : 0.25,
        transparent: true,
        opacity: 0,
        shininess: isLotus ? 120 : 60,
      });
      const mesh = new THREE.Mesh(geom, mat);
      const p = positions[n.id];
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData = {
        id: n.id,
        level: n.level,
        targetOpacity: isLotus ? 0.95 : isCenter ? 1 : isOverview ? 0.85 : n.level === 1 ? 0.9 : 0.6,
        baseEmissive: isLotus ? 0.8 : isCenter ? 0.5 : 0.25,
        pos: p,
        isLotus,
      };
      st.scene.add(mesh);
      st.nodes.push(mesh);

      // PARAMETRIC LOTUS: 3 layers of petals, each rotated and scaled
      if (isLotus) {
        const layers = [
          { petals: 8, length: n.r * 1.6, width: n.r * 0.35, curl: n.r * 0.5, rotOffset: 0, yOff: -0.05, opacity: 0.8 },
          { petals: 8, length: n.r * 1.25, width: n.r * 0.3, curl: n.r * 0.7, rotOffset: Math.PI / 8, yOff: 0.08, opacity: 0.7 },
          { petals: 6, length: n.r * 0.85, width: n.r * 0.25, curl: n.r * 0.9, rotOffset: Math.PI / 12, yOff: 0.18, opacity: 0.65 },
        ];

        for (const layer of layers) {
          for (let pi = 0; pi < layer.petals; pi++) {
            const angle = (pi / layer.petals) * Math.PI * 2 + layer.rotOffset;
            const petalGeom = createPetal(THREE, layer.length, layer.width, layer.curl, 10);

            // Color: inner layers lighter, outer layers deeper
            const petalColor = new THREE.Color(n.color).lerp(new THREE.Color("#ffffff"), layer.yOff * 2);
            const petalMat = new THREE.MeshPhongMaterial({
              color: petalColor,
              emissive: color,
              emissiveIntensity: 0.35,
              transparent: true,
              opacity: 0,
              shininess: 90,
              side: THREE.DoubleSide,
            });

            const petalMesh = new THREE.Mesh(petalGeom, petalMat);
            // Position petal at center, rotate around Y to spread
            petalMesh.position.set(p.x, p.y + layer.yOff, p.z);
            petalMesh.rotation.y = angle;
            petalMesh.userData = {
              isLotusDetail: true,
              parentId: n.id,
              targetOpacity: layer.opacity,
              petalAngle: angle,
              layerYOff: layer.yOff,
            };
            st.scene.add(petalMesh);
            st.labels.push(petalMesh);
          }
        }

        // Soft glow disc under the lotus
        const glowGeom = new THREE.CircleGeometry(n.r * 2.2, 32);
        const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const glowMesh = new THREE.Mesh(glowGeom, glowMat);
        glowMesh.rotation.x = -Math.PI / 2;
        glowMesh.position.set(p.x, p.y - 0.1, p.z);
        glowMesh.userData = { isGlow: true, parentId: n.id, targetOpacity: 0.1 };
        st.scene.add(glowMesh);
        st.labels.push(glowMesh);

        // WATER RIPPLES: 3 concentric rings expanding outward
        for (let ring = 0; ring < 3; ring++) {
          const ringRadius = n.r * (2.5 + ring * 1.6);
          const ringGeom = new THREE.RingGeometry(ringRadius - 0.05, ringRadius + 0.05, 64);
          const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeom, ringMat);
          ringMesh.rotation.x = -Math.PI / 2;
          ringMesh.position.set(p.x, floorY + 0.12, p.z);
          ringMesh.userData = {
            isRipple: true,
            parentId: n.id,
            ringIndex: ring,
            baseRadius: ringRadius,
            targetOpacity: 0.2 - ring * 0.05,
            floorY: floorY + 0.12,
          };
          st.scene.add(ringMesh);
          st.labels.push(ringMesh);
        }
      }

      // SHADOW RINGS on the floor — projected beneath each floating node
      if (!isLotus) {
        const heightAboveFloor = p.y - floorY;
        const shadowRadius = n.r * (1 + heightAboveFloor * 0.08);
        const shadowOpacity = Math.max(0.04, 0.2 - heightAboveFloor * 0.008);
        const shadowGeom = new THREE.RingGeometry(shadowRadius * 0.3, shadowRadius, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const shadow = new THREE.Mesh(shadowGeom, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(p.x, floorY + 0.1, p.z);
        shadow.userData = { isShadow: true, parentId: n.id, targetOpacity: shadowOpacity, floorY: floorY + 0.1 };
        st.scene.add(shadow);
        st.labels.push(shadow);
      }

      // Neon glow rings for center node
      if (isCenter) {
        const glowLayers = [
          { inner: n.r + 2.5, outer: n.r + 4.0, opacity: 0.06 },
          { inner: n.r + 1.6, outer: n.r + 2.8, opacity: 0.12 },
          { inner: n.r + 1.0, outer: n.r + 1.8, opacity: 0.2 },
        ];
        for (const gl of glowLayers) {
          const glowGeom = new THREE.RingGeometry(gl.inner, gl.outer, 64);
          const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, side: THREE.DoubleSide });
          const glowMesh = new THREE.Mesh(glowGeom, glowMat);
          glowMesh.position.copy(mesh.position);
          glowMesh.userData = { isGlow: true, parentId: n.id, targetOpacity: gl.opacity };
          st.scene.add(glowMesh);
          st.labels.push(glowMesh);
        }
        const ringGeom = new THREE.TorusGeometry(n.r + 1.2, 0.08, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.copy(mesh.position);
        ring.userData = { isRing: true, parentId: n.id, color: n.color };
        st.scene.add(ring);
        st.labels.push(ring);
      }
    }

    // MYCELIUM THREADS on the floor — ALL connections mirrored on the ground
    for (const edge of data.edges) {
      const [aId, bId, edgeType] = edge;
      const pa = positions[aId], pb = positions[bId];
      if (!pa || !pb) continue;
      const points = [];
      const segments = 14;
      // Root edges to lotuses get a different color (person color)
      const isRootEdge = edgeType === "root";
      const lotusNode = isRootEdge ? data.nodes.find(n => n.id === bId && n.shape === "lotus") || data.nodes.find(n => n.id === aId && n.shape === "lotus") : null;
      const threadColor = lotusNode ? lotusNode.color : "#3A3530";
      // More wobble for root connections (organic feel), less for theme-to-theme
      const wobbleAmount = isRootEdge ? 2.5 : 1.5;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = pa.x + (pb.x - pa.x) * t + (Math.random() - 0.5) * wobbleAmount;
        const z = pa.z + (pb.z - pa.z) * t + (Math.random() - 0.5) * wobbleAmount;
        points.push(new THREE.Vector3(x, 0, z));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeom = new THREE.TubeGeometry(curve, 18, isRootEdge ? 0.05 : 0.04, 4, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(threadColor),
        transparent: true,
        opacity: 0,
      });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      tube.userData = { isMycelium: true, targetOpacity: isRootEdge ? 0.2 : 0.3, aId, bId, glowActive: false, baseColor: threadColor };
      myceliumGroup.add(tube);
      st.labels.push(tube);
    }

    // ROOT CONNECTIONS: organic curly roots from bollen down to pyramids
    for (const edge of data.edges) {
      const [aId, bId, edgeType] = edge;
      if (edgeType !== "root") continue;
      const pa = positions[aId], pb = positions[bId];
      if (!pa || !pb) continue;

      // Determine which is the node and which is the pyramid
      const nodePos = pa.height !== undefined && pa.height > 0 ? pa : pb;
      const pyramidPos = pa.height !== undefined && pa.height > 0 ? pb : pa;
      const nodeId = pa === nodePos ? aId : bId;
      const pyramidId = pa === pyramidPos ? aId : bId;

      // Build organic curly root path from node down to pyramid
      const points = [];
      const segments = 16;
      const seed = (nodeId + pyramidId).length * 7.3; // deterministic randomness per pair
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        // Interpolate position
        const x = nodePos.x + (pyramidPos.x - nodePos.x) * t;
        const y = nodePos.y + (pyramidPos.y - nodePos.y) * t;
        const z = nodePos.z + (pyramidPos.z - nodePos.z) * t;
        // Add organic wobble — stronger in the middle, zero at endpoints
        const wobbleStrength = Math.sin(t * Math.PI) * 2.5;
        const wobbleX = Math.sin(seed + t * 8.7) * wobbleStrength;
        const wobbleZ = Math.cos(seed * 1.3 + t * 6.2) * wobbleStrength;
        const wobbleY = Math.sin(seed * 0.7 + t * 5.1) * wobbleStrength * 0.4;
        points.push(new THREE.Vector3(x + wobbleX, y + wobbleY, z + wobbleZ));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const pyramidNode = data.nodes.find(n => n.id === pyramidId);
      const rootColor = pyramidNode ? pyramidNode.color : "#5A5850";
      const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.03, 4, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(rootColor),
        transparent: true,
        opacity: 0,
      });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      tube.userData = { isRoot: true, targetOpacity: 0.18, aId, bId, glowActive: false, baseColor: rootColor };
      st.scene.add(tube);
      st.labels.push(tube);
    }

    // Create edge tubes between floating nodes (aerial connections, skip root edges)
    for (const edge of data.edges) {
      const [aId, bId, edgeType] = edge;
      if (edgeType === "root") continue; // roots already drawn as curly tubes
      const pa = positions[aId], pb = positions[bId];
      if (!pa || !pb) continue;
      const start = new THREE.Vector3(pa.x, pa.y, pa.z);
      const end = new THREE.Vector3(pb.x, pb.y, pb.z);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const len = start.distanceTo(end);

      const aNode = data.nodes.find(n => n.id === aId);
      const bNode = data.nodes.find(n => n.id === bId);
      const isCenter = (aNode && aNode.level === 0) || (bNode && bNode.level === 0);
      const edgeColor = isCenter ? (aNode && aNode.level === 0 ? aNode.color : bNode.color) : "#5A5850";
      const color = new THREE.Color(edgeColor);

      const geom = new THREE.CylinderGeometry(0.05, 0.05, len, 4, 1);
      geom.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(mid);
      mesh.lookAt(end);
      mesh.userData = { aId, bId, targetOpacity: isCenter ? 0.5 : 0.25, start, end, isEdge: true };
      st.scene.add(mesh);
      st.edges.push(mesh);
    }

    // HTML labels
    const lc = labelsRef.current;
    if (lc) {
      lc.innerHTML = "";
      st.htmlLabels = [];
      for (const n of data.nodes) {
        const label = document.createElement("div");
        label.textContent = n.id;
        label.style.cssText = `position:absolute;pointer-events:none;font-family:DM Sans,system-ui,sans-serif;text-align:center;white-space:nowrap;transition:opacity 0.3s;opacity:0;text-shadow:0 0 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5);`;
        label.style.fontSize = n.level === 0 ? "14px" : n.level === 1 ? "12px" : "10px";
        label.style.fontWeight = n.level === 0 ? "600" : "400";
        label.style.color = n.level === 0 ? "#E8E4DC" : n.level === 1 ? "#C4BFB4" : "#7A766C";
        lc.appendChild(label);
        st.htmlLabels.push({ el: label, nodeId: n.id, level: n.level });
      }
    }
  }, []);

  const animateRef = useRef(null);

  animateRef.current = () => {
    const THREE = window.THREE;
    const st = stateRef.current;
    if (!st.renderer) return;

    const time = st.clock.getElapsedTime();

    // Camera orbit: manual drag + gentle auto-drift when idle
    const d = st.drag;
    if (!d.active) {
      d.idleTime += 0.016;
      const autoBlend = Math.min(1, d.idleTime / 1.5);
      d.rotX += d.autoSpeed * 0.016 * autoBlend;
    }

    // Smooth zoom interpolation
    st.zoom += (st.targetZoom - st.zoom) * 0.06;
    const camDist = 38 / (st.zoom || 1);

    // Smooth lookTarget interpolation
    st.lookCurrent.x += (st.lookTarget.x - st.lookCurrent.x) * 0.04;
    st.lookCurrent.y += (st.lookTarget.y - st.lookCurrent.y) * 0.04;
    st.lookCurrent.z += (st.lookTarget.z - st.lookCurrent.z) * 0.04;

    st.camera.position.x = st.lookCurrent.x + Math.sin(d.rotX) * Math.cos(d.rotY) * camDist;
    st.camera.position.z = st.lookCurrent.z + Math.cos(d.rotX) * Math.cos(d.rotY) * camDist;
    st.camera.position.y = st.lookCurrent.y + Math.sin(d.rotY) * camDist;
    st.camera.lookAt(st.lookCurrent.x, st.lookCurrent.y, st.lookCurrent.z);

    // Animate nodes: fade in, gentle float
    for (const mesh of st.nodes) {
      const ud = mesh.userData;
      mesh.material.opacity += (ud.targetOpacity - mesh.material.opacity) * 0.04;
      if (ud.isLotus) {
        // Lotus: gentle bob on the water surface
        mesh.position.y = ud.pos.y + Math.sin(time * 0.6) * 0.2;
        mesh.material.emissiveIntensity = ud.baseEmissive + Math.sin(time * 1.0) * 0.15;
      } else {
        mesh.position.y = ud.pos.y + Math.sin(time * 0.5 + mesh.position.x) * 0.3;
        if (ud.level === 0) {
          const pulse = 1 + Math.sin(time * 2) * 0.04;
          mesh.scale.set(pulse, pulse, pulse);
          mesh.material.emissiveIntensity = ud.baseEmissive + Math.sin(time * 1.5) * 0.1;
        }
      }
    }

    // Animate edge tubes: update positions to follow nodes, fade in
    for (const edge of st.edges) {
      if (!edge.userData.isEdge) continue;
      edge.material.opacity += (edge.userData.targetOpacity - edge.material.opacity) * 0.04;
      const nodeA = st.nodes.find(n => n.userData.id === edge.userData.aId);
      const nodeB = st.nodes.find(n => n.userData.id === edge.userData.bId);
      if (nodeA && nodeB) {
        const mid = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5);
        edge.position.copy(mid);
        edge.lookAt(nodeB.position);
        const len = nodeA.position.distanceTo(nodeB.position);
        edge.scale.set(1, 1, len / (edge.userData.start.distanceTo(edge.userData.end) || 1));
      }
    }

    // Animate neon glow rings, shadow rings, and mycelium
    for (const obj of st.labels) {
      if (!obj.userData) continue;

      // Lotus petals: follow parent position, gentle breathing sway
      if (obj.userData.isLotusDetail) {
        const parent = st.nodes.find(n => n.userData.id === obj.userData.parentId);
        if (parent) {
          obj.position.x = parent.position.x;
          obj.position.z = parent.position.z;
          obj.position.y = parent.position.y + obj.userData.layerYOff;
          // Subtle breathing: petals gently open and close
          const breathe = 1 + Math.sin(time * 0.4 + obj.userData.petalAngle) * 0.03;
          obj.scale.set(breathe, breathe, breathe);
          obj.material.opacity += (obj.userData.targetOpacity * parent.material.opacity - obj.material.opacity) * 0.04;
        }
        continue;
      }

      // Water ripples: expand slowly, pulse, follow parent XZ
      if (obj.userData.isRipple) {
        const parent = st.nodes.find(n => n.userData.id === obj.userData.parentId);
        if (parent) {
          obj.position.x = parent.position.x;
          obj.position.z = parent.position.z;
          obj.position.y = obj.userData.floorY;
          // Slowly expand and contract
          const expand = 1 + Math.sin(time * 0.35 - obj.userData.ringIndex * 0.8) * 0.12;
          obj.scale.set(expand, expand, 1);
          const fade = 1 + Math.sin(time * 0.5 - obj.userData.ringIndex * 1.2) * 0.3;
          const target = obj.userData.targetOpacity * fade;
          obj.material.opacity += (target - obj.material.opacity) * 0.03;
        }
        continue;
      }

      // Shadow rings: follow parent XZ position, stay on floor, pulse gently
      if (obj.userData.isShadow) {
        const parent = st.nodes.find(n => n.userData.id === obj.userData.parentId);
        if (parent) {
          obj.position.x = parent.position.x;
          obj.position.z = parent.position.z;
          obj.position.y = obj.userData.floorY;
          const breathe = 1 + Math.sin(time * 0.8 + parent.position.x) * 0.15;
          const target = obj.userData.targetOpacity * breathe;
          obj.material.opacity += (target - obj.material.opacity) * 0.04;
        }
        continue;
      }

      // Mycelium threads: slow fade in, neon pulse when active
      if (obj.userData.isMycelium) {
        if (obj.userData.glowActive) {
          // Neon pulse: bright oscillation
          const neonPulse = 0.65 + Math.sin(time * 3.5 + (obj.id || 0)) * 0.25;
          obj.material.opacity += (neonPulse - obj.material.opacity) * 0.08;
        } else {
          const pulse = 1 + Math.sin(time * 0.6 + (obj.id || 0)) * 0.2;
          const target = obj.userData.targetOpacity * pulse;
          obj.material.opacity += (target - obj.material.opacity) * 0.03;
        }
        continue;
      }

      // Root connections: gentle fade in, neon pulse when active
      if (obj.userData.isRoot) {
        if (obj.userData.glowActive) {
          const neonPulse = 0.7 + Math.sin(time * 3.0 + (obj.id || 0) * 2) * 0.2;
          obj.material.opacity += (neonPulse - obj.material.opacity) * 0.08;
        } else {
          const pulse = 1 + Math.sin(time * 0.4 + (obj.id || 0) * 3) * 0.25;
          const target = obj.userData.targetOpacity * pulse;
          obj.material.opacity += (target - obj.material.opacity) * 0.03;
        }
        continue;
      }

      const parent = st.nodes.find(n => n.userData.id === obj.userData.parentId);
      if (!parent) continue;

      if (obj.userData.isGlow) {
        const breathe = 1 + Math.sin(time * 1.2) * 0.3;
        const target = obj.userData.targetOpacity * breathe;
        obj.material.opacity += (target - obj.material.opacity) * 0.04;
        obj.position.copy(parent.position);
        obj.lookAt(st.camera.position);
      }

      if (obj.userData.isRing) {
        const neonPulse = 0.7 + Math.sin(time * 2.5) * 0.3;
        obj.material.opacity += (neonPulse - obj.material.opacity) * 0.06;
        obj.material.color.set(obj.userData.color);
        obj.material.color.lerp(new THREE.Color(0xffffff), 0.4 + Math.sin(time * 3) * 0.15);
        obj.rotation.x = Math.PI / 2;
        obj.rotation.z = time * 0.5;
        obj.position.copy(parent.position);
        const s = 1 + Math.sin(time * 2) * 0.03;
        obj.scale.set(s, s, s);
      }
    }

    // Raycasting for hover
    st.raycaster.setFromCamera(st.mouse, st.camera);
    const intersects = st.raycaster.intersectObjects(st.nodes);
    const rawHovered = intersects.length > 0 ? intersects[0].object.userData.id : null;

    // Determine active node: hover takes priority, selected persists
    const activeNode = rawHovered || st.selected || null;

    // Build connected set for active node
    const hovConns = new Set();
    if (activeNode) {
      hovConns.add(activeNode);
      for (const line of st.edges) {
        if (line.userData.aId === activeNode) hovConns.add(line.userData.bId);
        if (line.userData.bId === activeNode) hovConns.add(line.userData.aId);
      }
    }

    // Apply glow state every frame
    if (activeNode) {
      // Nodes: highlight connected, dim others
      for (const mesh of st.nodes) {
        const ud = mesh.userData;
        if (!hovConns.has(ud.id)) { ud.targetOpacity = 0.1; mesh.material.emissiveIntensity = ud.baseEmissive; }
        else if (ud.id === activeNode) { ud.targetOpacity = 1; mesh.material.emissiveIntensity = 0.8; }
        else { ud.targetOpacity = ud.level === 0 ? 1 : ud.level === 1 ? 0.9 : 0.6; mesh.material.emissiveIntensity = ud.baseEmissive; }
      }
      // Aerial edges
      for (const line of st.edges) {
        if (line.userData.aId === activeNode || line.userData.bId === activeNode) line.userData.targetOpacity = 0.95;
        else line.userData.targetOpacity = 0.06;
      }
      // Mycelium + Root connections: neon glow on connected
      const hoveredMesh = st.nodes.find(n => n.userData.id === activeNode);
      const glowColor = hoveredMesh ? "#" + hoveredMesh.material.color.getHexString() : "#5ABFBF";
      for (const obj of st.labels) {
        if (obj.userData && obj.userData.isMycelium) {
          const connected = obj.userData.aId === activeNode || obj.userData.bId === activeNode;
          obj.userData.glowActive = connected;
          if (connected) {
            obj.material.color.set(glowColor);
            obj.userData.targetOpacity = 0.85;
          } else {
            obj.material.color.set(obj.userData.baseColor || "#3A3530");
            obj.userData.targetOpacity = 0.05;
          }
        }
        if (obj.userData && obj.userData.isRoot) {
          const connected = obj.userData.aId === activeNode || obj.userData.bId === activeNode;
          obj.userData.glowActive = connected;
          if (connected) {
            obj.material.color.set(glowColor);
            obj.userData.targetOpacity = 0.9;
          } else {
            obj.material.color.set(obj.userData.baseColor || "#5A5850");
            obj.userData.targetOpacity = 0.04;
          }
        }
      }
    } else {
      // Nothing active: reset everything
      for (const mesh of st.nodes) {
        const ud = mesh.userData;
        ud.targetOpacity = ud.isLotus ? 0.95 : ud.level === 0 ? 1 : ud.level === 1 ? 0.9 : 0.6;
        mesh.material.emissiveIntensity = ud.baseEmissive;
      }
      for (const line of st.edges) line.userData.targetOpacity = line.userData.isEdge ? 0.35 : 0.25;
      for (const obj of st.labels) {
        if (obj.userData && obj.userData.isMycelium) {
          obj.userData.targetOpacity = 0.3;
          obj.userData.glowActive = false;
          if (obj.material) obj.material.color.set(obj.userData.baseColor || "#3A3530");
        }
        if (obj.userData && obj.userData.isRoot) {
          obj.userData.targetOpacity = 0.18;
          obj.userData.glowActive = false;
          if (obj.material) obj.material.color.set(obj.userData.baseColor || "#5A5850");
        }
      }
    }

    st.hovered = activeNode;

    if (st.el) st.el.style.cursor = rawHovered ? "pointer" : "default";

    // Project 3D to 2D for HTML labels
    if (st.htmlLabels && st.htmlLabels.length > 0 && THREE) {
      const tempVec = new THREE.Vector3();
      for (const lbl of st.htmlLabels) {
        const mesh = st.nodes.find(m => m.userData.id === lbl.nodeId);
        if (!mesh) continue;
        tempVec.copy(mesh.position);
        tempVec.y -= (lbl.level === 0 ? 3.8 : lbl.level === 1 ? 2.6 : 1.8);
        tempVec.project(st.camera);
        const x = (tempVec.x * 0.5 + 0.5) * st.w;
        const y = (-tempVec.y * 0.5 + 0.5) * st.h;
        lbl.el.style.left = x + "px";
        lbl.el.style.top = y + "px";
        lbl.el.style.transform = "translate(-50%, 0)";
        const nodeOpacity = mesh.material.opacity;
        const behindCamera = tempVec.z > 1;
        lbl.el.style.opacity = behindCamera ? "0" : String(Math.min(nodeOpacity, 0.95));
        if (lbl.nodeId === activeNode) {
          lbl.el.style.color = "#E8E4DC";
          lbl.el.style.fontWeight = "600";
          lbl.el.style.fontSize = "14px";
        } else if (activeNode && !hovConns.has(lbl.nodeId) && lbl.level !== 0) {
          lbl.el.style.color = "#3A3835";
        } else {
          lbl.el.style.color = lbl.level === 0 ? "#E8E4DC" : lbl.level === 1 ? "#C4BFB4" : "#7A766C";
          lbl.el.style.fontWeight = lbl.level === 0 ? "600" : "400";
          lbl.el.style.fontSize = lbl.level === 0 ? "14px" : lbl.level === 1 ? "12px" : "10px";
        }
      }
    }

    st.renderer.render(st.scene, st.camera);
    st.frame = requestAnimationFrame(() => animateRef.current?.());
  };

  // Mouse handlers with drag rotation
  const dragStartRef = useRef({ x: 0, y: 0, moved: false });

  const onMouseDown = useCallback((e) => {
    const st = stateRef.current;
    st.drag.active = true;
    st.drag.prevX = e.clientX;
    st.drag.prevY = e.clientY;
    dragStartRef.current.x = e.clientX;
    dragStartRef.current.y = e.clientY;
    dragStartRef.current.moved = false;
  }, []);

  const onMouseMove = useCallback((e) => {
    const st = stateRef.current;
    if (!st.el) return;
    const rect = st.el.getBoundingClientRect();
    st.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    st.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (st.drag.active) {
      const dx = e.clientX - st.drag.prevX;
      const dy = e.clientY - st.drag.prevY;
      st.drag.rotX += dx * 0.008;
      st.drag.rotY = Math.max(-1.2, Math.min(1.2, st.drag.rotY + dy * 0.008));
      st.drag.prevX = e.clientX;
      st.drag.prevY = e.clientY;
      st.drag.idleTime = 0;

      const totalDrag = Math.abs(e.clientX - dragStartRef.current.x) + Math.abs(e.clientY - dragStartRef.current.y);
      if (totalDrag > 8) dragStartRef.current.moved = true;
    }
  }, []);

  const onMouseUp = useCallback(() => {
    stateRef.current.drag.active = false;
  }, []);

  const onClick = useCallback((e) => {
    if (dragStartRef.current.moved) return;
    const st = stateRef.current;
    if (!st.el || !st.raycaster || !st.camera) return;

    // Re-raycast at the exact click position for accuracy
    const rect = st.el.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    st.raycaster.setFromCamera(mouse, st.camera);
    const intersects = st.raycaster.intersectObjects(st.nodes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const clicked = clickedMesh.userData.id;

      // Set selected state — glow persists until next click
      st.selected = clicked;

      // Smoothly move camera focus to the clicked object
      st.lookTarget.x = clickedMesh.position.x;
      st.lookTarget.y = clickedMesh.position.y;
      st.lookTarget.z = clickedMesh.position.z;

      // Calculate zoom: find the farthest node from the clicked one,
      // then set zoom so everything fits in view
      let maxDist = 0;
      for (const node of st.nodes) {
        const dx = node.position.x - clickedMesh.position.x;
        const dy = node.position.y - clickedMesh.position.y;
        const dz = node.position.z - clickedMesh.position.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > maxDist) maxDist = dist;
      }
      // Zoom so that the farthest node is comfortably in view
      // 38 is the base camera distance, we want maxDist to fit in ~60% of the view
      const desiredDist = Math.max(25, maxDist * 1.6);
      st.targetZoom = 38 / desiredDist;

      // Reset idle timer so auto-rotation pauses briefly
      st.drag.idleTime = 0;

      // Trigger navigation after a short delay to let the camera focus first
      if (clicked) {
        setTimeout(() => onNodeClick(clicked), 400);
      }
    }
  }, [onNodeClick]);

  const onMouseLeave = useCallback(() => {
    stateRef.current.mouse.set(-999, -999);
    stateRef.current.drag.active = false;
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const st = stateRef.current;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    st.targetZoom = Math.max(0.4, Math.min(3, (st.targetZoom || 1) + delta));
  }, []);

  // Init Three.js — load script once, handle already-loaded case
  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      setupScene();
      buildGraph(centerId);
      stateRef.current.frame = requestAnimationFrame(() => animateRef.current?.());
    };

    if (window.THREE) {
      init();
    } else {
      const existing = document.querySelector('script[src*="three.min.js"]');
      if (existing) {
        existing.addEventListener("load", init);
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        script.onload = init;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(stateRef.current.frame);
      if (stateRef.current.renderer && stateRef.current.el) {
        try { stateRef.current.el.removeChild(stateRef.current.renderer.domElement); } catch(e) {}
        stateRef.current.renderer.dispose();
        stateRef.current.renderer = null;
      }
    };
  }, []);

  // Rebuild graph on centerId change
  useEffect(() => {
    if (stateRef.current.scene) {
      // Reset camera focus for new graph
      stateRef.current.lookTarget = { x: 0, y: 0, z: 0 };
      stateRef.current.targetZoom = 1;
      // Keep the center node selected so it glows, clear only in overview
      stateRef.current.selected = centerId === "__overview__" ? null : centerId;
      buildGraph(centerId);
    }
  }, [centerId, buildGraph]);

  // Resize renderer when fullscreen changes
  useEffect(() => {
    const st = stateRef.current;
    if (!st.renderer || !st.el) return;
    const resize = () => {
      const w = st.el.clientWidth;
      const h = st.el.clientHeight;
      st.w = w; st.h = h;
      st.renderer.setSize(w, h);
      st.camera.aspect = w / h;
      st.camera.updateProjectionMatrix();
    };
    setTimeout(resize, 50);
  }, [fullscreen]);

  // ESC to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") onToggleFullscreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, onToggleFullscreen]);

  return (
    <div style={fullscreen ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, background: "#08080A", display: "flex", flexDirection: "column" } : {}}>
      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: fullscreen ? "16px 24px" : "0 0 10px", flexWrap: "wrap", minHeight: 28, flexShrink: 0 }}>
        {path.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: C.inkGhost, fontSize: 11 }}>→</span>}
            <button onClick={() => onNodeClick(p, i)}
              style={{ fontSize: 12, fontFamily: F.body, padding: "3px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: i === path.length - 1 ? C.seaSoft : "transparent",
                color: i === path.length - 1 ? C.sea : C.inkMu,
                fontWeight: i === path.length - 1 ? 600 : 400, transition: "all 0.15s" }}>
              {p === "__overview__" ? "Overzicht" : p}
            </button>
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={onToggleFullscreen}
          style={{ fontSize: 11, fontFamily: F.body, padding: "4px 12px", borderRadius: 6, border: `1px solid ${C.line}`, background: "transparent", color: C.inkMu, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.sea; e.currentTarget.style.color = C.sea; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.inkMu; }}>
          {fullscreen ? "Esc · sluiten" : "Full screen"}
        </button>
      </div>
      <div ref={mountRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onClick={onClick} onMouseLeave={onMouseLeave} onWheel={onWheel}
        style={{ borderRadius: fullscreen ? 0 : 14, overflow: "hidden", border: fullscreen ? "none" : `0.5px solid ${C.line}`, background: "radial-gradient(ellipse at center, #0E1418 0%, #08080A 70%)", height: fullscreen ? "100%" : 420, flex: fullscreen ? 1 : "none", position: "relative" }}>
        <div ref={labelsRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }} />
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontSize: 11, color: C.inkGhost, fontFamily: F.body, pointerEvents: "none", zIndex: 10 }}>
          Klik om te duiken · sleep om te draaien · scroll om te zoomen
        </div>
      </div>
    </div>
  );
}

function StreamCard({ item, onAskClaude, onTagClick, onPersonClick }) {
  const [expanded, setExpanded] = useState(false);
  const isLarge = item.size === "large", isMed = item.size === "medium";
  return (
    <div onClick={() => setExpanded(!expanded)}
      style={{ background: C.surface, borderRadius: 14, padding: isLarge ? "22px 24px" : isMed ? "16px 18px" : "12px 16px", cursor: "pointer", border: `0.5px solid ${C.line}`, transition: "all 0.25s", position: "relative", overflow: "hidden", breakInside: "avoid", marginBottom: 12 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${item.color}11`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: item.color, borderRadius: "14px 0 0 14px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: F.mono, color: item.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{typeIcon[item.type]} {typeLabel[item.type]}</span>
        <span onClick={e => { e.stopPropagation(); onPersonClick(item.who); }}
          style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, padding: "2px 8px", borderRadius: 8, cursor: "pointer", background: item.who === "Rutger" ? C.seaSoft : C.coralSoft, color: item.who === "Rutger" ? C.sea : C.coral }}>{item.who}</span>
      </div>
      <h3 style={{ fontSize: isLarge ? 17 : isMed ? 14 : 13, fontFamily: isLarge ? F.display : F.body, fontWeight: isLarge ? 400 : 500, color: C.ink, margin: "0 0 6px", lineHeight: 1.35, fontStyle: isLarge ? "italic" : "normal" }}>{item.title}</h3>
      <div style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body }}>{item.source} · {fmtDate(item.date)}</div>
      {item.excerpt && (expanded || isLarge) && <p style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.body, lineHeight: 1.6, margin: "10px 0 0" }}>{item.excerpt}</p>}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
        {item.tags.map(t => (
          <span key={t} onClick={e => { e.stopPropagation(); onTagClick(t); }}
            style={{ fontSize: 10, fontFamily: F.body, color: C.inkMu, background: C.bgDeep, padding: "2px 8px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = item.color} onMouseLeave={e => e.currentTarget.style.color = C.inkMu}>{t}</span>
        ))}
      </div>
      {expanded && item.connected && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {item.connected.map(c => (
              <span key={c} onClick={e => { e.stopPropagation(); onTagClick(c); }}
                style={{ fontSize: 11, fontFamily: F.body, color: C.sea, background: C.seaSoft, padding: "3px 10px", borderRadius: 10, cursor: "pointer" }}>↗ {c}</span>
            ))}
          </div>
          <button onClick={e => { e.stopPropagation(); onAskClaude(item.title); }}
            style={{ width: "100%", padding: "8px 0", fontSize: 12, fontFamily: F.body, fontWeight: 500, background: C.sea, color: "#0A0A0A", border: "none", borderRadius: 8, cursor: "pointer" }}>Bespreek met Claude →</button>
        </div>
      )}
    </div>
  );
}

function ClaudePanel({ context, onClose, messages, setMessages }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const suggestions = context ? [`Vat alles samen over "${context}"`, `Open vragen rond "${context}"?`, `Verbind "${context}" met andere thema's`] : ["Belangrijkste inzichten deze week?", "Waar denken Rutger en Annelie anders?", "Welke verbanden missen we?"];
  const send = (text) => { const msg = text || input; if (!msg.trim()) return; setMessages(prev => [...prev, { role: "user", text: msg }]); setInput("");
    setTimeout(() => { setMessages(prev => [...prev, { role: "claude", text: `Ik zoek in Wubbo naar "${context || msg}"...\n\n23 relevante bronnen. De rode draad: systeemdenken.\n\nZal ik inzoomen of een overzicht maken?` }]); }, 600); };
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, width: 380, maxHeight: "70vh", background: C.surface, borderRadius: 16, border: `1px solid ${C.line}`, boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 60px ${C.sea}08`, display: "flex", flexDirection: "column", zIndex: 200 }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.sea, boxShadow: `0 0 8px ${C.sea}` }} />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: F.body, color: C.ink }}>Claude</span>
          {context && <span style={{ fontSize: 10, color: C.sea, background: C.seaSoft, padding: "1px 8px", borderRadius: 8, fontFamily: F.body }}>{context.slice(0,28)}{context.length>28?"…":""}</span>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.inkMu }}>×</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
        {messages.length === 0 ? suggestions.map((s, i) => (
          <button key={i} onClick={() => send(s)} style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontFamily: F.body, background: C.bgWarm, color: C.inkSoft, border: "none", borderRadius: 10, cursor: "pointer", lineHeight: 1.4, transition: "all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.seaSoft; e.currentTarget.style.color = C.sea; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.bgWarm; e.currentTarget.style.color = C.inkSoft; }}>{s}</button>
        )) : messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, fontSize: 13, fontFamily: F.body, lineHeight: 1.6, whiteSpace: "pre-line",
              background: m.role === "user" ? C.sea : C.bgWarm, color: m.role === "user" ? "#0A0A0A" : C.ink,
              borderBottomRightRadius: m.role === "user" ? 4 : 12, borderBottomLeftRadius: m.role === "user" ? 12 : 4 }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, flexShrink: 0, display: "flex", gap: 8 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Vraag Claude..." onKeyDown={e => e.key === "Enter" && send()}
          style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontFamily: F.body, background: C.bgWarm, border: "none", borderRadius: 10, outline: "none", color: C.ink }} />
        <button onClick={() => send()} style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() ? C.sea : C.bgDeep, color: input.trim() ? "#0A0A0A" : C.inkGhost, border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
      </div>
    </div>
  );
}

const WORD_CLOUD = [
  { text:"Florida", w:1, color:C.sea }, { text:"regeneratief", w:.85, color:C.green },
  { text:"coöperatie", w:.8, color:C.sea }, { text:"Re-Creation", w:.75, color:C.coral },
  { text:"fosfaatrechten", w:.7, color:C.sea }, { text:"Schiermonnikoog", w:.7, color:C.seaLt },
  { text:"onderwijs", w:.6, color:C.purple }, { text:"kringlopen", w:.55, color:C.green },
  { text:"NSW-landgoed", w:.55, color:C.storm }, { text:"Jersey koeien", w:.5, color:C.dune },
  { text:"founding members", w:.45, color:C.sea }, { text:"food forest", w:.4, color:C.green },
  { text:"gastvrijheid", w:.25, color:C.coral }, { text:"zelfvernieuwing", w:.25, color:C.coral },
];

export default function Wubbo() {
  const [filter, setFilter] = useState("");
  const [personFilter, setPersonFilter] = useState(null);
  const [sort, setSort] = useState("newest");
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [claudeCtx, setClaudeCtx] = useState("");
  const [claudeMsg, setClaudeMsg] = useState([]);
  const [view, setView] = useState("graph");
  const [graphPath, setGraphPath] = useState(["__overview__"]);
  const [graphFs, setGraphFs] = useState(false);
  const graphCenter = graphPath[graphPath.length - 1];

  const openClaude = (ctx) => { setClaudeCtx(ctx || ""); setClaudeMsg([]); setClaudeOpen(true); };
  const applyFilter = (f) => setFilter(f);
  const applyPerson = (p) => setPersonFilter(prev => prev === p ? null : p);

  const handleGraphClick = useCallback((nodeId, breadcrumbIdx) => {
    // Clicking Rutger or Annelie filters by person, doesn't dive into graph
    if (nodeId === "Rutger" || nodeId === "Annelie") {
      applyPerson(nodeId);
      return;
    }
    if (breadcrumbIdx !== undefined) {
      setGraphPath(prev => prev.slice(0, breadcrumbIdx + 1));
      const target = graphPath[breadcrumbIdx];
      if (target === "__overview__") setFilter("");
      else setFilter(target);
    } else {
      setGraphPath(prev => prev[prev.length - 1] === nodeId ? prev : [...prev, nodeId]);
      setFilter(nodeId);
    }
  }, [graphPath]);

  const filtered = useMemo(() => {
    let items = [...ITEMS];
    if (personFilter) items = items.filter(i => i.who === personFilter);
    if (filter) { const q = filter.toLowerCase(); items = items.filter(i => i.title.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)) || (i.excerpt && i.excerpt.toLowerCase().includes(q)) || (i.connected && i.connected.some(c => c.toLowerCase().includes(q))) || i.source.toLowerCase().includes(q) || i.who.toLowerCase().includes(q)); }
    if (sort === "newest") items.sort((a, b) => b.ts - a.ts); else items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [filter, personFilter, sort]);

  return (
    <div style={{ fontFamily: F.body, background: C.bg, minHeight: "100vh", color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontFamily: F.display, fontWeight: 400, margin: 0, fontStyle: "italic", color: C.ink }}>Wubbo</h1>
          <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.mono }}>{filtered.length} / {ITEMS.length}</span>
        </div>
        <div style={{ flex: 1, maxWidth: 340, margin: "0 24px", position: "relative" }}>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Zoek op titel, tag, inhoud, bron..."
            style={{ width: "100%", padding: "9px 14px 9px 34px", fontSize: 13, fontFamily: F.body, background: C.bgWarm, border: "1px solid transparent", borderRadius: 10, outline: "none", color: C.ink, boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = C.sea} onBlur={e => e.target.style.borderColor = "transparent"} />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.inkGhost }}>⌕</span>
          {filter && <button onClick={() => setFilter("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.inkMu }}>×</button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex" }}>
            <div onClick={() => applyPerson("Rutger")} style={{ width: 28, height: 28, borderRadius: "50%", background: C.sea, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#0A0A0A", border: `2px solid ${personFilter === "Rutger" ? C.ink : C.bg}`, cursor: "pointer", zIndex: 1 }}>R</div>
            <div onClick={() => applyPerson("Annelie")} style={{ width: 28, height: 28, borderRadius: "50%", background: C.coral, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#0A0A0A", marginLeft: -6, border: `2px solid ${personFilter === "Annelie" ? C.ink : C.bg}`, cursor: "pointer" }}>A</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 55px)" }}>
        {/* Sidebar */}
        <div style={{ width: 210, padding: "16px 14px 16px 22px", borderRight: `1px solid ${C.line}`, flexShrink: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 18, background: C.bgWarm, borderRadius: 8, padding: 3 }}>
            {[{ id:"graph", label:"Graph" },{ id:"stream", label:"Stream" }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontFamily: F.body, fontWeight: view === v.id ? 600 : 400, background: view === v.id ? C.surface : "transparent", color: view === v.id ? C.ink : C.inkMu, border: "none", borderRadius: 6, cursor: "pointer" }}>{v.label}</button>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sorteren</div>
            {[{id:"newest",label:"Nieuwste eerst"},{id:"oldest",label:"Oudste eerst"}].map(s => (
              <div key={s.id} onClick={() => setSort(s.id)} style={{ padding: "5px 10px", fontSize: 12, fontFamily: F.body, color: sort === s.id ? C.sea : C.inkMu, cursor: "pointer", borderRadius: 6, background: sort === s.id ? C.seaSoft : "transparent", marginBottom: 2, fontWeight: sort === s.id ? 600 : 400 }}>{s.label}</div>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Persoon</div>
            {["Rutger","Annelie"].map(p => (
              <div key={p} onClick={() => applyPerson(p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", fontSize: 12, fontFamily: F.body, cursor: "pointer", borderRadius: 6, marginBottom: 2, color: personFilter === p ? (p==="Rutger"?C.sea:C.coral) : C.inkMu, background: personFilter === p ? (p==="Rutger"?C.seaSoft:C.coralSoft) : "transparent", fontWeight: personFilter === p ? 600 : 400 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: p==="Rutger"?C.sea:C.coral, boxShadow: `0 0 6px ${p==="Rutger"?C.sea:C.coral}44` }} />{p}
                <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: F.mono, color: C.inkGhost }}>{ITEMS.filter(i => i.who === p).length}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Thema's</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", lineHeight: 1.7 }}>
              {WORD_CLOUD.map(w => (
                <span key={w.text} onClick={() => { applyFilter(w.text); if (view === "graph" && KNOWLEDGE[w.text]) setGraphPath([w.text]); }}
                  style={{ fontSize: Math.round(10 + w.w * 11), fontFamily: F.body, fontWeight: w.w > 0.6 ? 500 : 400, color: filter.toLowerCase() === w.text.toLowerCase() ? C.ink : w.color, cursor: "pointer", opacity: 0.5 + w.w * 0.5, transition: "all 0.15s", textDecoration: filter.toLowerCase() === w.text.toLowerCase() ? "underline" : "none", textUnderlineOffset: 3 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = `${0.5 + w.w * 0.5}`}>{w.text}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "16px 28px 40px", minWidth: 0 }}>
          {(filter || personFilter) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {personFilter && <span style={{ fontSize: 11, fontFamily: F.body, color: personFilter==="Rutger"?C.sea:C.coral, background: personFilter==="Rutger"?C.seaSoft:C.coralSoft, padding: "3px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>{personFilter}<span onClick={() => setPersonFilter(null)} style={{ cursor: "pointer" }}>×</span></span>}
              {filter && <span style={{ fontSize: 11, fontFamily: F.body, color: C.sea, background: C.seaSoft, padding: "3px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>"{filter}"<span onClick={() => setFilter("")} style={{ cursor: "pointer" }}>×</span></span>}
              <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.mono }}>{filtered.length} resultaten</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => openClaude(filter || personFilter)} style={{ fontSize: 11, fontFamily: F.body, color: C.sea, background: C.seaSoft, border: "none", padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Bespreek met Claude →</button>
            </div>
          )}

          {view === "graph" ? (
            <div>
              <ThreeGraph centerId={graphCenter} onNodeClick={handleGraphClick} path={graphPath} fullscreen={graphFs} onToggleFullscreen={() => setGraphFs(f => !f)} />
              {filtered.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, color: C.inkMu, fontFamily: F.body, marginBottom: 10 }}>{graphCenter === "__overview__" ? "Recente bronnen" : <>Bronnen over <span style={{ fontWeight: 600, color: C.ink }}>{graphCenter}</span></>}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {filtered.slice(0, 5).map(item => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderRadius: 8, border: `0.5px solid ${C.line}`, cursor: "pointer", transition: "all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 0 12px ${item.color}11`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = "none"; }}>
                        <span style={{ fontSize: 10, color: item.color, fontFamily: F.mono }}>{typeIcon[item.type]}</span>
                        <span style={{ fontSize: 13, fontFamily: F.body, color: C.ink, flex: 1 }}>{item.title}</span>
                        <span style={{ fontSize: 10, fontFamily: F.body, padding: "2px 6px", borderRadius: 6, background: item.who==="Rutger"?C.seaSoft:C.coralSoft, color: item.who==="Rutger"?C.sea:C.coral }}>{item.who}</span>
                        <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body }}>{fmtDate(item.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {!filter && !personFilter && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontFamily: F.display, fontStyle: "italic" }}>Stream</span>
                  <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body, marginLeft: 10 }}>{sort === "newest" ? "nieuwste eerst" : "oudste eerst"}</span>
                </div>
              )}
              {filtered.length > 0 ? (
                <div style={{ columnCount: 2, columnGap: 12 }}>
                  {filtered.map(item => <StreamCard key={item.id} item={item} onAskClaude={openClaude} onTagClick={applyFilter} onPersonClick={applyPerson} />)}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "60px 20px", color: C.inkGhost }}>
                  <div style={{ fontSize: 24, fontFamily: F.display, fontStyle: "italic", marginBottom: 8 }}>Niets gevonden</div>
                  <button onClick={() => openClaude(filter)} style={{ marginTop: 16, padding: "10px 20px", fontSize: 13, background: C.sea, color: "#0A0A0A", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: F.body }}>Vraag Claude →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!claudeOpen && (
        <button onClick={() => openClaude("")} style={{ position: "fixed", bottom: 20, right: 20, width: 52, height: 52, borderRadius: 16, background: C.sea, color: "#0A0A0A", border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px ${C.sea}44, 0 0 40px ${C.sea}22`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = `0 6px 28px ${C.sea}66, 0 0 60px ${C.sea}33`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 20px ${C.sea}44, 0 0 40px ${C.sea}22`; }}>C</button>
      )}
      {claudeOpen && <ClaudePanel context={claudeCtx} onClose={() => setClaudeOpen(false)} messages={claudeMsg} setMessages={setClaudeMsg} />}
    </div>
  );
}
