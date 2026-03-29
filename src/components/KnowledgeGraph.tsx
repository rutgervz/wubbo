'use client'

import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'

// ---------- Types ----------

interface DBNode {
  id: string
  label: string
  color: string | null
  node_type: string | null
  source_count: number
}

interface DBEdge {
  id: string
  from_node_id: string
  to_node_id: string
  strength: number
  is_confirmed: boolean
}

interface PersonData {
  id: string
  name: string
  color: string
}

export interface GraphData {
  nodes: DBNode[]
  edges: DBEdge[]
  persons: PersonData[]
}

interface SceneNode {
  id: string       // label (used as key)
  dbId: string     // uuid
  level: number
  color: string
  r: number
  shape?: 'lotus'
}

type SceneEdge = [string, string, string?]

// ---------- Graph builders (live data) ----------

function buildOverviewGraph(data: GraphData): { nodes: SceneNode[]; edges: SceneEdge[] } {
  const themeNodes: SceneNode[] = data.nodes.map(n => ({
    id: n.label,
    dbId: n.id,
    level: 1,
    color: n.color || '#5ABFBF',
    r: 1.0 + Math.min(n.source_count * 0.12, 0.8),
  }))
  const personNodes: SceneNode[] = data.persons.map(p => ({
    id: p.name,
    dbId: p.id,
    level: 2,
    color: p.color,
    r: 1.8,
    shape: 'lotus' as const,
  }))

  const nodeByDbId = new Map(data.nodes.map(n => [n.id, n]))
  const edges: SceneEdge[] = []
  for (const e of data.edges) {
    const a = nodeByDbId.get(e.from_node_id)
    const b = nodeByDbId.get(e.to_node_id)
    if (a && b) edges.push([a.label, b.label])
  }
  for (const tn of themeNodes) {
    for (const pn of personNodes) {
      edges.push([tn.id, pn.id, 'root'])
    }
  }
  return { nodes: [...themeNodes, ...personNodes], edges }
}

function buildGraphForNode(centerId: string, data: GraphData): { nodes: SceneNode[]; edges: SceneEdge[] } {
  const nodeByLabel = new Map(data.nodes.map(n => [n.label, n]))
  const adj = new Map<string, string[]>()
  for (const n of data.nodes) adj.set(n.label, [])
  for (const e of data.edges) {
    const a = data.nodes.find(n => n.id === e.from_node_id)
    const b = data.nodes.find(n => n.id === e.to_node_id)
    if (a && b) {
      adj.get(a.label)?.push(b.label)
      adj.get(b.label)?.push(a.label)
    }
  }

  const centerDb = nodeByLabel.get(centerId)
  if (!centerDb) return buildOverviewGraph(data)

  const nodes: SceneNode[] = [{ id: centerId, dbId: centerDb.id, level: 0, color: centerDb.color || '#5ABFBF', r: 2.4 }]
  const edges: SceneEdge[] = []
  const seen = new Set([centerId])

  for (const conn of adj.get(centerId) || []) {
    const cn = nodeByLabel.get(conn)
    if (!cn || seen.has(conn)) continue
    seen.add(conn)
    nodes.push({ id: conn, dbId: cn.id, level: 1, color: cn.color || '#888', r: 1.4 })
    edges.push([centerId, conn])
  }

  const level1 = nodes.filter(n => n.level === 1).map(n => n.id)
  for (const l1 of level1) {
    let added = 0
    for (const conn of adj.get(l1) || []) {
      if (conn === centerId) continue
      const existing = nodes.find(n => n.id === conn)
      if (seen.has(conn)) { if (existing) edges.push([l1, conn]); continue }
      const cn = nodeByLabel.get(conn)
      if (cn && added < 2) {
        seen.add(conn)
        nodes.push({ id: conn, dbId: cn.id, level: 2, color: cn.color || '#888', r: 0.8 })
        edges.push([l1, conn])
        added++
      }
    }
  }

  for (const p of data.persons) {
    if (!seen.has(p.name)) nodes.push({ id: p.name, dbId: p.id, level: 2, color: p.color, r: 1.8, shape: 'lotus' })
  }

  const themeIds = nodes.filter(n => n.shape !== 'lotus').map(n => n.id)
  for (const p of data.persons) {
    for (const tid of themeIds) edges.push([tid, p.name, 'root'])
  }

  return { nodes, edges }
}

// ---------- Petal geometry ----------

function createPetal(petalLength: number, petalWidth: number, curlHeight: number, segments: number): THREE.BufferGeometry {
  const verts: number[] = []
  const normals: number[] = []
  const segsU = segments || 12
  const segsV = 6
  for (let iu = 0; iu <= segsU; iu++) {
    const u = iu / segsU
    for (let iv = 0; iv <= segsV; iv++) {
      const v = (iv / segsV) * 2 - 1
      const widthScale = Math.sin(u * Math.PI) * (1 - 0.3 * u)
      const x = u * petalLength
      const z = v * petalWidth * widthScale
      const edgeCurl = Math.abs(v) * Math.abs(v) * curlHeight * 0.5
      const tipCurl = u * u * curlHeight
      const baseDip = (1 - u) * (1 - u) * curlHeight * 0.2
      const y = tipCurl + edgeCurl - baseDip
      verts.push(x, y, z)
      const ny = 1 - Math.abs(v) * 0.3
      normals.push(0, ny, v * 0.3)
    }
  }
  const indices: number[] = []
  for (let iu = 0; iu < segsU; iu++) {
    for (let iv = 0; iv < segsV; iv++) {
      const a = iu * (segsV + 1) + iv
      const b = a + segsV + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geom.setIndex(indices)
  return geom
}

// ---------- Component ----------

interface Props {
  data: GraphData
  centerId: string
  path: string[]
  fullscreen: boolean
  onNodeClick: (nodeId: string, breadcrumbIdx?: number) => void
  onToggleFullscreen: () => void
}

export default function KnowledgeGraph({ data, centerId, path, fullscreen, onNodeClick, onToggleFullscreen }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)

  type SceneState = {
    renderer: THREE.WebGLRenderer | null
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    frame: number | null
    nodes: THREE.Mesh[]
    edges: THREE.Mesh[]
    labels: THREE.Object3D[]
    raycaster: THREE.Raycaster | null
    mouse: THREE.Vector2
    hovered: string | null
    selected: string | null
    clock: THREE.Clock | null
    el: HTMLDivElement | null
    w: number
    h: number
    zoom: number
    targetZoom: number
    drag: { active: boolean; prevX: number; prevY: number; rotX: number; rotY: number; autoSpeed: number; idleTime: number }
    lookTarget: { x: number; y: number; z: number }
    lookCurrent: { x: number; y: number; z: number }
    htmlLabels: { el: HTMLElement; nodeId: string; level: number }[]
  }

  const stateRef = useRef<SceneState>({
    renderer: null, scene: null, camera: null, frame: null,
    nodes: [], edges: [], labels: [], raycaster: null,
    mouse: new THREE.Vector2(-999, -999),
    hovered: null, selected: null, clock: null, el: null,
    w: 0, h: 0, zoom: 1, targetZoom: 1,
    drag: { active: false, prevX: 0, prevY: 0, rotX: 0, rotY: 0.3, autoSpeed: 0.08, idleTime: 0 },
    lookTarget: { x: 0, y: 0, z: 0 },
    lookCurrent: { x: 0, y: 0, z: 0 },
    htmlLabels: [],
  })

  const dataRef = useRef(data)
  dataRef.current = data

  const setupScene = useCallback(() => {
    const el = mountRef.current
    if (!el || stateRef.current.renderer) return
    const w = el.clientWidth, h = el.clientHeight || 420
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x08080A, 0.006)

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500)
    camera.position.set(0, 8, 38)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0x606080, 0.8))
    const pl1 = new THREE.PointLight(0x5ABFBF, 1.5, 120)
    pl1.position.set(10, 15, 10); scene.add(pl1)
    const pl2 = new THREE.PointLight(0xE8795D, 0.8, 100)
    pl2.position.set(-10, -5, 8); scene.add(pl2)

    // Particle field
    const particleCount = 200
    const pGeom = new THREE.BufferGeometry()
    const pPos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 120
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 80
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 60 - 20
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    scene.add(new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0x5ABFBF, size: 0.08, transparent: true, opacity: 0.3, sizeAttenuation: true })))

    const raycaster = new THREE.Raycaster()
    const clock = new THREE.Clock()
    stateRef.current = {
      ...stateRef.current,
      renderer, scene, camera, frame: null, raycaster, clock, el, w, h, zoom: 1, targetZoom: 1,
      drag: { active: false, prevX: 0, prevY: 0, rotX: 0, rotY: 0.3, autoSpeed: 0.08, idleTime: 0 },
      lookTarget: { x: 0, y: 0, z: 0 }, lookCurrent: { x: 0, y: 0, z: 0 },
    }
  }, [])

  const buildGraph = useCallback((cid: string) => {
    const st = stateRef.current
    if (!st.scene) return
    const data = dataRef.current

    for (const obj of [...st.nodes, ...st.edges, ...st.labels]) st.scene.remove(obj)
    st.nodes = []; st.edges = []; st.labels = []

    const isOverview = cid === '__overview__'
    const graphData = isOverview ? buildOverviewGraph(data) : buildGraphForNode(cid, data)

    const connCount: Record<string, number> = {}
    for (const n of graphData.nodes) connCount[n.id] = 0
    for (const [a, b] of graphData.edges) {
      connCount[a] = (connCount[a] || 0) + 1
      connCount[b] = (connCount[b] || 0) + 1
    }
    const maxConn = Math.max(1, ...Object.values(connCount))

    const floorY = -12

    // Floor disc
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(35, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#1A1916'), transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = floorY
    st.scene.add(floor); st.labels.push(floor)

    // Mycelium group on floor
    const myceliumGroup = new THREE.Group()
    myceliumGroup.position.y = floorY + 0.05
    st.scene.add(myceliumGroup); st.labels.push(myceliumGroup)

    // Initial positions
    const positions: Record<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number; height: number }> = {}
    const themeNodes = graphData.nodes.filter(n => n.shape !== 'lotus')
    const personNodes = graphData.nodes.filter(n => n.shape === 'lotus')

    themeNodes.forEach((n, i) => {
      const angle = (i / themeNodes.length) * Math.PI * 2 - Math.PI / 2
      const dist = isOverview ? 12 + Math.random() * 3 : (n.level === 0 ? 0 : n.level === 1 ? 9 + Math.random() * 3 : 16 + Math.random() * 3)
      const heightFrac = (connCount[n.id] || 0) / maxConn
      const height = 2 + heightFrac * 14
      positions[n.id] = { x: Math.cos(angle) * dist, y: height, z: Math.sin(angle) * dist, vx: 0, vy: 0, vz: 0, height }
    })
    personNodes.forEach((n, i) => {
      positions[n.id] = { x: i === 0 ? -10 : 10, y: floorY + 2.5, z: 0, vx: 0, vy: 0, vz: 0, height: 0 }
    })

    // Force simulation
    for (let iter = 0; iter < 40; iter++) {
      for (let i = 0; i < themeNodes.length; i++) {
        for (let j = i + 1; j < themeNodes.length; j++) {
          const a = positions[themeNodes[i].id], b = positions[themeNodes[j].id]
          const dx = a.x - b.x, dz = a.z - b.z
          const dist = Math.sqrt(dx * dx + dz * dz) + 0.1
          const repulse = 8 / (dist * dist)
          a.vx += (dx / dist) * repulse; a.vz += (dz / dist) * repulse
          b.vx -= (dx / dist) * repulse; b.vz -= (dz / dist) * repulse
        }
      }
      for (const [aId, bId] of graphData.edges) {
        const a = positions[aId], b = positions[bId]
        if (!a || !b) continue
        const dx = b.x - a.x, dz = b.z - a.z
        const dist = Math.sqrt(dx * dx + dz * dz) + 0.1
        const attract = dist * 0.015
        a.vx += (dx / dist) * attract; a.vz += (dz / dist) * attract
        b.vx -= (dx / dist) * attract; b.vz -= (dz / dist) * attract
      }
      for (const n of themeNodes) {
        const p = positions[n.id]
        p.x += p.vx * 0.3; p.z += p.vz * 0.3
        p.vx *= 0.85; p.vz *= 0.85
      }
    }

    // Center layout
    let cx = 0, cz = 0, cnt = 0
    for (const n of themeNodes) { cx += positions[n.id].x; cz += positions[n.id].z; cnt++ }
    if (cnt > 0) { cx /= cnt; cz /= cnt; for (const n of themeNodes) { positions[n.id].x -= cx; positions[n.id].z -= cz } }

    // Build node meshes
    for (const n of graphData.nodes) {
      const color = new THREE.Color(n.color)
      const isLotus = n.shape === 'lotus'
      const isCenter = !isOverview && n.level === 0
      let geom: THREE.BufferGeometry
      if (isLotus) {
        geom = new THREE.SphereGeometry(n.r * 0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
      } else {
        geom = new THREE.SphereGeometry(n.r, 24, 24)
      }
      const mat = new THREE.MeshPhongMaterial({
        color: isLotus ? new THREE.Color(n.color).lerp(new THREE.Color('#ffffff'), 0.3) : color,
        emissive: color,
        emissiveIntensity: isLotus ? 0.8 : isCenter ? 0.5 : 0.25,
        transparent: true,
        opacity: 0,
        shininess: isLotus ? 120 : 60,
      })
      const mesh = new THREE.Mesh(geom, mat)
      const p = positions[n.id]
      if (!p) continue
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData = {
        id: n.id, level: n.level,
        targetOpacity: isLotus ? 0.95 : isCenter ? 1 : isOverview ? 0.85 : n.level === 1 ? 0.9 : 0.6,
        baseEmissive: isLotus ? 0.8 : isCenter ? 0.5 : 0.25,
        pos: p, isLotus,
      }
      st.scene!.add(mesh); st.nodes.push(mesh)

      // Lotus petals
      if (isLotus) {
        const layers = [
          { petals: 8, length: n.r * 1.6, width: n.r * 0.35, curl: n.r * 0.5, rotOffset: 0, yOff: -0.05, opacity: 0.8 },
          { petals: 8, length: n.r * 1.25, width: n.r * 0.3, curl: n.r * 0.7, rotOffset: Math.PI / 8, yOff: 0.08, opacity: 0.7 },
          { petals: 6, length: n.r * 0.85, width: n.r * 0.25, curl: n.r * 0.9, rotOffset: Math.PI / 12, yOff: 0.18, opacity: 0.65 },
        ]
        for (const layer of layers) {
          for (let pi = 0; pi < layer.petals; pi++) {
            const angle = (pi / layer.petals) * Math.PI * 2 + layer.rotOffset
            const petalGeom = createPetal(layer.length, layer.width, layer.curl, 10)
            const petalColor = new THREE.Color(n.color).lerp(new THREE.Color('#ffffff'), layer.yOff * 2)
            const petalMat = new THREE.MeshPhongMaterial({
              color: petalColor, emissive: color, emissiveIntensity: 0.35,
              transparent: true, opacity: 0, shininess: 90, side: THREE.DoubleSide,
            })
            const petalMesh = new THREE.Mesh(petalGeom, petalMat)
            petalMesh.position.set(p.x, p.y + layer.yOff, p.z)
            petalMesh.rotation.y = angle
            petalMesh.userData = { isLotusDetail: true, parentId: n.id, targetOpacity: layer.opacity, petalAngle: angle, layerYOff: layer.yOff }
            st.scene!.add(petalMesh); st.labels.push(petalMesh)
          }
        }

        // Glow disc under lotus
        const glowMesh = new THREE.Mesh(
          new THREE.CircleGeometry(n.r * 2.2, 32),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
        )
        glowMesh.rotation.x = -Math.PI / 2
        glowMesh.position.set(p.x, p.y - 0.1, p.z)
        glowMesh.userData = { isGlow: true, parentId: n.id, targetOpacity: 0.1 }
        st.scene!.add(glowMesh); st.labels.push(glowMesh)

        // Water ripples
        for (let ring = 0; ring < 3; ring++) {
          const ringRadius = n.r * (2.5 + ring * 1.6)
          const ringMesh = new THREE.Mesh(
            new THREE.RingGeometry(ringRadius - 0.05, ringRadius + 0.05, 64),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
          )
          ringMesh.rotation.x = -Math.PI / 2
          ringMesh.position.set(p.x, floorY + 0.12, p.z)
          ringMesh.userData = { isRipple: true, parentId: n.id, ringIndex: ring, baseRadius: ringRadius, targetOpacity: 0.2 - ring * 0.05, floorY: floorY + 0.12 }
          st.scene!.add(ringMesh); st.labels.push(ringMesh)
        }
      }

      // Shadow rings for non-lotus nodes
      if (!isLotus && p) {
        const heightAboveFloor = p.y - floorY
        const shadowRadius = n.r * (1 + heightAboveFloor * 0.08)
        const shadowOpacity = Math.max(0.04, 0.2 - heightAboveFloor * 0.008)
        const shadow = new THREE.Mesh(
          new THREE.RingGeometry(shadowRadius * 0.3, shadowRadius, 32),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
        )
        shadow.rotation.x = -Math.PI / 2
        shadow.position.set(p.x, floorY + 0.1, p.z)
        shadow.userData = { isShadow: true, parentId: n.id, targetOpacity: shadowOpacity, floorY: floorY + 0.1 }
        st.scene!.add(shadow); st.labels.push(shadow)
      }

      // Neon glow rings for center node
      if (isCenter) {
        const glowLayers = [
          { inner: n.r + 2.5, outer: n.r + 4.0, opacity: 0.06 },
          { inner: n.r + 1.6, outer: n.r + 2.8, opacity: 0.12 },
          { inner: n.r + 1.0, outer: n.r + 1.8, opacity: 0.2 },
        ]
        for (const gl of glowLayers) {
          const gm = new THREE.Mesh(
            new THREE.RingGeometry(gl.inner, gl.outer, 64),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
          )
          gm.position.copy(mesh.position)
          gm.userData = { isGlow: true, parentId: n.id, targetOpacity: gl.opacity }
          st.scene!.add(gm); st.labels.push(gm)
        }
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(n.r + 1.2, 0.08, 8, 64),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        )
        ring.position.copy(mesh.position)
        ring.userData = { isRing: true, parentId: n.id, color: n.color }
        st.scene!.add(ring); st.labels.push(ring)
      }
    }

    // Mycelium floor threads
    for (const edge of graphData.edges) {
      const [aId, bId, edgeType] = edge
      const pa = positions[aId], pb = positions[bId]
      if (!pa || !pb) continue
      const isRootEdge = edgeType === 'root'
      const lotusNode = isRootEdge
        ? graphData.nodes.find(n => (n.id === bId || n.id === aId) && n.shape === 'lotus')
        : null
      const threadColor = lotusNode ? lotusNode.color : '#3A3530'
      const wobbleAmount = isRootEdge ? 2.5 : 1.5
      const points: THREE.Vector3[] = []
      const segments = 14
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        points.push(new THREE.Vector3(
          pa.x + (pb.x - pa.x) * t + (Math.random() - 0.5) * wobbleAmount,
          0,
          pa.z + (pb.z - pa.z) * t + (Math.random() - 0.5) * wobbleAmount
        ))
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, isRootEdge ? 0.05 : 0.04, 4, false),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(threadColor), transparent: true, opacity: 0 })
      )
      tube.userData = { isMycelium: true, targetOpacity: isRootEdge ? 0.2 : 0.3, aId, bId, glowActive: false, baseColor: threadColor }
      myceliumGroup.add(tube); st.labels.push(tube)
    }

    // Root connection tubes (aerial, curly)
    for (const edge of graphData.edges) {
      const [aId, bId, edgeType] = edge
      if (edgeType !== 'root') continue
      const pa = positions[aId], pb = positions[bId]
      if (!pa || !pb) continue
      const nodePos = pa.height > 0 ? pa : pb
      const pyramidPos = pa.height > 0 ? pb : pa
      const nodeId = pa === nodePos ? aId : bId
      const pyramidId = pa === pyramidPos ? aId : bId
      const seed = (nodeId + pyramidId).length * 7.3
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 16; i++) {
        const t = i / 16
        const x = nodePos.x + (pyramidPos.x - nodePos.x) * t
        const y = nodePos.y + (pyramidPos.y - nodePos.y) * t
        const z = nodePos.z + (pyramidPos.z - nodePos.z) * t
        const ws = Math.sin(t * Math.PI) * 2.5
        points.push(new THREE.Vector3(
          x + Math.sin(seed + t * 8.7) * ws,
          y + Math.sin(seed * 0.7 + t * 5.1) * ws * 0.4,
          z + Math.cos(seed * 1.3 + t * 6.2) * ws
        ))
      }
      const pyramidNode = graphData.nodes.find(n => n.id === pyramidId)
      const rootColor = pyramidNode ? pyramidNode.color : '#5A5850'
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.03, 4, false),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(rootColor), transparent: true, opacity: 0 })
      )
      tube.userData = { isRoot: true, targetOpacity: 0.18, aId, bId, glowActive: false, baseColor: rootColor }
      st.scene!.add(tube); st.labels.push(tube)
    }

    // Aerial edge tubes between floating nodes
    for (const edge of graphData.edges) {
      const [aId, bId, edgeType] = edge
      if (edgeType === 'root') continue
      const pa = positions[aId], pb = positions[bId]
      if (!pa || !pb) continue
      const start = new THREE.Vector3(pa.x, pa.y, pa.z)
      const end = new THREE.Vector3(pb.x, pb.y, pb.z)
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
      const len = start.distanceTo(end)
      const aNode = graphData.nodes.find(n => n.id === aId)
      const bNode = graphData.nodes.find(n => n.id === bId)
      const isCenter = (aNode && aNode.level === 0) || (bNode && bNode.level === 0)
      const edgeColor = isCenter ? ((aNode && aNode.level === 0) ? aNode.color : bNode!.color) : '#5A5850'
      const geom = new THREE.CylinderGeometry(0.05, 0.05, len, 4, 1)
      geom.rotateX(Math.PI / 2)
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: new THREE.Color(edgeColor), transparent: true, opacity: 0 }))
      mesh.position.copy(mid)
      mesh.lookAt(end)
      mesh.userData = { aId, bId, targetOpacity: isCenter ? 0.5 : 0.25, start, end, isEdge: true }
      st.scene!.add(mesh); st.edges.push(mesh)
    }

    // HTML labels
    const lc = labelsRef.current
    if (lc) {
      lc.innerHTML = ''
      st.htmlLabels = []
      for (const n of graphData.nodes) {
        const label = document.createElement('div')
        label.textContent = n.id
        label.style.cssText = `position:absolute;pointer-events:none;font-family:'DM Sans',system-ui,sans-serif;text-align:center;white-space:nowrap;transition:opacity 0.3s;opacity:0;text-shadow:0 0 8px rgba(0,0,0,0.8),0 0 20px rgba(0,0,0,0.5);`
        label.style.fontSize = n.level === 0 ? '14px' : n.level === 1 ? '12px' : '10px'
        label.style.fontWeight = n.level === 0 ? '600' : '400'
        label.style.color = n.level === 0 ? '#E8E4DC' : n.level === 1 ? '#C4BFB4' : '#7A766C'
        lc.appendChild(label)
        st.htmlLabels.push({ el: label, nodeId: n.id, level: n.level })
      }
    }
  }, [])

  const animateRef = useRef<(() => void) | null>(null)
  animateRef.current = () => {
    const st = stateRef.current
    if (!st.renderer || !st.scene || !st.camera || !st.clock) return
    const time = st.clock.getElapsedTime()
    const d = st.drag

    if (!d.active) {
      d.idleTime += 0.016
      const autoBlend = Math.min(1, d.idleTime / 1.5)
      d.rotX += d.autoSpeed * 0.016 * autoBlend
    }

    st.zoom += (st.targetZoom - st.zoom) * 0.06
    const camDist = 38 / (st.zoom || 1)
    st.lookCurrent.x += (st.lookTarget.x - st.lookCurrent.x) * 0.04
    st.lookCurrent.y += (st.lookTarget.y - st.lookCurrent.y) * 0.04
    st.lookCurrent.z += (st.lookTarget.z - st.lookCurrent.z) * 0.04

    st.camera.position.x = st.lookCurrent.x + Math.sin(d.rotX) * Math.cos(d.rotY) * camDist
    st.camera.position.z = st.lookCurrent.z + Math.cos(d.rotX) * Math.cos(d.rotY) * camDist
    st.camera.position.y = st.lookCurrent.y + Math.sin(d.rotY) * camDist
    st.camera.lookAt(st.lookCurrent.x, st.lookCurrent.y, st.lookCurrent.z)

    // Animate nodes
    for (const mesh of st.nodes) {
      const ud = mesh.userData
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.opacity += (ud.targetOpacity - mat.opacity) * 0.04
      if (ud.isLotus) {
        mesh.position.y = ud.pos.y + Math.sin(time * 0.6) * 0.2
        mat.emissiveIntensity = ud.baseEmissive + Math.sin(time * 1.0) * 0.15
      } else {
        mesh.position.y = ud.pos.y + Math.sin(time * 0.5 + mesh.position.x) * 0.3
        if (ud.level === 0) {
          const pulse = 1 + Math.sin(time * 2) * 0.04
          mesh.scale.set(pulse, pulse, pulse)
          mat.emissiveIntensity = ud.baseEmissive + Math.sin(time * 1.5) * 0.1
        }
      }
    }

    // Animate aerial edges
    for (const edge of st.edges) {
      if (!edge.userData.isEdge) continue
      const mat = edge.material as THREE.MeshBasicMaterial
      mat.opacity += (edge.userData.targetOpacity - mat.opacity) * 0.04
      const nodeA = st.nodes.find(n => n.userData.id === edge.userData.aId)
      const nodeB = st.nodes.find(n => n.userData.id === edge.userData.bId)
      if (nodeA && nodeB) {
        const mid = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5)
        edge.position.copy(mid)
        edge.lookAt(nodeB.position)
        const len = nodeA.position.distanceTo(nodeB.position)
        const origLen = edge.userData.start.distanceTo(edge.userData.end) || 1
        edge.scale.set(1, 1, len / origLen)
      }
    }

    // Animate labels/extras
    for (const obj of st.labels) {
      const ud = obj.userData
      if (!ud) continue
      const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.MeshPhongMaterial | undefined

      if (ud.isLotusDetail) {
        const parent = st.nodes.find(n => n.userData.id === ud.parentId)
        if (parent) {
          const pmat = parent.material as THREE.MeshPhongMaterial
          obj.position.x = parent.position.x; obj.position.z = parent.position.z
          obj.position.y = parent.position.y + ud.layerYOff
          const breathe = 1 + Math.sin(time * 0.4 + ud.petalAngle) * 0.03
          obj.scale.set(breathe, breathe, breathe)
          if (mat) mat.opacity += (ud.targetOpacity * pmat.opacity - mat.opacity) * 0.04
        }
        continue
      }

      if (ud.isRipple) {
        const parent = st.nodes.find(n => n.userData.id === ud.parentId)
        if (parent && mat) {
          obj.position.x = parent.position.x; obj.position.z = parent.position.z; obj.position.y = ud.floorY
          const expand = 1 + Math.sin(time * 0.35 - ud.ringIndex * 0.8) * 0.12
          obj.scale.set(expand, expand, 1)
          const fade = 1 + Math.sin(time * 0.5 - ud.ringIndex * 1.2) * 0.3
          mat.opacity += (ud.targetOpacity * fade - mat.opacity) * 0.03
        }
        continue
      }

      if (ud.isShadow) {
        const parent = st.nodes.find(n => n.userData.id === ud.parentId)
        if (parent && mat) {
          obj.position.x = parent.position.x; obj.position.z = parent.position.z; obj.position.y = ud.floorY
          const breathe = 1 + Math.sin(time * 0.8 + parent.position.x) * 0.15
          mat.opacity += (ud.targetOpacity * breathe - mat.opacity) * 0.04
        }
        continue
      }

      if (ud.isMycelium && mat) {
        if (ud.glowActive) {
          mat.opacity += (0.65 + Math.sin(time * 3.5) * 0.25 - mat.opacity) * 0.08
        } else {
          mat.opacity += (ud.targetOpacity * (1 + Math.sin(time * 0.6) * 0.2) - mat.opacity) * 0.03
        }
        continue
      }

      if (ud.isRoot && mat) {
        if (ud.glowActive) {
          mat.opacity += (0.7 + Math.sin(time * 3.0) * 0.2 - mat.opacity) * 0.08
        } else {
          mat.opacity += (ud.targetOpacity * (1 + Math.sin(time * 0.4) * 0.25) - mat.opacity) * 0.03
        }
        continue
      }

      const parent = st.nodes.find(n => n.userData.id === ud.parentId)
      if (!parent) continue

      if (ud.isGlow && mat) {
        const breathe = 1 + Math.sin(time * 1.2) * 0.3
        mat.opacity += (ud.targetOpacity * breathe - mat.opacity) * 0.04
        obj.position.copy(parent.position)
        obj.lookAt(st.camera.position)
      }

      if (ud.isRing && mat) {
        const neonPulse = 0.7 + Math.sin(time * 2.5) * 0.3
        mat.opacity += (neonPulse - mat.opacity) * 0.06
        const cm = mat as THREE.MeshBasicMaterial
        cm.color.set(ud.color)
        cm.color.lerp(new THREE.Color(0xffffff), 0.4 + Math.sin(time * 3) * 0.15)
        obj.rotation.x = Math.PI / 2; obj.rotation.z = time * 0.5
        obj.position.copy(parent.position)
        const s = 1 + Math.sin(time * 2) * 0.03
        obj.scale.set(s, s, s)
      }
    }

    // Raycasting hover
    st.raycaster!.setFromCamera(st.mouse, st.camera)
    const intersects = st.raycaster!.intersectObjects(st.nodes)
    const rawHovered = intersects.length > 0 ? intersects[0].object.userData.id as string : null
    const activeNode = rawHovered || st.selected || null
    const hovConns = new Set<string>()

    if (activeNode) {
      hovConns.add(activeNode)
      for (const line of st.edges) {
        if (line.userData.aId === activeNode) hovConns.add(line.userData.bId)
        if (line.userData.bId === activeNode) hovConns.add(line.userData.aId)
      }
      for (const mesh of st.nodes) {
        const ud = mesh.userData
        const mat = mesh.material as THREE.MeshPhongMaterial
        if (!hovConns.has(ud.id)) { ud.targetOpacity = 0.1; mat.emissiveIntensity = ud.baseEmissive }
        else if (ud.id === activeNode) { ud.targetOpacity = 1; mat.emissiveIntensity = 0.8 }
        else { ud.targetOpacity = ud.level === 0 ? 1 : ud.level === 1 ? 0.9 : 0.6; mat.emissiveIntensity = ud.baseEmissive }
      }
      for (const line of st.edges) {
        line.userData.targetOpacity = (line.userData.aId === activeNode || line.userData.bId === activeNode) ? 0.95 : 0.06
      }
      const hoveredMesh = st.nodes.find(n => n.userData.id === activeNode)
      const glowColor = hoveredMesh ? '#' + (hoveredMesh.material as THREE.MeshPhongMaterial).color.getHexString() : '#5ABFBF'
      for (const obj of st.labels) {
        const ud = obj.userData; if (!ud) continue
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        if (ud.isMycelium) {
          const connected = ud.aId === activeNode || ud.bId === activeNode
          ud.glowActive = connected
          if (connected) { mat.color.set(glowColor); ud.targetOpacity = 0.85 }
          else { mat.color.set(ud.baseColor || '#3A3530'); ud.targetOpacity = 0.05 }
        }
        if (ud.isRoot) {
          const connected = ud.aId === activeNode || ud.bId === activeNode
          ud.glowActive = connected
          if (connected) { mat.color.set(glowColor); ud.targetOpacity = 0.9 }
          else { mat.color.set(ud.baseColor || '#5A5850'); ud.targetOpacity = 0.04 }
        }
      }
    } else {
      for (const mesh of st.nodes) {
        const ud = mesh.userData
        ud.targetOpacity = ud.isLotus ? 0.95 : ud.level === 0 ? 1 : ud.level === 1 ? 0.9 : 0.6
        ;(mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = ud.baseEmissive
      }
      for (const line of st.edges) line.userData.targetOpacity = 0.25
      for (const obj of st.labels) {
        const ud = obj.userData; if (!ud) continue
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        if (ud.isMycelium) { ud.targetOpacity = 0.3; ud.glowActive = false; if (mat) mat.color.set(ud.baseColor || '#3A3530') }
        if (ud.isRoot) { ud.targetOpacity = 0.18; ud.glowActive = false; if (mat) mat.color.set(ud.baseColor || '#5A5850') }
      }
    }

    st.hovered = activeNode
    if (st.el) st.el.style.cursor = rawHovered ? 'pointer' : 'default'

    // Project 3D → 2D for HTML labels
    if (st.htmlLabels.length > 0) {
      const tempVec = new THREE.Vector3()
      for (const lbl of st.htmlLabels) {
        const mesh = st.nodes.find(m => m.userData.id === lbl.nodeId)
        if (!mesh) continue
        tempVec.copy(mesh.position)
        tempVec.y -= lbl.level === 0 ? 3.8 : lbl.level === 1 ? 2.6 : 1.8
        tempVec.project(st.camera)
        const x = (tempVec.x * 0.5 + 0.5) * st.w
        const y = (-tempVec.y * 0.5 + 0.5) * st.h
        lbl.el.style.left = x + 'px'; lbl.el.style.top = y + 'px'
        lbl.el.style.transform = 'translate(-50%, 0)'
        const nodeOpacity = (mesh.material as THREE.MeshPhongMaterial).opacity
        lbl.el.style.opacity = tempVec.z > 1 ? '0' : String(Math.min(nodeOpacity, 0.95))
        if (lbl.nodeId === activeNode) {
          lbl.el.style.color = '#E8E4DC'; lbl.el.style.fontWeight = '600'; lbl.el.style.fontSize = '14px'
        } else if (activeNode && !hovConns.has(lbl.nodeId) && lbl.level !== 0) {
          lbl.el.style.color = '#3A3835'
        } else {
          lbl.el.style.color = lbl.level === 0 ? '#E8E4DC' : lbl.level === 1 ? '#C4BFB4' : '#7A766C'
          lbl.el.style.fontWeight = lbl.level === 0 ? '600' : '400'
          lbl.el.style.fontSize = lbl.level === 0 ? '14px' : lbl.level === 1 ? '12px' : '10px'
        }
      }
    }

    st.renderer.render(st.scene, st.camera)
    st.frame = requestAnimationFrame(() => animateRef.current?.())
  }

  // Mouse handlers
  const dragStartRef = useRef({ x: 0, y: 0, moved: false })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const st = stateRef.current
    st.drag.active = true; st.drag.prevX = e.clientX; st.drag.prevY = e.clientY
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const st = stateRef.current
    if (!st.el) return
    const rect = st.el.getBoundingClientRect()
    st.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    st.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    if (st.drag.active) {
      const dx = e.clientX - st.drag.prevX, dy = e.clientY - st.drag.prevY
      st.drag.rotX += dx * 0.008
      st.drag.rotY = Math.max(-1.2, Math.min(1.2, st.drag.rotY + dy * 0.008))
      st.drag.prevX = e.clientX; st.drag.prevY = e.clientY; st.drag.idleTime = 0
      if (Math.abs(e.clientX - dragStartRef.current.x) + Math.abs(e.clientY - dragStartRef.current.y) > 8)
        dragStartRef.current.moved = true
    }
  }, [])

  const onMouseUp = useCallback(() => { stateRef.current.drag.active = false }, [])
  const onMouseLeave = useCallback(() => { stateRef.current.mouse.set(-999, -999); stateRef.current.drag.active = false }, [])
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const st = stateRef.current
    st.targetZoom = Math.max(0.4, Math.min(3, (st.targetZoom || 1) + (e.deltaY > 0 ? -0.08 : 0.08)))
  }, [])

  const onNodeClickRef = useRef(onNodeClick)
  onNodeClickRef.current = onNodeClick

  const onClick = useCallback((e: React.MouseEvent) => {
    if (dragStartRef.current.moved) return
    const st = stateRef.current
    if (!st.el || !st.raycaster || !st.camera) return
    const rect = st.el.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    st.raycaster.setFromCamera(mouse, st.camera)
    const intersects = st.raycaster.intersectObjects(st.nodes)
    if (intersects.length > 0) {
      const clicked = intersects[0].object.userData.id as string
      st.selected = clicked
      st.lookTarget.x = intersects[0].object.position.x
      st.lookTarget.y = intersects[0].object.position.y
      st.lookTarget.z = intersects[0].object.position.z
      let maxDist = 0
      for (const node of st.nodes) {
        const dx = node.position.x - intersects[0].object.position.x
        const dy = node.position.y - intersects[0].object.position.y
        const dz = node.position.z - intersects[0].object.position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist > maxDist) maxDist = dist
      }
      st.targetZoom = 38 / Math.max(25, maxDist * 1.6)
      st.drag.idleTime = 0
      setTimeout(() => onNodeClickRef.current(clicked), 400)
    }
  }, [])

  // Init
  useEffect(() => {
    setupScene()
    buildGraph(centerId)
    stateRef.current.frame = requestAnimationFrame(() => animateRef.current?.())
    return () => {
      if (stateRef.current.frame) cancelAnimationFrame(stateRef.current.frame)
      const st = stateRef.current
      if (st.renderer && st.el) {
        try { st.el.removeChild(st.renderer.domElement) } catch { /* ignore */ }
        st.renderer.dispose()
        st.renderer = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild on centerId change
  useEffect(() => {
    if (stateRef.current.scene) {
      stateRef.current.lookTarget = { x: 0, y: 0, z: 0 }
      stateRef.current.targetZoom = 1
      stateRef.current.selected = centerId === '__overview__' ? null : centerId
      buildGraph(centerId)
    }
  }, [centerId, buildGraph])

  // Resize on fullscreen change
  useEffect(() => {
    const st = stateRef.current
    if (!st.renderer || !st.el) return
    setTimeout(() => {
      const w = st.el!.clientWidth, h = st.el!.clientHeight
      st.w = w; st.h = h
      st.renderer!.setSize(w, h)
      st.camera!.aspect = w / h
      st.camera!.updateProjectionMatrix()
    }, 50)
  }, [fullscreen])

  // ESC fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggleFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, onToggleFullscreen])

  const C = { line: '#2A2825', sea: '#5ABFBF', seaSoft: '#122828', inkMu: '#7A766C', inkGhost: '#3A3835' }

  return (
    <div style={fullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, background: '#08080A', display: 'flex', flexDirection: 'column' } : {}}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: fullscreen ? '16px 24px' : '0 0 10px', flexWrap: 'wrap', minHeight: 28, flexShrink: 0 }}>
        {path.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: C.inkGhost, fontSize: 11 }}>→</span>}
            <button
              onClick={() => onNodeClick(p, i)}
              style={{ fontSize: 12, fontFamily: 'inherit', padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: i === path.length - 1 ? C.seaSoft : 'transparent',
                color: i === path.length - 1 ? C.sea : C.inkMu,
                fontWeight: i === path.length - 1 ? 600 : 400, transition: 'all 0.15s' }}>
              {p === '__overview__' ? 'Overzicht' : p}
            </button>
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <button
          onClick={onToggleFullscreen}
          style={{ fontSize: 11, fontFamily: 'inherit', padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.inkMu, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.sea; e.currentTarget.style.color = C.sea }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.inkMu }}>
          {fullscreen ? 'Esc · sluiten' : 'Full screen'}
        </button>
      </div>
      {/* Canvas container */}
      <div
        ref={mountRef}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onClick={onClick} onMouseLeave={onMouseLeave} onWheel={onWheel}
        style={{
          borderRadius: fullscreen ? 0 : 14, overflow: 'hidden',
          border: fullscreen ? 'none' : `0.5px solid ${C.line}`,
          background: 'radial-gradient(ellipse at center, #0E1418 0%, #08080A 70%)',
          height: fullscreen ? '100%' : 420, flex: fullscreen ? 1 : 'none', position: 'relative',
        }}
      >
        <div ref={labelsRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: C.inkGhost, fontFamily: 'inherit', pointerEvents: 'none', zIndex: 10 }}>
          Klik om te duiken · sleep om te draaien · scroll om te zoomen
        </div>
      </div>
    </div>
  )
}
