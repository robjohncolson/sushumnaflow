import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBreathStore, useViewStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState } from '../engines/breathEngine'

/**
 * KundaliniOrb - A single luminous orb representing Kundalini Shakti
 *
 * - Rises through Sushumna during exhale
 * - Coils at Muladhara during inhale
 * - Reaches Sahasrara during hold-out
 * - Leaves a serpentine trail behind it
 */

// Trail configuration
const TRAIL_LENGTH = 30

// Colors (muted for wireframe style)
const KUNDALINI_CORE = new THREE.Color('#cc8800') // Golden fire
const KUNDALINI_TRAIL = new THREE.Color('#aa6600') // Darker trail
const AMRITA_COLOR = new THREE.Color('#88aacc') // Silver-blue nectar (descending)

export function KundaliniOrb() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.InstancedMesh>(null)

  const { getTransportSeconds, setBreathState, setLumens } = useAudio()
  const mapMode = useViewStore((s) => s.mapMode)

  // Only show in KUNDALINI mode
  if (mapMode !== 'KUNDALINI') return null

  // Trail instance positions (stored in ref to avoid re-renders)
  const trailPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3(0, -3, 0))
  )

  // Shared geometry and materials for trail (wireframe style)
  const trailGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.05, 0), [])
  const trailMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: KUNDALINI_TRAIL,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    []
  )

  // Temp objects for instanced mesh updates
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    if (!meshRef.current || !glowRef.current || !trailRef.current) return

    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)
    const { kundalini, phase, progress, lumens } = breathState

    // Update audio with breath state
    setBreathState(phase, progress, kundalini.y)
    setLumens(lumens)

    // Serpentine wobble
    const wobbleX = Math.sin(time * 3 + kundalini.y * 2) * 0.08
    const wobbleZ = Math.cos(time * 2.5 + kundalini.y * 1.5) * 0.06

    // Current position
    const currentPos = new THREE.Vector3(wobbleX, kundalini.y, wobbleZ)

    // Update main orb position
    meshRef.current.position.copy(currentPos)
    glowRef.current.position.copy(currentPos)

    // Pulsing scale based on rising state
    const pulseScale = kundalini.isRising
      ? 1.0 + Math.sin(time * 8) * 0.15
      : 0.8 + Math.sin(time * 4) * 0.1
    meshRef.current.scale.setScalar(pulseScale)
    glowRef.current.scale.setScalar(pulseScale * 2.5)

    // Color shift: golden when rising, silver when at crown/descending
    const coreColor = kundalini.isRising ? KUNDALINI_CORE : AMRITA_COLOR
    const meshMat = meshRef.current.material as THREE.MeshBasicMaterial
    meshMat.color.lerp(coreColor, 0.1)

    // Update trail - shift positions down and add current position
    const positions = trailPositions.current
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      positions[i].copy(positions[i - 1])
    }
    positions[0].copy(currentPos)

    // Update instanced mesh for trail
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const pos = positions[i]
      const alpha = 1 - i / TRAIL_LENGTH // Fade out along trail

      tempObject.position.copy(pos)
      tempObject.scale.setScalar(alpha * 0.8)
      tempObject.updateMatrix()
      trailRef.current.setMatrixAt(i, tempObject.matrix)

      // Color gradient along trail
      tempColor.copy(kundalini.isRising ? KUNDALINI_TRAIL : AMRITA_COLOR)
      tempColor.multiplyScalar(alpha)
      trailRef.current.setColorAt(i, tempColor)
    }

    trailRef.current.instanceMatrix.needsUpdate = true
    if (trailRef.current.instanceColor) {
      trailRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Trail particles */}
      <instancedMesh
        ref={trailRef}
        args={[trailGeometry, trailMaterial, TRAIL_LENGTH]}
        frustumCulled={false}
      />

      {/* Outer wireframe */}
      <mesh ref={glowRef}>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshBasicMaterial
          color={KUNDALINI_TRAIL}
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>

      {/* Core orb - wireframe */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.1, 1]} />
        <meshBasicMaterial
          color={KUNDALINI_CORE}
          transparent
          opacity={0.8}
          wireframe
        />
      </mesh>
    </group>
  )
}
