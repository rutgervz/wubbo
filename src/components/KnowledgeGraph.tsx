'use client'

import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { CatmullRomCurve3, Vector3, MeshStandardMaterial } from 'three'
import type { Mesh, Group } from 'three'

// ---------- Types ----------

interface GraphNode {
  id: string
  label: string
  color: string | null
  node_type: string | null
  source_count: number
}

interface GraphEdge {
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

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  persons: PersonData[]
}

interface NodePosition {
  id: string
  label: string
  color: string
  position: Vector3
  sourceCount: number
  isPerson: boolean
  personName?: string
}

// ---------- Force-directed layout ----------

function computeLayout(data: GraphData): NodePosition[] {
  const { nodes, edges, persons } = data
  if (nodes.length === 0) return []

  // Build adjacency
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    adj.get(e.from_node_id)?.push(e.to_node_id)
    adj.get(e.to_node_id)?.push(e.from_node_id)
  }

  // Initial random positions in a sphere
  const positions = new Map<string, [number, number, number]>()
  for (const n of nodes) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 4 + Math.random() * 4
    positions.set(n.id, [
      r * Math.sin(phi) * Math.cos(theta),
      (Math.random() - 0.5) * 3,
      r * Math.sin(phi) * Math.sin(theta),
    ])
  }

  // Simple force-directed: 80 iterations
  const k = 2.5 // ideal distance
  for (let iter = 0; iter < 80; iter++) {
    const forces = new Map<string, [number, number, number]>()
    for (const n of nodes) forces.set(n.id, [0, 0, 0])

    // Repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!
        const b = positions.get(nodes[j].id)!
        const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1)
        const force = (k * k) / dist
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fz = (dz / dist) * force
        const fa = forces.get(nodes[i].id)!
        const fb = forces.get(nodes[j].id)!
        fa[0] += fx; fa[1] += fy; fa[2] += fz
        fb[0] -= fx; fb[1] -= fy; fb[2] -= fz
      }
    }

    // Attraction (edges)
    for (const e of edges) {
      const a = positions.get(e.from_node_id)
      const b = positions.get(e.to_node_id)
      if (!a || !b) continue
      const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1)
      const force = (dist * dist) / k * (e.strength || 0.5)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      const fa = forces.get(e.from_node_id)!
      const fb = forces.get(e.to_node_id)!
      fa[0] -= fx; fa[1] -= fy; fa[2] -= fz
      fb[0] += fx; fb[1] += fy; fb[2] += fz
    }

    // Apply forces with cooling
    const temp = 0.3 * (1 - iter / 80)
    for (const n of nodes) {
      const f = forces.get(n.id)!
      const p = positions.get(n.id)!
      p[0] += Math.max(-temp, Math.min(temp, f[0] * 0.05))
      p[1] += Math.max(-temp, Math.min(temp, f[1] * 0.05))
      p[2] += Math.max(-temp, Math.min(temp, f[2] * 0.05))
      // Clamp y to a band so graph is somewhat flat
      p[1] = Math.max(-2, Math.min(2, p[1]))
    }
  }

  // Build result with person detection
  const personNames = new Set(persons.map(p => p.name.toLowerCase()))
  const personColorMap = new Map(persons.map(p => [p.name.toLowerCase(), p.color]))

  return nodes.map(n => {
    const p = positions.get(n.id)!
    const nameLower = n.label.toLowerCase()
    const isPerson = personNames.has(nameLower)
    return {
      id: n.id,
      label: n.label,
      color: isPerson ? (personColorMap.get(nameLower) || n.color || '#888') : (n.color || '#888'),
      position: new Vector3(p[0], p[1] + 0.5, p[2]),
      sourceCount: n.source_count,
      isPerson,
      personName: isPerson ? n.label : undefined,
    }
  })
}

// ---------- Mycelium Edge ----------

function MyceliumEdge({ from, to, color }: { from: Vector3; to: Vector3; color: string }) {
  const curve = useMemo(() => {
    const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5)
    // Add organic sag/curve
    mid.y -= 0.4 + Math.random() * 0.3
    const offset = new Vector3(
      (Math.random() - 0.5) * 0.6,
      0,
      (Math.random() - 0.5) * 0.6
    )
    mid.add(offset)
    return new CatmullRomCurve3([from, mid, to])
  }, [from, to])

  const points = useMemo(
    () => curve.getPoints(24).map(p => [p.x, p.y, p.z] as [number, number, number]),
    [curve]
  )

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.25}
    />
  )
}

// ---------- Graph Node Sphere ----------

function NodeSphere({
  node,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  node: NodePosition
  selected: boolean
  hovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null, e?: { clientX: number; clientY: number }) => void
}) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const baseRadius = node.isPerson ? 0.5 : 0.2 + Math.min(node.sourceCount * 0.05, 0.3)
  const active = selected || hovered

  useFrame((_, delta) => {
    if (!meshRef.current) return
    // Gentle float
    meshRef.current.position.y =
      node.position.y + Math.sin(Date.now() * 0.001 + node.position.x) * 0.08
    // Glow pulse
    if (glowRef.current) {
      const scale = active
        ? 1.8 + Math.sin(Date.now() * 0.003) * 0.2
        : 1.4
      glowRef.current.scale.setScalar(scale)
      const mat = glowRef.current.material as MeshStandardMaterial
      if (mat) mat.opacity = active ? 0.3 : 0.08
    }
  })

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseRadius, 16, 16]} />
        <meshStandardMaterial
          color={node.color}
          transparent
          opacity={0.08}
          emissive={node.color}
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          onHover(node.id, { clientX: e.clientX ?? 0, clientY: e.clientY ?? 0 })
        }}
        onPointerMove={(e) => {
          onHover(node.id, { clientX: e.clientX ?? 0, clientY: e.clientY ?? 0 })
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          onHover(null)
        }}
      >
        <sphereGeometry args={[baseRadius, 32, 32]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={active ? 1.2 : 0.4}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {/* Lotus petals for persons */}
      {node.isPerson && <LotusPetals color={node.color} radius={baseRadius} active={active} />}
    </group>
  )
}

// ---------- Lotus Petals (persons only) ----------

function LotusPetals({ color, radius, active }: { color: string; radius: number; active: boolean }) {
  const groupRef = useRef<Group>(null)
  const petalCount = 8

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003
    }
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: petalCount }).map((_, i) => {
        const angle = (i / petalCount) * Math.PI * 2
        const tilt = 0.4 + (i % 2) * 0.2
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius * 1.1,
              0.1,
              Math.sin(angle) * radius * 1.1,
            ]}
            rotation={[tilt, angle, 0]}
          >
            <sphereGeometry args={[radius * 0.45, 8, 4, 0, Math.PI]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={active ? 1.0 : 0.3}
              transparent
              opacity={0.6}
              side={2}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ---------- Water Plane ----------

function WaterPlane() {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as MeshStandardMaterial
      if (mat) mat.emissiveIntensity = 0.02 + Math.sin(Date.now() * 0.0005) * 0.01
    }
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[80, 80, 32, 32]} />
      <meshStandardMaterial
        color="#050a12"
        emissive="#0a2030"
        emissiveIntensity={0.02}
        transparent
        opacity={0.9}
        roughness={0.95}
      />
    </mesh>
  )
}

// ---------- Camera Controller ----------

function CameraController({ target }: { target: Vector3 | null }) {
  const { camera } = useThree()
  const currentTarget = useRef(new Vector3(0, 0, 0))

  useFrame(() => {
    const dest = target || new Vector3(0, 0, 0)
    currentTarget.current.lerp(dest, 0.03)

    if (!target) {
      // Idle drift
      const t = Date.now() * 0.0001
      const driftX = Math.sin(t) * 12
      const driftZ = Math.cos(t) * 12
      camera.position.lerp(new Vector3(driftX, 8, driftZ), 0.005)
    } else {
      // Focus on selected node
      const focusPos = new Vector3(
        dest.x + 3,
        dest.y + 3,
        dest.z + 3
      )
      camera.position.lerp(focusPos, 0.03)
    }
    camera.lookAt(currentTarget.current)
  })

  return null
}

// ---------- Scene ----------

function Scene({ data, onNodeSelect }: { data: GraphData; onNodeSelect?: (label: string | null) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{
    id: string; x: number; y: number
  } | null>(null)

  const layout = useMemo(() => computeLayout(data), [data])
  const posMap = useMemo(() => {
    const m = new Map<string, Vector3>()
    layout.forEach(n => m.set(n.id, n.position))
    return m
  }, [layout])

  const selectedNode = layout.find(n => n.id === selectedId)
  const cameraTarget = selectedNode ? selectedNode.position : null

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => {
      const next = prev === id ? null : id
      const node = layout.find(n => n.id === next)
      onNodeSelect?.(node?.label || null)
      return next
    })
  }, [layout, onNodeSelect])

  const handleHover = useCallback((id: string | null, e?: { clientX: number; clientY: number }) => {
    setHoveredId(id)
    if (id && e) {
      setTooltipInfo({ id, x: e.clientX, y: e.clientY })
    } else {
      setTooltipInfo(null)
    }
  }, [])

  // Propagate tooltip to DOM
  useEffect(() => {
    const el = document.getElementById('node-tooltip')
    if (!el) return
    if (tooltipInfo) {
      const node = layout.find(n => n.id === tooltipInfo.id)
      if (node) {
        el.style.display = 'block'
        el.style.left = `${tooltipInfo.x + 14}px`
        el.style.top = `${tooltipInfo.y - 10}px`
        el.innerHTML = `
          <div class="label" style="color:${node.color}">${node.label}</div>
          <div class="meta">${node.sourceCount} bron${node.sourceCount !== 1 ? 'nen' : ''}${node.isPerson ? ' · persoon' : ''}</div>
        `
      }
    } else {
      el.style.display = 'none'
    }
  }, [tooltipInfo, layout])

  return (
    <>
      <CameraController target={cameraTarget} />
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 15, 10]} intensity={0.6} color="#5ABFBF" />
      <pointLight position={[-10, 10, -10]} intensity={0.4} color="#E8795D" />
      <fog attach="fog" args={['#000000', 15, 40]} />

      <WaterPlane />

      {/* Mycelium edges */}
      {data.edges.map(edge => {
        const from = posMap.get(edge.from_node_id)
        const to = posMap.get(edge.to_node_id)
        if (!from || !to) return null
        const isActive =
          hoveredId === edge.from_node_id ||
          hoveredId === edge.to_node_id ||
          selectedId === edge.from_node_id ||
          selectedId === edge.to_node_id
        return (
          <MyceliumEdge
            key={edge.id}
            from={from}
            to={to}
            color={isActive ? '#5ABFBF' : '#1a3a3a'}
          />
        )
      })}

      {/* Node spheres */}
      {layout.map(node => (
        <NodeSphere
          key={node.id}
          node={node}
          selected={selectedId === node.id}
          hovered={hoveredId === node.id}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      ))}
    </>
  )
}

// ---------- Main Component ----------

export default function KnowledgeGraph({ data, onNodeSelect }: { data: GraphData; onNodeSelect?: (label: string | null) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  return (
    <>
      <div className="wubbo-title">WUBBO</div>
      <button className="fullscreen-btn" onClick={toggleFullscreen}>
        {isFullscreen ? '⊡' : '⊞'}
      </button>
      <div id="node-tooltip" className="node-tooltip" style={{ display: 'none' }} />
      <Canvas
        camera={{ position: [10, 8, 10], fov: 50, near: 0.1, far: 100 }}
        style={{ width: '100vw', height: '100vh', background: '#000' }}
        onPointerMissed={() => {
          // Deselect when clicking empty space
        }}
      >
        <Scene data={data} onNodeSelect={onNodeSelect} />
      </Canvas>
    </>
  )
}
