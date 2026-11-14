import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore.js'
import { STATIONS, assignStations, padFor } from '../lib/stations.js'
import { suitById } from '../data/suits.js'

// ---------- tuning knobs ----------
const WALK = 5
const SPRINT = 9
const GRAVITY = { moon: 2.5, mars: 5, europa: 2.1 } // ponytail: game-feel values; real: Moon 1.62, Mars 3.71, Europa 1.31 m/s²
const JUMP = 4.5
const WORLD_R = 120
const PAD_R = 1.4
const WORK_TIME = 1.2 // seconds standing on a pad to "do the job"
const CAM_DIST = 9
const CAM_HEIGHT = 5
const FLAT_R = 34 // the base sits on a levelled area; terrain rolls outside it

const THEMES = {
  moon: { ground: '#9a9aa0', rock: '#6b6a68', mountain: '#5a5a60', sky: '#000003', fog: null, sunSize: 9, ambient: 0.1, hemi: 0.18, sun: 3.4 },
  mars: { ground: '#c4683a', rock: '#7c3418', mountain: '#8a3b1c', sky: '#1c0905', fog: ['#4a1d0c', 90, 260], sunSize: 6, ambient: 0.28, hemi: 0.3, sun: 2.6 },
  // Sunlight at Jupiter is ~25x weaker; kept brighter than real so kids can see.
  europa: { ground: '#e4ebf1', rock: '#b8c4cf', mountain: '#c9d3dc', sky: '#000002', fog: null, sunSize: 2.5, ambient: 0.16, hemi: 0.3, sun: 2.1, icy: true },
}

// Shared input: keyboard, mouse drag and the touch D-pad all write here.
const input = { up: false, down: false, left: false, right: false, jump: false, sprint: false, turnL: false, turnR: false }
const cam = { yaw: 0 }
const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyQ: 'turnL', KeyE: 'turnR',
}

const SOLIDS = [
  { x: 0, z: 0, r: 4.9 }, // geodesic dome
  { x: -6, z: 0, r: 1.1 }, { x: -11, z: -1.6, r: 1.7 }, { x: -11, z: 1.6, r: 1.7 }, // tunnel + habitat module
  ...['shield', 'solar', 'greenhouse', 'lab', 'comms'].map((id) => ({ x: STATIONS[id].pos[0], z: STATIONS[id].pos[1], r: { shield: 1.6, solar: 4.6, greenhouse: 3.1, lab: 2.6, comms: 1.2 }[id] })),
  { x: -20, z: 16, r: 2.5 }, // lander
]

const LETTERS = ['A', 'B', 'C']
const isRadiation = (e) => /flare|cme|gst|sep_|storm|radiation/.test(e?.id ?? '')

// ---------- deterministic noise (same terrain every visit) ----------
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
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s) }
function noise(x, z) { // smooth value noise
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, z) => noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.28 + noise(x * 4.3, z * 4.3) * 0.12
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// Bowl-shaped craters with raised rims, outside the levelled base area.
const CRATERS = (() => {
  const rand = rng(7)
  return Array.from({ length: 38 }, () => { const [x, z] = ring(rand, 46, 150); const r = 3 + rand() ** 2 * 14; return [x, z, r, r * (0.16 + rand() * 0.1)] })
})()

/** Ground height at (x, z): flat base pad, rolling dunes and craters further out. */
function heightAt(x, z) {
  const d = Math.hypot(x, z)
  let h = smooth(FLAT_R, FLAT_R + 18, d) * ((fbm(x * 0.018, z * 0.018) - 0.45) * 7 + (fbm(x * 0.09, z * 0.09) - 0.5) * 0.9)
  for (const [cx, cz, r, depth] of CRATERS) {
    const k = Math.hypot(x - cx, z - cz) / r
    if (k > 1.5) continue
    h += (k < 1 ? -depth * (1 - k * k) : 0) + depth * 0.4 * Math.exp(-(((k - 1) / 0.18) ** 2))
  }
  return h
}

// ---------- procedural textures (no downloads) ----------
function canvasTexture(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  return t
}

// Grey speckled dust with tiny craters; tinted per planet by the material colour.
const regolith = (repeat) => canvasTexture(512, 512, (g, w, h) => {
  const rand = rng(3)
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 26000; i++) { const v = 150 + rand() * 90; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2) }
  for (let i = 0; i < 45; i++) {
    const x = rand() * w, y = rand() * h, r = 1.5 + rand() ** 4 * 9
    g.fillStyle = 'rgba(70,70,70,0.35)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, r * 0.25); g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r, 3.4, 5.6); g.stroke()
  }
}, repeat)

// Europa: bright ice with reddish-brown cracks ("lineae") and very few craters (its surface is young).
const iceTexture = (repeat) => canvasTexture(512, 512, (g, w, h) => {
  const rand = rng(11)
  g.fillStyle = '#eef3f7'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 9000; i++) { const v = 205 + rand() * 50; g.fillStyle = `rgb(${v},${v + 4},${v + 10})`; g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3) }
  for (let i = 0; i < 26; i++) {
    let x = rand() * w, y = rand() * h, a = rand() * Math.PI
    g.strokeStyle = `rgba(${130 + rand() * 40},${70 + rand() * 30},${40 + rand() * 20},${0.35 + rand() * 0.4})`
    g.lineWidth = 1 + rand() * 4
    g.beginPath(); g.moveTo(x, y)
    for (let k = 0; k < 14; k++) { a += (rand() - 0.5) * 0.35; x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y) }
    g.stroke()
  }
}, repeat)

// Jupiter: tan/brown/white bands and the Great Red Spot.
const jupiterMap = () => canvasTexture(512, 256, (g, w, h) => {
  const bands = ['#e8dcc4', '#c9a27a', '#f2e8d5', '#b07a55', '#ead9bd', '#a8714d', '#f0e3c8', '#c49a72', '#e3d3b6']
  for (let y = 0; y < h; y++) {
    const t = y / h, i = Math.floor(t * bands.length + Math.sin(y * 0.35) * 0.4)
    g.fillStyle = bands[Math.max(0, Math.min(bands.length - 1, i))]
    g.fillRect(0, y, w, 1)
  }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 1) }
  g.fillStyle = '#b5482e'; g.beginPath(); g.ellipse(w * 0.62, h * 0.64, 26, 14, 0, 0, 7); g.fill()
  g.fillStyle = 'rgba(230,140,100,0.6)'; g.beginPath(); g.ellipse(w * 0.62, h * 0.64, 16, 8, 0, 0, 7); g.fill()
})

const solarCells = () => canvasTexture(256, 160, (g, w, h) => {
  g.fillStyle = '#0b1a3a'; g.fillRect(0, 0, w, h)
  g.strokeStyle = '#8aa0c8'; g.lineWidth = 2
  for (let x = 0; x <= w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let y = 0; y <= h; y += h / 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  g.strokeStyle = 'rgba(160,180,220,0.35)'; g.lineWidth = 1
  for (let x = 0; x <= w; x += w / 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
})

const earthMap = () => canvasTexture(512, 256, (g, w, h) => {
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lat = Math.abs(y / h - 0.5) * 2
    const land = fbm(x / 40, y / 40) > 0.56
    const cloud = fbm(x / 22 + 9, y / 14 + 3) > 0.6
    let c = land ? (lat > 0.8 ? [235, 240, 245] : [70 + fbm(x / 9, y / 9) * 80, 110, 60]) : [20, 60, 140]
    if (cloud || lat > 0.9) c = [240, 244, 250]
    const i = (y * w + x) * 4
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
})

/** A texture made once per component, freed when it unmounts. */
function useTexture(make) {
  const [t] = useState(make)
  useEffect(() => () => t.dispose(), [t])
  return t
}

// A thin metal strut between two points (trusses, legs, cables).
function Beam({ a, b, r = 0.04, color = '#a1a1aa' }) {
  const ka = a.join(), kb = b.join()
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...ka.split(',').map(Number)), vb = new THREE.Vector3(...kb.split(',').map(Number))
    const dir = vb.clone().sub(va)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { pos: va.add(vb).multiplyScalar(0.5).toArray(), quat, len }
  }, [ka, kb])
  return <mesh position={pos} quaternion={quat} castShadow><cylinderGeometry args={[r, r, len, 6]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.35} /></mesh>
}

// ---------- player ----------
function Astronaut({ pads }) {
  const root = useRef()
  const body = useRef()
  const legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef()
  const work = useRef()
  const arrow = useRef()
  const s = useRef({ vy: 0, y: 0, t: 0, padIdx: -1, progress: 0, done: false }).current
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const planet = useGameStore((st) => st.planet)
  const oxygen = useGameStore((st) => st.res.oxygen)
  const suitColor = useGameStore((st) => suitById(st.suit).color)

  // Backpack display: oxygen left, red when low.
  const display = useMemo(() => canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#020617'; g.fillRect(0, 0, w, h)
    const low = oxygen < 20
    g.fillStyle = low ? '#ef4444' : '#22d3ee'
    g.fillRect(8, 8, (w - 16) * (oxygen / 100), 8)
    g.font = 'bold 30px monospace'; g.textAlign = 'center'
    g.fillText(`O₂ ${oxygen}%`, w / 2, 52)
  }), [oxygen])
  useEffect(() => () => display.dispose(), [display])

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
    p.y = heightAt(p.x, p.z) // walk over dunes and into craters

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
    const swing = moving && ground ? Math.sin(s.t * 9) * 0.6 : 0
    body.current.position.y = s.y + (moving && ground ? Math.abs(Math.sin(s.t * 9)) * 0.07 : 0)
    legL.current.rotation.x = swing
    legR.current.rotation.x = -swing
    armL.current.rotation.x = working ? -1.3 + Math.sin(state.clock.elapsedTime * 14) * 0.25 : -swing * 0.7
    armR.current.rotation.x = working ? -1.3 - Math.sin(state.clock.elapsedTime * 14) * 0.25 : swing * 0.7

    // Guide arrow toward the nearest pad.
    let best = null, bestD = Infinity
    pads.forEach(([x, z]) => { const dd = Math.hypot(x - p.x, z - p.z); if (dd < bestD) { bestD = dd; best = [x, z] } })
    arrow.current.visible = !locked && !!best && bestD > 4
    if (best) {
      const a = Math.atan2(best[0] - p.x, best[1] - p.z)
      arrow.current.position.set(p.x + Math.sin(a) * 1.6, p.y + 0.15, p.z + Math.cos(a) * 1.6)
      arrow.current.rotation.set(0, a, 0)
    }

    // Third-person camera behind the player, rotated by yaw; never below the ground.
    const cx = p.x + Math.sin(cam.yaw) * CAM_DIST, cz = p.z + Math.cos(cam.yaw) * CAM_DIST
    camPos.set(cx, Math.max(p.y, heightAt(cx, cz)) + s.y * 0.5 + CAM_HEIGHT, cz)
    state.camera.position.lerp(camPos, 1 - Math.exp(-6 * dt))
    state.camera.lookAt(p.x, p.y + 1.4 + s.y * 0.5, p.z)
  })

  const suit = <meshStandardMaterial color={suitColor} roughness={0.75} />
  const joint = <meshStandardMaterial color="#9ca3af" roughness={0.6} />
  const dark = <meshStandardMaterial color="#52525b" roughness={0.7} />
  return (
    <>
      <group ref={root} position={[6, 0, 17]}>
        <group ref={body}>
          {/* torso + chest control box */}
          <mesh position={[0, 1.08, 0]} castShadow><capsuleGeometry args={[0.36, 0.5, 6, 16]} />{suit}</mesh>
          <mesh position={[0, 1.18, 0.33]} castShadow><boxGeometry args={[0.34, 0.22, 0.12]} /><meshStandardMaterial color="#cbd5e1" roughness={0.5} /></mesh>
          <mesh position={[-0.08, 1.2, 0.395]}><boxGeometry args={[0.07, 0.07, 0.01]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} /></mesh>
          <mesh position={[0.08, 1.2, 0.395]}><boxGeometry args={[0.07, 0.07, 0.01]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} /></mesh>
          <mesh position={[0, 0.72, 0]}><torusGeometry args={[0.33, 0.05, 8, 24]} />{joint}</mesh>
          {/* helmet: white shell, gold reflective visor, lamps */}
          <mesh position={[0, 1.78, -0.03]} castShadow><sphereGeometry args={[0.34, 32, 20]} />{suit}</mesh>
          <mesh position={[0, 1.79, 0.08]} rotation-x={-0.15}><sphereGeometry args={[0.3, 32, 20, 0, Math.PI * 2, 0, 1.35]} /><meshStandardMaterial color="#d4a017" metalness={1} roughness={0.08} envMapIntensity={2} /></mesh>
          <mesh position={[0, 1.55, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.24, 0.05, 8, 24]} />{joint}</mesh>
          {[-0.22, 0.22].map((x) => <mesh key={x} position={[x, 1.98, 0.2]}><boxGeometry args={[0.08, 0.06, 0.06]} /><meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={1.5} /></mesh>)}
          {/* life-support backpack with oxygen display */}
          <mesh position={[0, 1.2, -0.42]} castShadow><boxGeometry args={[0.62, 0.78, 0.32]} /><meshStandardMaterial color="#e5e7eb" roughness={0.6} /></mesh>
          <mesh position={[0, 1.28, -0.585]} rotation-y={Math.PI}><planeGeometry args={[0.42, 0.21]} /><meshBasicMaterial map={display} toneMapped={false} /></mesh>
          {/* arms with dark gloves */}
          {[[armL, -0.48], [armR, 0.48]].map(([ref, x]) => (
            <group key={x} ref={ref} position={[x, 1.38, 0]}>
              <mesh position={[0, -0.04, 0]}><sphereGeometry args={[0.15, 16, 12]} />{suit}</mesh>
              <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.12, 0.38, 4, 10]} />{suit}</mesh>
              <mesh position={[0, -0.6, 0]}><sphereGeometry args={[0.1, 12, 10]} />{dark}</mesh>
            </group>
          ))}
          {/* legs with grey boots */}
          {[[legL, -0.17], [legR, 0.17]].map(([ref, x]) => (
            <group key={x} ref={ref} position={[x, 0.62, 0]}>
              <mesh position={[0, -0.24, 0]} castShadow><capsuleGeometry args={[0.15, 0.32, 4, 10]} />{suit}</mesh>
              <mesh position={[0, -0.24, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.15, 0.03, 6, 16]} />{joint}</mesh>
              <mesh position={[0, -0.55, 0.05]} castShadow><boxGeometry args={[0.24, 0.16, 0.36]} />{dark}</mesh>
            </group>
          ))}
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
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[PAD_R, PAD_R + 0.12, 40]} />
          <meshBasicMaterial color="#e0f2fe" />
        </mesh>
        {!disabled && (
          <mesh position-y={6}>
            <cylinderGeometry args={[0.35, 0.9, 12, 16, 1, true]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
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

/** Glass geodesic dome on a concrete ring (reused for the habitat and the greenhouse). */
function GeoDome({ radius, glass = '#8ecae6', children }) {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(radius, 2), [radius])
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo])
  const concrete = useTexture(() => regolith(2))
  return (
    <group>
      <mesh position-y={0.55} castShadow receiveShadow>
        <cylinderGeometry args={[radius + 0.15, radius + 0.3, 1.1, 48]} />
        <meshStandardMaterial map={concrete} color="#8b8b90" roughness={0.95} />
      </mesh>
      <group position-y={1.1}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={glass} transparent opacity={0.22} roughness={0.05} metalness={0.4} envMapIntensity={2.5} depthWrite={false} side={THREE.DoubleSide} flatShading />
        </mesh>
        <lineSegments geometry={edges}><lineBasicMaterial color="#e5e7eb" /></lineSegments>
      </group>
      {children}
    </group>
  )
}

function Habitat({ res, alarm }) {
  const beacon = useRef()
  useFrame(({ clock }) => { beacon.current.emissiveIntensity = alarm ? (Math.sin(clock.elapsedTime * 8) > 0 ? 4 : 0.2) : 0.4 })
  const k = res.oxygen / 100
  return (
    <group>
      <GeoDome radius={4.4}>
        {/* interior: floor, bunks, warm light that dims with oxygen */}
        <mesh position-y={1.12} rotation-x={-Math.PI / 2}><circleGeometry args={[4.3, 40]} /><meshStandardMaterial color="#cbd5e1" roughness={0.8} /></mesh>
        {[[-1.6, -1.2], [1.6, -1.2], [0, -2.4], [-1.6, 1.4]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.6, z]} castShadow><boxGeometry args={[1.4, 0.9, 0.8]} /><meshStandardMaterial color="#e5e7eb" roughness={0.6} /></mesh>
        ))}
        <mesh position={[1.3, 1.9, 1.2]}><boxGeometry args={[1.2, 0.7, 0.06]} /><meshStandardMaterial color="#020617" emissive="#38bdf8" emissiveIntensity={0.4 + k} /></mesh>
        <pointLight position={[0, 3.6, 0]} color="#ffd8a8" intensity={6 * k + 1} distance={10} />
        <mesh position-y={5.7}><cylinderGeometry args={[0.04, 0.04, 1.2]} /><meshStandardMaterial color="#a1a1aa" /></mesh>
        <mesh position-y={6.35}><sphereGeometry args={[0.14, 16, 8]} /><meshStandardMaterial ref={beacon} color="#7f1d1d" emissive="#ef4444" /></mesh>
      </GeoDome>
      {/* front airlock door */}
      <group position={[0, 0, 4.5]}>
        <mesh position-y={1.3} castShadow><boxGeometry args={[1.8, 2.6, 1.4]} /><meshStandardMaterial color="#d4d4d8" roughness={0.5} /></mesh>
        <mesh position={[0, 1.2, 0.71]}><boxGeometry args={[1, 2, 0.02]} /><meshStandardMaterial color="#3f3f46" /></mesh>
        <mesh position={[0, 2.35, 0.72]}><boxGeometry args={[1.2, 0.08, 0.02]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.8} /></mesh>
      </group>
      {/* ribbed inflatable tunnel to the habitat module */}
      <mesh position={[-6.1, 1, 0]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[0.8, 0.8, 3.6, 24]} /><meshStandardMaterial color="#d6d3d1" roughness={0.9} /></mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-4.5 - i * 0.4, 1, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.82, 0.07, 8, 24]} /><meshStandardMaterial color="#a8a29e" roughness={0.8} /></mesh>
      ))}
      {/* white cylindrical habitat module on legs */}
      <group position={[-11, 1.7, 0]}>
        <mesh rotation-x={Math.PI / 2} castShadow receiveShadow><capsuleGeometry args={[1.45, 3.2, 8, 32]} /><meshStandardMaterial color="#f4f4f5" roughness={0.45} metalness={0.1} /></mesh>
        {[-1.2, -0.4, 0.4, 1.2].map((z) => [-1, 1].map((sx) => (
          <mesh key={`${z}${sx}`} position={[sx * 1.43, 0.25, z]} rotation-y={sx * Math.PI / 2}>
            <planeGeometry args={[0.45, 0.35]} /><meshStandardMaterial color="#020617" emissive="#93c5fd" emissiveIntensity={0.2 + k * 0.8} side={THREE.DoubleSide} />
          </mesh>
        )))}
        <mesh position={[0, -0.2, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[1.47, 1.47, 0.12, 32]} /><meshStandardMaterial color="#0ea5e9" /></mesh>
        {[[-1, -1.6], [1, -1.6], [-1, 1.6], [1, 1.6]].map(([x, z]) => <Beam key={`${x}${z}`} a={[x * 0.9, -1, z]} b={[x * 1.2, -1.7, z]} r={0.07} />)}
      </group>
      <Label id="habitat" y={7.2} />
    </group>
  )
}

function ShieldGenerator({ res }) {
  const r1 = useRef(), r2 = useRef()
  const k = res.shielding / 100
  useFrame((_, dt) => { r1.current.rotation.z += dt * (0.5 + k * 2); r2.current.rotation.x += dt * (0.4 + k * 1.5) })
  return (
    <group position={at('shield')}>
      <mesh position-y={0.3} castShadow receiveShadow><cylinderGeometry args={[1.3, 1.5, 0.6, 24]} /><meshStandardMaterial color="#52525b" roughness={0.8} /></mesh>
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; return <Beam key={i} a={[Math.cos(a) * 1.1, 0.6, Math.sin(a) * 1.1]} b={[0, 3.2, 0]} r={0.06} /> })}
      <mesh position-y={2} castShadow><cylinderGeometry args={[0.22, 0.32, 3, 12]} /><meshStandardMaterial color="#71717a" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position-y={3.7}><sphereGeometry args={[0.55, 24, 16]} /><meshStandardMaterial color="#7c3aed" emissive="#a78bfa" emissiveIntensity={0.3 + k * 2.5} /></mesh>
      <mesh ref={r1} position-y={3.7}><torusGeometry args={[1.1, 0.06, 8, 40]} /><meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={k * 2} /></mesh>
      <mesh ref={r2} position-y={3.7}><torusGeometry args={[1.4, 0.05, 8, 40]} /><meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={k * 1.5} /></mesh>
      <Label id="shield" y={5.2} />
    </group>
  )
}

/** Big field of solar panels with visible cells; they glow faintly with stored power. */
function SolarArray({ res }) {
  const cells = useTexture(solarCells)
  const k = res.power / 100
  const panels = []
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) panels.push([(col - 1.5) * 2.1, (row - 1) * 1.7])
  return (
    <group position={at('solar')} rotation-y={-0.3}>
      {panels.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Beam a={[-0.7, 0, 0]} b={[-0.7, 1.1, 0]} r={0.05} />
          <Beam a={[0.7, 0, 0]} b={[0.7, 1.1, 0]} r={0.05} />
          <group position-y={1.2} rotation-x={-0.55}>
            <mesh castShadow receiveShadow><boxGeometry args={[2, 0.05, 1.45]} /><meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.3} /></mesh>
            <mesh position-y={0.03} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[1.9, 1.35]} />
              <meshStandardMaterial map={cells} metalness={0.6} roughness={0.18} envMapIntensity={1.8} emissive="#1e40af" emissiveIntensity={k * 0.35} />
            </mesh>
          </group>
        </group>
      ))}
      <Label id="solar" y={3.4} />
    </group>
  )
}

function Greenhouse({ res }) {
  const k = res.oxygen / 100
  return (
    <group position={at('greenhouse')}>
      <GeoDome radius={2.8} glass="#bbf7d0">
        <mesh position-y={1.12} rotation-x={-Math.PI / 2}><circleGeometry args={[2.7, 32]} /><meshStandardMaterial color="#3f2a1d" roughness={1} /></mesh>
        {[[-1, -0.6], [0.8, -0.9], [0, 0.8], [-1.2, 0.9], [1.3, 0.5], [0.2, -0.1]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.15 + 0.5 * (0.3 + k), z]} scale={0.3 + k * 0.9}>
            <coneGeometry args={[0.35, 1, 8]} /><meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={k * 0.5} />
          </mesh>
        ))}
        <pointLight position={[0, 2.6, 0]} color="#f0abfc" intensity={k * 6} distance={6} />
      </GeoDome>
      <Label id="greenhouse" y={4.9} />
    </group>
  )
}

function ScienceLab({ res }) {
  const dish = useRef()
  const k = Math.min(1, res.science / 60)
  useFrame((_, dt) => { dish.current.rotation.y += dt * 0.6 })
  return (
    <group position={at('lab')} rotation-y={0.6}>
      <mesh position-y={1.1} castShadow receiveShadow><boxGeometry args={[3.4, 2.2, 2.4]} /><meshStandardMaterial color="#f4f4f5" roughness={0.5} /></mesh>
      <mesh position-y={2.3}><boxGeometry args={[3.5, 0.18, 2.5]} /><meshStandardMaterial color="#3f3f46" /></mesh>
      <mesh position={[0, 1.3, 1.21]}><boxGeometry args={[2.6, 0.45, 0.02]} /><meshStandardMaterial color="#022c22" emissive="#34d399" emissiveIntensity={0.3 + k * 2} /></mesh>
      <mesh position={[1.2, 0.8, 1.21]}><boxGeometry args={[0.7, 1.5, 0.02]} /><meshStandardMaterial color="#3f3f46" /></mesh>
      <group ref={dish} position={[0.6, 2.9, 0]}>
        <Beam a={[0, -0.5, 0]} b={[0, 0, 0]} r={0.06} />
        <mesh rotation-x={-0.8}><sphereGeometry args={[0.75, 24, 12, 0, Math.PI * 2, 0, 0.9]} /><meshStandardMaterial color="#e5e7eb" side={THREE.DoubleSide} metalness={0.4} roughness={0.3} /></mesh>
      </group>
      <Label id="lab" y={4.3} />
    </group>
  )
}

/** Lattice radio mast with guy cables, like a real field antenna. */
function CommsTower({ alarm }) {
  const light = useRef()
  useFrame(({ clock }) => { light.current.emissiveIntensity = Math.sin(clock.elapsedTime * (alarm ? 9 : 3)) > 0 ? 3 : 0.2 })
  const H = 10, LEVELS = 8
  const leg = (i, y) => { const w = 0.55 - (y / H) * 0.3, a = (i / 3) * Math.PI * 2; return [Math.cos(a) * w, y, Math.sin(a) * w] }
  const struts = []
  for (let l = 0; l < LEVELS; l++) {
    const y0 = (l / LEVELS) * H, y1 = ((l + 1) / LEVELS) * H
    for (let i = 0; i < 3; i++) {
      struts.push([leg(i, y0), leg(i, y1), 0.045])
      struts.push([leg(i, y1), leg((i + 1) % 3, y1), 0.02])
      struts.push([leg(i, y0), leg((i + 1) % 3, y1), 0.018])
    }
  }
  return (
    <group position={at('comms')}>
      {struts.map(([a, b, r], i) => <Beam key={i} a={a} b={b} r={r} color="#d4d4d8" />)}
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; const g = [Math.cos(a) * 6, 0.1, Math.sin(a) * 6]; return (
        <group key={i}>
          <Beam a={leg(i, 8)} b={g} r={0.012} color="#e5e7eb" />
          <mesh position={g}><boxGeometry args={[0.35, 0.25, 0.35]} /><meshStandardMaterial color="#52525b" /></mesh>
        </group>
      ) })}
      <mesh position={[0, 8.6, 0.5]} rotation-x={-1.1}><sphereGeometry args={[1.1, 24, 12, 0, Math.PI * 2, 0, 0.8]} /><meshStandardMaterial color="#f4f4f5" side={THREE.DoubleSide} metalness={0.3} roughness={0.35} /></mesh>
      <mesh position-y={H + 0.2}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial ref={light} color="#7f1d1d" emissive="#ef4444" /></mesh>
      <Label id="comms" y={H + 1.2} />
    </group>
  )
}

function Lander() {
  return (
    <group position={[-20, 0, 16]}>
      <mesh position-y={1.6} castShadow><cylinderGeometry args={[1.2, 1.5, 1.4, 8]} /><meshStandardMaterial color="#d4a017" metalness={0.9} roughness={0.25} envMapIntensity={1.5} /></mesh>
      <mesh position-y={2.8} castShadow><boxGeometry args={[1.4, 1, 1.4]} /><meshStandardMaterial color="#d4d4d8" roughness={0.5} /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <group key={i}>
            <Beam a={[Math.sin(a) * 1.2, 1.4, Math.cos(a) * 1.2]} b={[Math.sin(a) * 2.1, 0.08, Math.cos(a) * 2.1]} r={0.07} />
            <mesh position={[Math.sin(a) * 2.1, 0.05, Math.cos(a) * 2.1]}><cylinderGeometry args={[0.3, 0.32, 0.08, 16]} /><meshStandardMaterial color="#a1a1aa" /></mesh>
          </group>
        )
      })}
    </group>
  )
}

function Flag() {
  return (
    <group position={[4.8, 0, 8.5]}>
      <mesh position-y={1.3}><cylinderGeometry args={[0.035, 0.035, 2.6]} /><meshStandardMaterial color="#e5e7eb" metalness={0.6} /></mesh>
      <mesh position={[0.5, 2.25, 0]}><planeGeometry args={[1, 0.6]} /><meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={0.25} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

/** Six-wheel rover with a solar deck and camera mast, driving a loop around the base. */
function Rover() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * 0.12
    ref.current.position.set(Math.sin(a) * 28, 0, Math.cos(a) * 28)
    ref.current.rotation.y = a + Math.PI / 2
  })
  const cells = useTexture(solarCells)
  return (
    <group ref={ref}>
      <mesh position-y={0.75} castShadow><boxGeometry args={[2.2, 0.4, 1.3]} /><meshStandardMaterial color="#84cc16" roughness={0.6} /></mesh>
      <mesh position-y={0.99} rotation-x={-Math.PI / 2}><planeGeometry args={[2.1, 1.2]} /><meshStandardMaterial map={cells} metalness={0.5} roughness={0.2} /></mesh>
      <Beam a={[-0.8, 0.95, 0]} b={[-0.8, 1.9, 0]} r={0.035} />
      <mesh position={[-0.8, 2, 0]}><boxGeometry args={[0.25, 0.18, 0.4]} /><meshStandardMaterial color="#27272a" /></mesh>
      {[-0.8, 0, 0.8].map((x) => [-0.72, 0.72].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.33, z]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.33, 0.33, 0.24, 18]} /><meshStandardMaterial color="#27272a" roughness={0.9} /></mesh>
      )))}
    </group>
  )
}

function ShieldDome({ res, flare }) {
  const mat = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mat.current.opacity = 0.03 + (res.shielding / 100) * 0.22 + (res.shielding < 20 || flare ? Math.sin(t * 6) * 0.07 : 0)
  })
  return (
    // Energy grid, not a solid bubble: a solid dome tints the whole view purple from inside.
    <mesh>
      <sphereGeometry args={[24, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
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
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx(i), ry, rx(i + 3)); m.updateMatrix()
      ref.current.setMatrixAt(i, m.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[null, null, items.length]} castShadow receiveShadow>{children}</instancedMesh>
}
const rx = (i) => (hash(i, 1.7) - 0.5) * 0.5

function Terrain({ theme }) {
  const ground = useTexture(() => (theme.icy ? iceTexture(40) : regolith(90)))
  const rockTex = useTexture(() => regolith(1))
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(520, 520, 220, 220)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      pos.setY(i, heightAt(x, z))
      const v = 0.78 + fbm(x * 0.03 + 50, z * 0.03) * 0.3 + fbm(x * 0.15, z * 0.15) * 0.1 // darker "maria" patches
      colors.set([v, v, v], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const { rocks, mountains } = useMemo(() => {
    const rand = rng(42)
    const rocks = Array.from({ length: 320 }, () => { const [x, z] = ring(rand, 9, 150); const s = 0.12 + rand() ** 3 * 1.5; return [x, heightAt(x, z) + s * 0.25, z, s * (0.8 + rand() * 0.6), s * 0.6, s, rand() * 6] })
      .filter(([x, , z]) => !SOLIDS.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1.5))
    const mountains = Array.from({ length: 54 }, (_, i) => {
      const a = (i / 54) * Math.PI * 2 + rand() * 0.1, d = 180 + rand() * 45, h = 10 + rand() * 26, w = 30 + rand() * 34
      return [Math.cos(a) * d, -h * 0.25, Math.sin(a) * d, w, h, w * (0.7 + rand() * 0.6), rand() * 6]
    })
    return { rocks, mountains }
  }, [])
  return (
    <>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial map={ground} bumpMap={ground} bumpScale={1.2} color={theme.ground} roughness={theme.icy ? 0.55 : 1} vertexColors />
      </mesh>
      <Instanced items={rocks}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial map={rockTex} bumpMap={rockTex} bumpScale={2} color={theme.rock} roughness={0.95} flatShading /></Instanced>
      <Instanced items={mountains}><sphereGeometry args={[0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial map={rockTex} color={theme.mountain} roughness={1} flatShading /></Instanced>
    </>
  )
}

// Low sun = long, hard shadows like real lunar photos.
const SUN_DIR = new THREE.Vector3(0.62, 0.3, -0.72).normalize()

function Sky({ planet, theme, flare }) {
  const sun = SUN_DIR.clone().multiplyScalar(380)
  const earth = useTexture(earthMap)
  const jupiter = useTexture(jupiterMap)
  return (
    <>
      <Stars radius={420} depth={60} count={9000} factor={6} saturation={0.1} fade speed={0.2} />
      <mesh position={sun}><sphereGeometry args={[theme.sunSize, 32, 16]} /><meshBasicMaterial color={flare ? '#fdba74' : '#fffbeb'} toneMapped={false} /></mesh>
      <mesh position={sun}><sphereGeometry args={[theme.sunSize * (flare ? 3.2 : 2.2), 32, 16]} /><meshBasicMaterial color={flare ? '#fb923c' : '#fde68a'} transparent opacity={flare ? 0.3 : 0.12} depthWrite={false} /></mesh>
      {planet === 'europa' && (
        <>
          <group position={[-120, 52, -320]} rotation={[0.1, 0.6, 0.05]}>
            <mesh><sphereGeometry args={[70, 64, 32]} /><meshStandardMaterial map={jupiter} emissive="#3b2a1a" emissiveIntensity={0.35} roughness={0.9} /></mesh>
          </group>
          <TextSprite position={[-120, -26, -320]} height={6} border="" color="#fde68a" lines={['🪐 Jupiter – 11 Earths wide!']} />
          <mesh position={[160, 140, -260]}><sphereGeometry args={[0.9, 12, 8]} /><meshBasicMaterial color="#93c5fd" /></mesh>
          <TextSprite position={[160, 134, -260]} height={4} border="" color="#7dd3fc" lines={['🌍 Earth – over 600 million km away']} />
        </>
      )}
      {planet === 'europa' ? null : planet === 'moon' ? (
        <group position={[-170, 120, -260]}>
          <mesh rotation={[0.4, 2, 0]}><sphereGeometry args={[26, 64, 32]} /><meshStandardMaterial map={earth} emissive="#1e3a8a" emissiveIntensity={0.25} roughness={0.8} /></mesh>
          <mesh scale={1.08}><sphereGeometry args={[26, 32, 16]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0.1} depthWrite={false} side={THREE.BackSide} /></mesh>
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
      <Canvas shadows camera={{ position: [0, 6, 20], fov: 55, far: 1200 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
        <color attach="background" args={[theme.sky]} />
        {theme.fog && <fog attach="fog" args={theme.fog} />}
        {/* Soft studio-style reflections for glass, metal and the visor (built in code, nothing downloaded). */}
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={2} position={[10, 5, -10]} scale={[20, 6, 1]} color="#fff7ed" />
          <Lightformer form="rect" intensity={0.6} position={[-10, 3, 10]} scale={[20, 4, 1]} color="#93c5fd" />
          <Lightformer form="ring" intensity={0.4} position={[0, 10, 0]} scale={8} rotation-x={Math.PI / 2} />
        </Environment>
        <ambientLight intensity={theme.ambient} />
        <hemisphereLight args={[{ mars: '#fbbf8a', europa: '#f5d0a9' }[planet] ?? '#c7d2fe', theme.ground, theme.hemi]} />
        <directionalLight
          position={SUN_DIR.clone().multiplyScalar(70).toArray()} intensity={flare ? theme.sun * 1.15 : theme.sun} color={flare ? '#ffe4c4' : '#fffaf0'} castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
          shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={48} shadow-camera-bottom={-48} shadow-camera-far={200}
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
        {event && <Astronaut pads={pads} />}
      </Canvas>
      <DPad />
    </div>
  )
}
