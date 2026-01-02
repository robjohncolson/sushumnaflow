import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualStore, useViewStore, useBreathStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState, BreathPhase } from '../engines/breathEngine'

// Pre-allocated vectors to avoid allocations in useFrame
const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()
const tempVec = new THREE.Vector3()

// Y range for particles
const Y_MIN = -3
const Y_MAX = 3
const Y_RANGE = Y_MAX - Y_MIN

// Chakra colors for KUNDALINI mode
const CHAKRA_COLORS = [
  new THREE.Color('#ff0000'), // Root - Red
  new THREE.Color('#ff7700'), // Sacral - Orange
  new THREE.Color('#ffff00'), // Solar - Yellow
  new THREE.Color('#00ff00'), // Heart - Green
  new THREE.Color('#00ffff'), // Throat - Cyan
  new THREE.Color('#4444ff'), // Third Eye - Indigo
  new THREE.Color('#ff00ff'), // Crown - Violet
]

// Orbit colors for ORBIT mode (yin/yang blend)
const ORBIT_COLOR_YANG = new THREE.Color('#ffaa44') // Golden ascending
const ORBIT_COLOR_YIN = new THREE.Color('#44aaff') // Silver descending

interface ParticleData {
  offset: number
  radius: number
  speed: number
  noisePhase: number
}

/**
 * Build Microcosmic Orbit curve (CatmullRomCurve3)
 * - Back ascent (Du Mai): from base up the spine
 * - Front descent (Ren Mai): from crown down the front
 */
function buildOrbitCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    [
      // Start at base (back)
      new THREE.Vector3(0, Y_MIN, -0.3),
      // Ascend up the back
      new THREE.Vector3(0, -2, -0.35),
      new THREE.Vector3(0, -1, -0.35),
      new THREE.Vector3(0, 0, -0.35),
      new THREE.Vector3(0, 1, -0.3),
      new THREE.Vector3(0, 2, -0.25),
      // Crown
      new THREE.Vector3(0, 2.8, -0.1),
      new THREE.Vector3(0, Y_MAX, 0.1),
      // Descend down the front
      new THREE.Vector3(0, 2.8, 0.25),
      new THREE.Vector3(0, 2, 0.35),
      new THREE.Vector3(0, 1, 0.35),
      new THREE.Vector3(0, 0, 0.4),
      new THREE.Vector3(0, -1, 0.4),
      new THREE.Vector3(0, -2, 0.35),
      // Return to base
      new THREE.Vector3(0, Y_MIN, 0.1),
    ],
    true, // closed loop
    'catmullrom',
    0.5
  )
}

/**
 * PranaParticles - InstancedMesh particles that flow along energy channels
 *
 * - Uses Tone.Transport.seconds as time source
 * - Reads stores via getState() to avoid re-renders
 * - KUNDALINI: Linear Y traversal up/down central axis
 * - ORBIT: CatmullRomCurve3 loop (back up, front down)
 */
export function PranaParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const particleCount = useVisualStore.getState().particleCount
  const { getTransportSeconds, setLumens } = useAudio()

  // Pre-build the orbit curve (once)
  const orbitCurve = useMemo(() => buildOrbitCurve(), [])

  // Create particle data (once, based on initial count)
  const particleData = useMemo<ParticleData[]>(() => {
    const count = useVisualStore.getState().particleCount
    const data: ParticleData[] = []
    for (let i = 0; i < count; i++) {
      data.push({
        offset: Math.random(),
        radius: 0.2 + Math.random() * 0.4,
        speed: 0.8 + Math.random() * 0.4,
        noisePhase: Math.random() * Math.PI * 2,
      })
    }
    return data
  }, [])

  // Shared geometry and material
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.04, 0), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 2, 2),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    []
  )

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Animation loop - sync to Tone.Transport
  useFrame(() => {
    if (!meshRef.current) return

    // Read stores via getState() - no re-renders
    const { bpm, ratios } = useBreathStore.getState()
    const { mapMode } = useViewStore.getState()
    const currentParticleCount = useVisualStore.getState().particleCount

    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)

    // Update audio lumens
    setLumens(breathState.lumens)

    const { phase, progress, cycleProgress, lumens } = breathState

    // Determine if ascending or descending
    const isAscending =
      phase === BreathPhase.INHALE || phase === BreathPhase.HOLD_IN

    // Update each particle
    const count = Math.min(currentParticleCount, particleData.length)
    for (let i = 0; i < count; i++) {
      const data = particleData[i]
      if (!data) continue

      // Stagger particles with offset
      const particleProgress = (cycleProgress + data.offset) % 1

      let x: number, y: number, z: number

      if (mapMode === 'KUNDALINI') {
        // KUNDALINI: Linear Y traversal along central axis
        // Inhale: rise from bottom to top
        // Exhale: descend from top to bottom

        let yProgress: number
        if (isAscending) {
          // Rising phase
          yProgress = particleProgress
        } else {
          // Descending phase
          yProgress = 1 - particleProgress
        }

        y = Y_MIN + yProgress * Y_RANGE

        // Gentle spiral around the spine
        const spiralAngle = particleProgress * Math.PI * 6 + data.noisePhase
        x = Math.cos(spiralAngle) * data.radius * 0.6
        z = Math.sin(spiralAngle) * data.radius * 0.6

        // Add subtle swirl during holds
        if (
          phase === BreathPhase.HOLD_IN ||
          phase === BreathPhase.HOLD_OUT
        ) {
          const swirl = Math.sin(time * 3 + data.noisePhase) * 0.1
          x += swirl
          z += swirl
        }
      } else {
        // ORBIT: CatmullRomCurve3 loop
        // Inhale drives curve parameter over back portion (0 to 0.5)
        // Exhale drives curve parameter over front portion (0.5 to 1)

        let curveT: number
        if (phase === BreathPhase.INHALE) {
          // Ascending back (0 to ~0.5)
          curveT = progress * 0.45
        } else if (phase === BreathPhase.HOLD_IN) {
          // At crown (0.45 to 0.55)
          curveT = 0.45 + progress * 0.1
        } else if (phase === BreathPhase.EXHALE) {
          // Descending front (0.55 to 1)
          curveT = 0.55 + progress * 0.4
        } else {
          // HOLD_OUT: at base (0.95 to 1 and 0 to 0.05)
          curveT = 0.95 + progress * 0.1
          if (curveT >= 1) curveT -= 1
        }

        // Add particle offset to stagger along the curve
        curveT = (curveT + data.offset * 0.3) % 1

        // Get position on curve
        orbitCurve.getPointAt(curveT, tempVec)
        x = tempVec.x
        y = tempVec.y
        z = tempVec.z

        // Add radial offset for visual spread
        const radialAngle = data.noisePhase + curveT * Math.PI * 4
        x += Math.cos(radialAngle) * data.radius * 0.3
        z += Math.sin(radialAngle) * data.radius * 0.3

        // Subtle swirl during all phases (fluid, no pauses)
        const swirl = Math.sin(time * 2 + data.noisePhase) * 0.05
        x += swirl
        z += swirl
      }

      // Scale based on lumens
      const breathScale = 1 + Math.sin(time * 2 + data.noisePhase) * 0.1
      const scale = (0.4 + lumens * 0.12) * breathScale * data.speed

      tempObject.position.set(x, y, z)
      tempObject.scale.setScalar(scale)
      tempObject.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObject.matrix)

      // Color based on mode
      if (mapMode === 'KUNDALINI') {
        // Color by nearest chakra
        const yNorm = (y - Y_MIN) / Y_RANGE
        const chakraIndex = Math.floor(yNorm * (CHAKRA_COLORS.length - 1))
        const clampedIndex = Math.max(
          0,
          Math.min(CHAKRA_COLORS.length - 1, chakraIndex)
        )
        tempColor
          .copy(CHAKRA_COLORS[clampedIndex])
          .multiplyScalar(0.5 + lumens * 0.3)
      } else {
        // ORBIT: blend yang/yin based on back/front position
        const isFrontSide = z > 0
        tempColor
          .copy(isFrontSide ? ORBIT_COLOR_YIN : ORBIT_COLOR_YANG)
          .multiplyScalar(0.5 + lumens * 0.3)
      }

      meshRef.current.setColorAt(i, tempColor)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, particleCount]}
      frustumCulled={false}
    />
  )
}
