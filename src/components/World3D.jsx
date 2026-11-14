import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore.js'
import { STATIONS, assignStations, padFor } from '../lib/stations.js'

// ---------- tuning knobs ----------
const WALK = 5
const SPRINT = 9
const GRAVITY = { moon: 2.5, mars: 5 } // ponytail: game-feel values; real ratio Moon:Mars is ~1.6:3.7 m/s²
const JUMP = 4.5
const WORLD_R = 120
const PAD_R = 1.4
const WORK_TIME = 1.2 // seconds standing on a pad to "do the job"
const CAM_DIST = 9
const CAM_HEIGHT = 5

const THEMES = {
  moon: { ground: '#7a7a80', crater: '#55555b', rock: '#5c5a57', mountain: '#4a4a50', sky: '#01010a', fog: null, sunSize: 10, ambient: 0.32 },
  mars: { ground: '#b5562b', crater: '#8c3c1b', rock: '#7c2d12', mountain: '#6e2b13', sky: '#1c0905', fog: ['#3a1609', 90, 260], sunSize: 6, ambient: 0.45 },
}

// Shared input: keyboard, mouse drag and the touch D-pad all write here.
const input = { up: false, down: false, left: false, right: false, jump: false, sprint: false, turnL: false, turnR: false }
const cam = { yaw: 0 }
const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyQ: 'turnL', KeyE: 'turnR',
}

const SOLIDS = [
  { x: 0, z: 0, r: 3.2 }, { x: -4, z: -2, r: 2 }, // habitat
  ...['shield', 'solar', 'greenhouse', 'lab', 'comms'].map((id) => ({ x: STATIONS[id].pos[0], z: STATIONS[id].pos[1], r: { shield: 1.6, solar: 2.4, greenhouse: 2.9, lab: 2.4, comms: 1.2 }[id] })),
  { x: -20, z: 16, r: 2.5 }, // lander
]

const LETTERS = ['A', 'B', 'C']
const isRadiation = (e) => /flare|cme|gst|sep_|storm|radiation/.test(e?.id ?? '')

// Small seeded random so the terrain looks the same every visit.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const ring = (rand, min, max) => {
  const a = rand() * Math.PI * 2, d = min + rand() * (max - min)
  return [Math.cos(a) * d, Math.sin(a) * d]
}

// ---------- player ----------
function Astronaut({ pads, suitColor }) {
  const root = useRef()
  const body = useRef()
  const legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef()
  const work = useRef()
  const arrow = useRef()
  const s = useRef({ vy: 0, y: 0, t: 0, padIdx: -1, progress: 0, done: false }).current
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const planet = useGameStore((st) => st.planet)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const p = root.current.position
    const { fact, choose, event } = useGameStore.getState()
    const locked = !!fact

    cam.yaw += ((input.turnL ? 1 : 0) - (input.turnR ? 1 : 0)) * 2 * dt
    const f = (locked ? 0 : (input.up ? 1 : 0) - (input.down ? 1 : 0))
    const r = (locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0))
    const moving = f !== 0 || r !== 0
    if (moving) {
      const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw)
      let dx = -sin * f + cos * r, dz = -cos * f - sin * r
      const len = Math.hypot(dx, dz)
      dx /= len; dz /= len
      const speed = input.sprint ? SPRINT : WALK
      p.x += dx * speed * dt
      p.z += dz * speed * dt
      root.current.rotation.y = Math.atan2(dx, dz)
      s.t += dt * (input.sprint ? 1.6 : 1)
    }
    for (const o of SOLIDS) {
      const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz)
      if (d < o.r && d > 0) { p.x = o.x + (ox / d) * o.r; p.z = o.z + (oz / d) * o.r }
    }
    const d = Math.hypot(p.x, p.z)
    if (d > WORLD_R) { p.x *= WORLD_R / d; p.z *= WORLD_R / d }

    if (input.jump && s.y === 0 && !locked) s.vy = JUMP
    s.vy -= GRAVITY[planet] * dt
    s.y = Math.max(0, s.y + s.vy * dt)
    if (s.y === 0) s.vy = 0

    // Which pad are we on? Standing still on it for WORK_TIME = doing the job = choosing.
    let on = -1
    pads.forEach(([x, z], i) => { if (s.y < 0.3 && Math.hypot(p.x - x, p.z - z) < PAD_R) on = i })
    if (on !== s.padIdx) { s.padIdx = on; s.progress = 0; s.done = false }
    const working = on !== -1 && !locked && !s.done
    if (working) {
      s.progress += dt
      if (s.progress >= WORK_TIME) { s.done = true; choose(event.choices[on]) }
    }
    const k = working ? s.progress / WORK_TIME : 0
    work.current.visible = working
    work.current.scale.setScalar(Math.max(0.01, k) * PAD_R)

    // Animation: walk swing, or arms up while working.
    const ground = s.y === 0
    const swing = moving && ground ? Math.sin(s.t * 10) * 0.7 : 0
    body.current.position.y = s.y + (moving && ground ? Math.abs(Math.sin(s.t * 10)) * 0.06 : 0)
    legL.current.rotation.x = swing
    legR.current.rotation.x = -swing
    armL.current.rotation.x = working ? -1.4 + Math.sin(state.clock.elapsedTime * 14) * 0.25 : -swing * 0.8
    armR.current.rotation.x = working ? -1.4 - Math.sin(state.clock.elapsedTime * 14) * 0.25 : swing * 0.8

    // Guide arrow toward the nearest pad.
    let best = null, bestD = Infinity
    pads.forEach(([x, z]) => { const dd = Math.hypot(x - p.x, z - p.z); if (dd < bestD) { bestD = dd; best = [x, z] } })
    arrow.current.visible = !locked && !!best && bestD > 4
    if (best) {
      const a = Math.atan2(best[0] - p.x, best[1] - p.z)
      arrow.current.position.set(p.x + Math.sin(a) * 1.6, 0.15, p.z + Math.cos(a) * 1.6)
      arrow.current.rotation.set(0, a, 0)
    }

    // Third-person camera behind the player, rotated by yaw.
    camPos.set(p.x + Math.sin(cam.yaw) * CAM_DIST, s.y * 0.5 + CAM_HEIGHT, p.z + Math.cos(cam.yaw) * CAM_DIST)
    state.camera.position.lerp(camPos, 1 - Math.exp(-6 * dt))
    state.camera.lookAt(p.x, 1.4 + s.y * 0.5, p.z)
  })

  const suit = <meshStandardMaterial color={suitColor} roughness={0.6} />
  return (
    <>
      <group ref={root} position={[6, 0, 16]}>
        <group ref={body}>
          <mesh position={[0, 1.05, 0]} castShadow><capsuleGeometry args={[0.36, 0.55, 4, 12]} />{suit}</mesh>
          <mesh position={[0, 1.75, 0]} castShadow><sphereGeometry args={[0.33, 24, 16]} />{suit}</mesh>
          <mesh position={[0, 1.77, 0.17]}><sphereGeometry args={[0.24, 24, 16]} /><meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.15} /></mesh>
          <mesh position={[0, 1.15, -0.4]} castShadow><boxGeometry args={[0.55, 0.65, 0.28]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
          <mesh position={[0, 1.3, 0.36]}><boxGeometry args={[0.3, 0.18, 0.06]} /><meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={1} /></mesh>
          <group ref={armL} position={[-0.46, 1.35, 0]}><mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.11, 0.4, 4, 8]} />{suit}</mesh></group>
          <group ref={armR} position={[0.46, 1.35, 0]}><mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.11, 0.4, 4, 8]} />{suit}</mesh></group>
          <group ref={legL} position={[-0.16, 0.6, 0]}><mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.13, 0.4, 4, 8]} />{suit}</mesh></group>
          <group ref={legR} position={[0.16, 0.6, 0]}><mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.13, 0.4, 4, 8]} />{suit}</mesh></group>
        </group>
        <mesh ref={work} rotation-x={-Math.PI / 2} position-y={0.06} visible={false}>
          <circleGeometry args={[1, 40]} /><meshBasicMaterial color="#facc15" transparent opacity={0.55} />
        </mesh>
      </group>
      <group ref={arrow} visible={false}>
        <mesh rotation-x={Math.PI / 2}>{/* cone points +y; tip it forward (+z) */}
          <coneGeometry args={[0.28, 0.8, 3]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      </group>
    </>
  )
}

// ---------- 3D text labels ----------
// Canvas-texture sprites instead of drei <Html>: <Html> mounts a React root per label,
// which with React 19 crashes ("removeChild") when labels change mid-render.
function wrap(ctx, text, max) {
  const out = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > max && line) { out.push(line); line = word } else line = test
  }
  return [...out, line]
}

function TextSprite({ lines, height = 0.5, color = '#cffafe', sub = '#94a3b8', border = '#22d3ee', ...props }) {
  const key = lines.join('|')
  const { tex, aspect, rows } = useMemo(() => {
    const W = 512, PAD = 22, F = 34, SF = 24
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = `600 ${F}px system-ui, sans-serif`
    const main = wrap(ctx, lines[0], W - PAD * 2)
    const H = PAD * 2 + main.length * F * 1.2 + (lines[1] ? SF * 1.4 : 0)
    c.width = W; c.height = Math.ceil(H)
    ctx.fillStyle = 'rgba(2,6,23,0.85)'
    ctx.strokeStyle = border; ctx.lineWidth = border ? 4 : 0
    ctx.beginPath(); ctx.roundRect(2, 2, W - 4, c.height - 4, 18); ctx.fill(); if (border) ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.font = `600 ${F}px system-ui, sans-serif`; ctx.fillStyle = color
    main.forEach((l, i) => ctx.fillText(l, W / 2, PAD + i * F * 1.2))
    if (lines[1]) { ctx.font = `${SF}px system-ui, sans-serif`; ctx.fillStyle = sub; ctx.fillText(lines[1], W / 2, PAD + main.length * F * 1.2 + 4) }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { tex: t, aspect: W / c.height, rows: main.length + (lines[1] ? 0.7 : 0) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex])
  const h = height * rows
  return (
    <sprite {...props} scale={[h * aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </sprite>
  )
}

// ---------- choice pads ----------
function Pads({ choices, stations, disabled }) {
  return choices.map((c, i) => {
    const [x, z] = padFor(stations[i])
    return (
      <group key={i} position={[x, 0, z]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
          <circleGeometry args={[PAD_R, 40]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={disabled ? 0.2 : 1.2} transparent opacity={0.55} />
        </mesh>
        {!disabled && (
          <mesh position-y={6}>
            <cylinderGeometry args={[0.35, 0.9, 12, 16, 1, true]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )}
        <TextSprite position={[0, 2.8, 0]} height={0.42} lines={[`${LETTERS[i]}: ${c.text}`, `${STATIONS[stations[i]].icon} ${STATIONS[stations[i]].name}`]} />
      </group>
    )
  })
}

// ---------- stations ----------
const Label = ({ id, y }) => (
  <TextSprite position={[0, y, 0]} height={0.38} border="" color="#e2e8f0" lines={[`${STATIONS[id].icon} ${STATIONS[id].name}`]} />
)
const at = (id) => [STATIONS[id].pos[0], 0, STATIONS[id].pos[1]]

function Habitat({ res, alarm }) {
  const beacon = useRef()
  useFrame(({ clock }) => { beacon.current.emissiveIntensity = alarm ? (Math.sin(clock.elapsedTime * 8) > 0 ? 3 : 0.2) : 0.3 })
  return (
    <group>
      <mesh castShadow receiveShadow><sphereGeometry args={[2.8, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e2e8f0" roughness={0.5} /></mesh>
      <mesh position={[-4, 0, -2]} castShadow><sphereGeometry args={[1.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      <mesh position={[-2.1, 0.55, -1]} rotation={[0, 0.46, Math.PI / 2]} castShadow><cylinderGeometry args={[0.55, 0.55, 1.8, 16]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 2.5, 1.1, Math.cos(a) * 2.5]} rotation-y={a}>
            <boxGeometry args={[0.55, 0.32, 0.05]} />
            <meshStandardMaterial color="#0f172a" emissive="#67e8f9" emissiveIntensity={(res.oxygen / 100) * 2} />
          </mesh>
        )
      })}
      <mesh position={[0, 2.5, 2.4]}><boxGeometry args={[1, 1.6, 0.4]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      <mesh position={[0, 3.4, 0]}><cylinderGeometry args={[0.04, 0.04, 1.4]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      <mesh position={[0, 4.15, 0]}><sphereGeometry args={[0.15, 16, 8]} /><meshStandardMaterial ref={beacon} color="#7f1d1d" emissive="#ef4444" /></mesh>
      <Label id="habitat" y={5} />
    </group>
  )
}

function ShieldGenerator({ res }) {
  const r1 = useRef(), r2 = useRef()
  const k = res.shielding / 100
  useFrame((_, dt) => { r1.current.rotation.z += dt * (0.5 + k * 2); r2.current.rotation.x += dt * (0.4 + k * 1.5) })
  return (
    <group position={at('shield')}>
      <mesh position-y={0.3} castShadow><cylinderGeometry args={[1.3, 1.5, 0.6, 24]} /><meshStandardMaterial color="#475569" /></mesh>
      <mesh position-y={2} castShadow><cylinderGeometry args={[0.25, 0.4, 3, 12]} /><meshStandardMaterial color="#64748b" metalness={0.6} /></mesh>
      <mesh position-y={3.7}><sphereGeometry args={[0.55, 24, 16]} /><meshStandardMaterial color="#7c3aed" emissive="#a78bfa" emissiveIntensity={0.3 + k * 2.5} /></mesh>
      <mesh ref={r1} position-y={3.7}><torusGeometry args={[1.1, 0.06, 8, 40]} /><meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={k * 2} /></mesh>
      <mesh ref={r2} position-y={3.7}><torusGeometry args={[1.4, 0.05, 8, 40]} /><meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={k * 1.5} /></mesh>
      <Label id="shield" y={5.2} />
    </group>
  )
}

function SolarArray({ res }) {
  const k = res.power / 100
  return (
    <group position={at('solar')} rotation-y={-0.3}>
      {[-1.4, 1.4].map((z) => [-1.9, 0, 1.9].map((x) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position-y={0.6}><cylinderGeometry args={[0.06, 0.06, 1.2]} /><meshStandardMaterial color="#64748b" /></mesh>
          <mesh position-y={1.25} rotation-x={-0.5} castShadow>
            <boxGeometry args={[1.7, 0.06, 1.1]} />
            <meshStandardMaterial color="#1e3a8a" emissive="#3b82f6" emissiveIntensity={k * 1.4} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      )))}
      <Label id="solar" y={3} />
    </group>
  )
}

function Greenhouse({ res }) {
  const k = res.oxygen / 100
  return (
    <group position={at('greenhouse')}>
      <mesh><sphereGeometry args={[2.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#bbf7d0" transparent opacity={0.25} roughness={0.1} depthWrite={false} /></mesh>
      <mesh position-y={0.1} rotation-x={-Math.PI / 2}><circleGeometry args={[2.6, 32]} /><meshStandardMaterial color="#3f2a1d" /></mesh>
      {[[-1, -0.6], [0.8, -0.9], [0, 0.8], [-1.2, 0.9], [1.3, 0.5], [0.2, -0.1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.15 + 0.5 * (0.3 + k), z]} scale={0.3 + k * 0.9}>
          <coneGeometry args={[0.35, 1, 8]} /><meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={k * 0.6} />
        </mesh>
      ))}
      <pointLight position={[0, 1.6, 0]} color="#f0abfc" intensity={k * 6} distance={6} />
      <Label id="greenhouse" y={3.4} />
    </group>
  )
}

function ScienceLab({ res }) {
  const dish = useRef()
  const k = Math.min(1, res.science / 60)
  useFrame((_, dt) => { dish.current.rotation.y += dt * 0.6 })
  return (
    <group position={at('lab')} rotation-y={0.6}>
      <mesh position-y={1} castShadow><boxGeometry args={[3.2, 2, 2.2]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      <mesh position={[0, 1.1, 1.11]}><boxGeometry args={[2.4, 0.4, 0.02]} /><meshStandardMaterial color="#022c22" emissive="#34d399" emissiveIntensity={0.3 + k * 2} /></mesh>
      <group ref={dish} position={[0.8, 2.3, 0]}>
        <mesh rotation-x={-0.8}><sphereGeometry args={[0.7, 20, 10, 0, Math.PI * 2, 0, 0.9]} /><meshStandardMaterial color="#cbd5e1" side={THREE.DoubleSide} metalness={0.5} /></mesh>
      </group>
      <Label id="lab" y={3.8} />
    </group>
  )
}

function CommsTower({ alarm }) {
  const light = useRef()
  useFrame(({ clock }) => { light.current.emissiveIntensity = Math.sin(clock.elapsedTime * (alarm ? 9 : 3)) > 0 ? 3 : 0.2 })
  return (
    <group position={at('comms')}>
      <mesh position-y={4} castShadow><cylinderGeometry args={[0.12, 0.35, 8, 6]} /><meshStandardMaterial color="#9ca3af" metalness={0.6} wireframe /></mesh>
      <mesh position-y={4} castShadow><cylinderGeometry args={[0.08, 0.08, 8, 6]} /><meshStandardMaterial color="#9ca3af" /></mesh>
      <mesh position={[0, 6.5, 0.4]} rotation-x={-1.1}><sphereGeometry args={[1.1, 20, 10, 0, Math.PI * 2, 0, 0.8]} /><meshStandardMaterial color="#e5e7eb" side={THREE.DoubleSide} /></mesh>
      <mesh position-y={8.2}><sphereGeometry args={[0.18, 12, 8]} /><meshStandardMaterial ref={light} color="#7f1d1d" emissive="#ef4444" /></mesh>
      <Label id="comms" y={9.2} />
    </group>
  )
}

function Lander() {
  return (
    <group position={[-20, 0, 16]}>
      <mesh position-y={1.6} castShadow><cylinderGeometry args={[1.2, 1.5, 1.4, 8]} /><meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position-y={2.8} castShadow><boxGeometry args={[1.4, 1, 1.4]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <mesh key={i} position={[Math.sin(a) * 1.7, 0.6, Math.cos(a) * 1.7]} rotation={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]}><cylinderGeometry args={[0.06, 0.06, 1.6]} /><meshStandardMaterial color="#9ca3af" /></mesh>
      })}
    </group>
  )
}

function Flag() {
  return (
    <group position={[4.5, 0, 5]}>
      <mesh position-y={1.3}><cylinderGeometry args={[0.04, 0.04, 2.6]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      <mesh position={[0.5, 2.25, 0]}><planeGeometry args={[1, 0.6]} /><meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={0.3} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function Rover() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * 0.12
    ref.current.position.set(Math.sin(a) * 28, 0, Math.cos(a) * 28)
    ref.current.rotation.y = a + Math.PI / 2
  })
  return (
    <group ref={ref}>
      <mesh position-y={0.6} castShadow><boxGeometry args={[2, 0.45, 1.2]} /><meshStandardMaterial color="#f59e0b" /></mesh>
      <mesh position={[0.5, 1.15, 0]}><boxGeometry args={[0.5, 0.6, 0.5]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      <mesh position={[-0.6, 1.4, 0]}><cylinderGeometry args={[0.03, 0.03, 1]} /><meshStandardMaterial color="#9ca3af" /></mesh>
      {[[-0.75, -0.65], [0.75, -0.65], [-0.75, 0.65], [0.75, 0.65]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.32, 0.32, 0.22, 16]} /><meshStandardMaterial color="#1f2937" /></mesh>
      ))}
    </group>
  )
}

function ShieldDome({ res, flare }) {
  const mat = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mat.current.opacity = 0.04 + (res.shielding / 100) * 0.3 + (res.shielding < 20 || flare ? Math.sin(t * 6) * 0.08 : 0)
  })
  return (
    // Energy grid, not a solid bubble: a solid dome tints the whole view purple from inside.
    <mesh>
      <sphereGeometry args={[22, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial ref={mat} color="#c4b5fd" wireframe transparent depthWrite={false} />
    </mesh>
  )
}

// ---------- terrain & sky ----------
function Instanced({ items, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Object3D()
    items.forEach(([x, y, z, sx, sy, sz, ry], i) => {
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, ry, 0); m.updateMatrix()
      ref.current.setMatrixAt(i, m.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[null, null, items.length]} castShadow receiveShadow>{children}</instancedMesh>
}

function Terrain({ theme }) {
  const { craters, rocks, mountains } = useMemo(() => {
    const rand = rng(42)
    const craters = Array.from({ length: 45 }, () => { const [x, z] = ring(rand, 30, 130); return [x, z, 2 + rand() * 7] })
    const rocks = Array.from({ length: 220 }, () => { const [x, z] = ring(rand, 24, 140); const s = 0.2 + rand() ** 3 * 1.6; return [x, s * 0.4, z, s, s * 0.7, s, rand() * 6] })
    const mountains = Array.from({ length: 46 }, (_, i) => {
      const a = (i / 46) * Math.PI * 2 + rand() * 0.1, d = 165 + rand() * 40, h = 14 + rand() * 34, w = 18 + rand() * 22
      return [Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d, w, h, w, rand() * 6]
    })
    return { craters, rocks, mountains }
  }, [])
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[260, 96]} /><meshStandardMaterial color={theme.ground} roughness={1} /></mesh>
      {craters.map(([x, z, r]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow><ringGeometry args={[r * 0.75, r, 40]} /><meshStandardMaterial color={theme.crater} roughness={1} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.015}><circleGeometry args={[r * 0.75, 40]} /><meshStandardMaterial color={theme.crater} roughness={1} transparent opacity={0.55} /></mesh>
        </group>
      ))}
      <Instanced items={rocks}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={theme.rock} roughness={1} flatShading /></Instanced>
      <Instanced items={mountains}><coneGeometry args={[0.5, 1, 7]} /><meshStandardMaterial color={theme.mountain} roughness={1} flatShading /></Instanced>
    </>
  )
}

const SUN_DIR = new THREE.Vector3(0.55, 0.42, -0.72).normalize()

function Sky({ planet, theme, flare }) {
  const sun = SUN_DIR.clone().multiplyScalar(380)
  return (
    <>
      <Stars radius={420} depth={60} count={9000} factor={6} saturation={0.2} fade speed={0.3} />
      <mesh position={sun}><sphereGeometry args={[theme.sunSize, 32, 16]} /><meshBasicMaterial color={flare ? '#fdba74' : '#fff7d6'} /></mesh>
      <mesh position={sun}><sphereGeometry args={[theme.sunSize * (flare ? 3.2 : 2.2), 32, 16]} /><meshBasicMaterial color={flare ? '#fb923c' : '#fde68a'} transparent opacity={flare ? 0.35 : 0.15} depthWrite={false} /></mesh>
      {planet === 'moon' ? (
        <group position={[-170, 120, -260]}>
          <mesh><sphereGeometry args={[26, 64, 32]} /><meshStandardMaterial color="#1d4ed8" emissive="#1e3a8a" emissiveIntensity={0.5} roughness={0.7} /></mesh>
          <mesh scale={1.015}><sphereGeometry args={[26, 64, 32]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} /></mesh>
          <mesh scale={1.12}><sphereGeometry args={[26, 32, 16]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0.12} depthWrite={false} side={THREE.BackSide} /></mesh>
          <TextSprite position={[0, -36, 0]} height={5} border="" color="#7dd3fc" lines={['🌍 Earth – 384,400 km away']} />
        </group>
      ) : (
        <>
          <mesh position={[-140, 150, -300]}><sphereGeometry args={[1.4, 16, 8]} /><meshBasicMaterial color="#93c5fd" /></mesh>
          <TextSprite position={[-140, 143, -300]} height={4} border="" color="#7dd3fc" lines={['🌍 Earth (a tiny dot from Mars!)']} />
          <mesh position={[150, 110, -240]}><dodecahedronGeometry args={[7, 1]} /><meshStandardMaterial color="#78716c" roughness={1} flatShading /></mesh>
          <TextSprite position={[150, 98, -240]} height={4} border="" color="#d6d3d1" lines={['Phobos, a moon of Mars']} />
          <mesh position={[-60, 170, 280]}><dodecahedronGeometry args={[3.5, 1]} /><meshStandardMaterial color="#a8a29e" roughness={1} flatShading /></mesh>
        </>
      )}
    </>
  )
}

// ---------- touch controls ----------
function DPad() {
  const hold = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); input[k] = true },
    onPointerUp: () => { input[k] = false },
    onPointerLeave: () => { input[k] = false },
    onPointerCancel: () => { input[k] = false },
  })
  const btn = 'grid h-14 w-14 select-none place-items-center rounded-xl bg-slate-800/80 text-2xl text-cyan-200 active:bg-cyan-500/50 touch-none'
  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-10 grid grid-cols-3 gap-1 md:hidden">
      <button className={btn} aria-label="Turn camera left" {...hold('turnL')}>⟲</button><button className={btn} aria-label="Move forward" {...hold('up')}>▲</button><button className={btn} aria-label="Turn camera right" {...hold('turnR')}>⟳</button>
      <button className={btn} aria-label="Move left" {...hold('left')}>◀</button>
      <button className={btn} aria-label="Jump" {...hold('jump')}>⤒</button>
      <button className={btn} aria-label="Move right" {...hold('right')}>▶</button>
      <button className={btn} aria-label="Sprint" {...hold('sprint')}>»</button><button className={btn} aria-label="Move back" {...hold('down')}>▼</button><span />
    </div>
  )
}

export default function World3D() {
  const res = useGameStore((s) => s.res)
  const event = useGameStore((s) => s.event)
  const fact = useGameStore((s) => s.fact)
  const planet = useGameStore((s) => s.planet)
  const theme = THEMES[planet]

  const stations = useMemo(() => (event ? assignStations(event.choices) : []), [event])
  const pads = useMemo(() => stations.map(padFor), [stations])

  useEffect(() => {
    const on = (down) => (e) => {
      const k = KEYS[e.code]
      if (!k) return
      if (e.code === 'Space' && e.target.closest?.('button')) return // let Space press focused buttons
      e.preventDefault()
      input[k] = down
    }
    const kd = on(true), ku = on(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      Object.keys(input).forEach((k) => (input[k] = false))
      cam.yaw = 0
    }
  }, [])

  // Drag anywhere on the 3D view to turn the camera (mouse or finger).
  const drag = useRef(null)
  const pointer = {
    onPointerDown: (e) => { drag.current = e.clientX },
    onPointerMove: (e) => { if (drag.current !== null) { cam.yaw -= (e.clientX - drag.current) * 0.006; drag.current = e.clientX } },
    onPointerUp: () => { drag.current = null },
    onPointerLeave: () => { drag.current = null },
  }

  const flare = isRadiation(event)
  const alarm = res.power < 20 || res.oxygen < 20 || res.shielding < 20
  return (
    <div className="absolute inset-0 touch-none" {...pointer}>
      <Canvas shadows camera={{ position: [0, 6, 20], fov: 55, far: 1200 }} dpr={[1, 1.75]}>
        <color attach="background" args={[theme.sky]} />
        {theme.fog && <fog attach="fog" args={theme.fog} />}
        <ambientLight intensity={theme.ambient} />
        <hemisphereLight args={[planet === 'mars' ? '#fbbf8a' : '#c7d2fe', theme.ground, 0.25]} />
        <directionalLight
          position={SUN_DIR.clone().multiplyScalar(60).toArray()} intensity={flare ? 2.7 : 2.3} color={flare ? '#ffe4c4' : '#fff7ed'} castShadow
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={160}
        />
        <Sky planet={planet} theme={theme} flare={flare} />
        <Terrain theme={theme} />
        <Habitat res={res} alarm={alarm} />
        <ShieldGenerator res={res} />
        <SolarArray res={res} />
        <Greenhouse res={res} />
        <ScienceLab res={res} />
        <CommsTower alarm={alarm} />
        <Lander />
        <Flag />
        <Rover />
        <ShieldDome res={res} flare={flare} />
        {event && <Pads choices={event.choices} stations={stations} disabled={!!fact} />}
        {event && <Astronaut pads={pads} suitColor="#f1f5f9" />}
      </Canvas>
      <DPad />
    </div>
  )
}
