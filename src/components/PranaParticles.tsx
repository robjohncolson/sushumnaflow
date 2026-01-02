import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBreathStore, useVisualStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState, BreathPhase } from '../engines/breathEngine'

// Pre-allocated vectors to avoid allocations in useFrame
const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()

// Chakra positions along the spine (y-axis)
const CHAKRA_POSITIONS = [
  -2.5, // Root (Muladhara)
  -1.5, // Sacral (Svadhisthana)
  -0.5, // Solar Plexus (Manipura)
  0.5, // Heart (Anahata)
  1.5, // Throat (Vishuddha)
  2.5, // Third Eye (Ajna)
  3.5, // Crown (Sahasrara)
]

// Chakra colors
const CHAKRA_COLORS = [
  new THREE.Color('#ff0000'), // Root - Red
  new THREE.Color('#ff7700'), // Sacral - Orange
  new THREE.Color('#ffff00'), // Solar - Yellow
  new THREE.Color('#00ff00'), // Heart - Green
  new THREE.Color('#00ffff'), // Throat - Cyan
  new THREE.Color('#0000ff'), // Third Eye - Indigo
  new THREE.Color('#ff00ff'), // Crown - Violet
]

interface ParticleData {
  offset: number // Phase offset for variation
  radius: number // Radial distance from spine
  speed: number // Individual speed multiplier
  chakraIndex: number // Which chakra this particle is associated with
}

/**
 * PranaParticles - InstancedMesh particles that flow along energy channels
 *
 * Uses Tone.Transport.seconds as the time source (no Date.now/setTimeout)
 * Implements both Linear (Kundalini) and Microcosmic (Taoist) orbit modes
 */
export function PranaParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { particleCount } = useVisualStore()
  const { bpm, ratios, orbitMode } = useBreathStore()
  const { getTransportSeconds, setLumens } = useAudio()

  // Create particle data
  const particleData = useMemo<ParticleData[]>(() => {
    const data: ParticleData[] = []
    for (let i = 0; i < particleCount; i++) {
      data.push({
        offset: Math.random() * Math.PI * 2,
        radius: 0.3 + Math.random() * 0.5,
        speed: 0.8 + Math.random() * 0.4,
        chakraIndex: Math.floor(Math.random() * CHAKRA_POSITIONS.length),
      })
    }
    return data
  }, [particleCount])

  // Shared geometry and material (created once)
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.04, 0), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 2, 2), // HDR cyan for bloom
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

    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)

    // Update audio lumens
    setLumens(breathState.lumens)

    const { phase, cycleProgress } = breathState

    // Calculate flow direction based on phase
    let flowDirection: 1 | -1

    if (phase === BreathPhase.INHALE || phase === BreathPhase.HOLD_IN) {
      // Rising energy
      flowDirection = 1
    } else {
      // Descending energy
      flowDirection = -1
    }

    // Update each particle
    for (let i = 0; i < particleCount; i++) {
      const data = particleData[i]
      if (!data) continue

      // Calculate position along the spine
      const spineProgress = (cycleProgress + data.offset / (Math.PI * 2)) % 1

      let x: number, y: number, z: number

      if (orbitMode === 'linear') {
        // Linear (Kundalini): Particles rise up spine, descend down spine
        const spineY =
          flowDirection === 1
            ? CHAKRA_POSITIONS[0] +
              spineProgress *
                (CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
                  CHAKRA_POSITIONS[0])
            : CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
              spineProgress *
                (CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
                  CHAKRA_POSITIONS[0])

        // Spiral around the spine
        const angle = spineProgress * Math.PI * 8 + data.offset
        x = Math.cos(angle) * data.radius
        y = spineY
        z = Math.sin(angle) * data.radius
      } else {
        // Microcosmic (Taoist): Rise up back, descend down front
        const totalPath = 2 // Normalized path length (up + down)
        const pathProgress = cycleProgress * totalPath

        if (pathProgress < 1) {
          // Rising up the back (spine) - Governor Vessel (Du Mai)
          const t = pathProgress
          const spineY =
            CHAKRA_POSITIONS[0] +
            t *
              (CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
                CHAKRA_POSITIONS[0])

          const angle = t * Math.PI * 4 + data.offset
          x = Math.cos(angle) * data.radius * 0.5 - 0.3 // Offset to back
          y = spineY
          z = Math.sin(angle) * data.radius * 0.5 - 0.5
        } else {
          // Descending down the front - Conception Vessel (Ren Mai)
          const t = pathProgress - 1
          const frontY =
            CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
            t *
              (CHAKRA_POSITIONS[CHAKRA_POSITIONS.length - 1] -
                CHAKRA_POSITIONS[0])

          const angle = t * Math.PI * 4 + data.offset
          x = Math.cos(angle) * data.radius * 0.5 + 0.3 // Offset to front
          y = frontY
          z = Math.sin(angle) * data.radius * 0.5 + 0.5
        }
      }

      // Add breathing motion
      const breathScale = 1 + Math.sin(time * 2 + data.offset) * 0.1
      const scale = 0.5 + breathState.lumens * 0.15

      tempObject.position.set(x, y, z)
      tempObject.scale.setScalar(scale * breathScale * data.speed)
      tempObject.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObject.matrix)

      // Color based on nearest chakra
      const nearestChakra = CHAKRA_POSITIONS.reduce(
        (nearest, pos, idx) =>
          Math.abs(pos - y) < Math.abs(CHAKRA_POSITIONS[nearest] - y)
            ? idx
            : nearest,
        0
      )

      // Blend between chakra color and energy intensity
      tempColor
        .copy(CHAKRA_COLORS[nearestChakra])
        .multiplyScalar(0.5 + breathState.lumens * 0.3)
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
