import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBreathStore, useViewStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState, type BandhaState } from '../engines/breathEngine'

/**
 * BandhaRings - Visual indicators for the three yogic locks
 *
 * - Mula Bandha (root lock) - Y = -3, perineum
 * - Uddiyana Bandha (abdominal lock) - Y = -1, navel
 * - Jalandhara Bandha (throat lock) - Y = 1.5, throat
 *
 * When engaged, rings glow brighter and constrict slightly
 */

interface BandhaRingProps {
  y: number
  label: string
  color: string
  isEngaged: boolean
  engageProgress: number // 0-1 for smooth transitions
}

function BandhaRing({ y, color, isEngaged, engageProgress }: BandhaRingProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  const baseColor = useMemo(() => new THREE.Color(color), [color])

  useFrame(({ clock }) => {
    if (!ringRef.current || !glowRef.current) return

    const t = clock.getElapsedTime()

    // Ring constriction when engaged
    const constriction = isEngaged ? 0.15 : 0

    // Subtle rotation
    ringRef.current.rotation.z = t * 0.5

    // Scale based on engagement
    const scale = 1 - constriction * engageProgress
    ringRef.current.scale.set(scale, scale, 1)
    glowRef.current.scale.set(scale * 1.5, scale * 1.5, 1)

    // Opacity based on engagement
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial
    const glowMat = glowRef.current.material as THREE.MeshBasicMaterial

    ringMat.opacity = 0.3 + engageProgress * 0.5
    glowMat.opacity = 0.1 + engageProgress * 0.3

    // Pulse when engaged
    if (isEngaged) {
      const pulse = 1 + Math.sin(t * 6) * 0.1
      ringRef.current.scale.multiplyScalar(pulse)
    }
  })

  return (
    <group position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {/* Outer ring - wireframe */}
      <mesh ref={glowRef}>
        <torusGeometry args={[0.5, 0.08, 6, 24]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>

      {/* Main ring - wireframe */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.4, 0.03, 6, 24]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </group>
  )
}

export function BandhaRings() {
  const { getTransportSeconds } = useAudio()
  const mapMode = useViewStore((s) => s.mapMode)

  // Smooth engagement values (0-1)
  const mulaEngageRef = useRef(0)
  const uddiyanEngageRef = useRef(0)
  const jalandharaEngageRef = useRef(0)

  // Current bandha state for rendering
  const bandhaStateRef = useRef<BandhaState>({
    mula: false,
    uddiyana: false,
    jalandhara: false,
  })

  // Only show in KUNDALINI mode
  if (mapMode !== 'KUNDALINI') return null

  useFrame(() => {
    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)

    // Update bandha state
    bandhaStateRef.current = breathState.bandhas

    // Smooth transitions (lerp toward target)
    const lerpSpeed = 0.1
    mulaEngageRef.current += (breathState.bandhas.mula ? 1 : 0 - mulaEngageRef.current) * lerpSpeed
    uddiyanEngageRef.current += (breathState.bandhas.uddiyana ? 1 : 0 - uddiyanEngageRef.current) * lerpSpeed
    jalandharaEngageRef.current += (breathState.bandhas.jalandhara ? 1 : 0 - jalandharaEngageRef.current) * lerpSpeed
  })

  return (
    <group>
      {/* Mula Bandha - Root lock (red/orange) */}
      <BandhaRing
        y={-3}
        label="Mula"
        color="#ff4400"
        isEngaged={bandhaStateRef.current.mula}
        engageProgress={mulaEngageRef.current}
      />

      {/* Uddiyana Bandha - Abdominal lock (yellow/gold) */}
      <BandhaRing
        y={-1}
        label="Uddiyana"
        color="#ffaa00"
        isEngaged={bandhaStateRef.current.uddiyana}
        engageProgress={uddiyanEngageRef.current}
      />

      {/* Jalandhara Bandha - Throat lock (cyan/blue) */}
      <BandhaRing
        y={1.5}
        label="Jalandhara"
        color="#00aaff"
        isEngaged={bandhaStateRef.current.jalandhara}
        engageProgress={jalandharaEngageRef.current}
      />
    </group>
  )
}
