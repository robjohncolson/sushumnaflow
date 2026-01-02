import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBreathStore, useViewStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState, BreathPhase } from '../engines/breathEngine'

/**
 * NadiShodhana - Alternate Nostril Breathing Visualization
 *
 * Shows prana flowing through Ida (left/lunar) and Pingala (right/solar) nadis
 * alternating with each breath cycle.
 *
 * Pattern:
 * - Cycle 1: Inhale left (Ida), exhale right (Pingala)
 * - Cycle 2: Inhale right (Pingala), exhale left (Ida)
 * - Repeat...
 */

// Nostril positions (at top of spine near third eye)
const LEFT_NOSTRIL = new THREE.Vector3(-0.15, 2.5, 0.3)
const RIGHT_NOSTRIL = new THREE.Vector3(0.15, 2.5, 0.3)

// Colors
const IDA_COLOR = new THREE.Color('#4488aa') // Lunar/cooling (left)
const PINGALA_COLOR = new THREE.Color('#cc6644') // Solar/heating (right)

/**
 * Single nostril indicator
 */
function NostrilIndicator({
  position,
  color,
  isActive,
  isInhaling,
}: {
  position: THREE.Vector3
  color: THREE.Color
  isActive: boolean
  isInhaling: boolean
}) {
  const ringRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ringRef.current || !coreRef.current) return

    const t = clock.getElapsedTime()

    // Pulse when active
    if (isActive) {
      const pulse = 1 + Math.sin(t * 4) * 0.2
      ringRef.current.scale.setScalar(pulse)

      // Rotation indicates flow direction
      const direction = isInhaling ? 1 : -1
      ringRef.current.rotation.z += direction * 0.05
    } else {
      ringRef.current.scale.setScalar(0.7)
    }

    // Update opacity
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial
    const coreMat = coreRef.current.material as THREE.MeshBasicMaterial
    ringMat.opacity = isActive ? 0.7 : 0.2
    coreMat.opacity = isActive ? 0.5 : 0.1
  })

  return (
    <group position={position}>
      {/* Core point */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} wireframe />
      </mesh>

      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.015, 6, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
      </mesh>
    </group>
  )
}

/**
 * Prana flow particle along a nadi
 */
function PranaFlow({
  startPos,
  endPos,
  color,
  isActive,
  progress,
  isInhaling,
}: {
  startPos: THREE.Vector3
  endPos: THREE.Vector3
  color: THREE.Color
  isActive: boolean
  progress: number
  isInhaling: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Create curve for the flow
  const curve = useMemo(() => {
    const midY = (startPos.y + endPos.y) / 2
    const midX = startPos.x * 0.8 // Curve slightly toward center
    return new THREE.CatmullRomCurve3([
      startPos.clone(),
      new THREE.Vector3(midX, midY, startPos.z * 0.7),
      endPos.clone(),
    ])
  }, [startPos, endPos])

  useFrame(() => {
    if (!meshRef.current || !isActive) {
      if (meshRef.current) {
        meshRef.current.visible = false
      }
      return
    }

    meshRef.current.visible = true

    // Position along curve based on progress
    const t = isInhaling ? 1 - progress : progress
    const pos = curve.getPointAt(Math.max(0, Math.min(1, t)))
    meshRef.current.position.copy(pos)

    // Scale based on activity
    const scale = 0.8 + Math.sin(progress * Math.PI) * 0.4
    meshRef.current.scale.setScalar(scale)
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.04, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} wireframe />
    </mesh>
  )
}

/**
 * Main NadiShodhana component
 */
export function NadiShodhana() {
  const { getTransportSeconds } = useAudio()
  const mapMode = useViewStore((s) => s.mapMode)

  // Track which cycle we're on (alternates left/right start)
  const cycleCountRef = useRef(0)
  const lastCycleProgressRef = useRef(0)

  // Current state for rendering
  const stateRef = useRef({
    leftActive: false,
    rightActive: false,
    isInhaling: true,
    progress: 0,
  })

  // Only show in KUNDALINI mode
  if (mapMode !== 'KUNDALINI') return null

  useFrame(() => {
    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)
    const { phase, progress, cycleProgress } = breathState

    // Detect new cycle
    if (cycleProgress < lastCycleProgressRef.current - 0.5) {
      cycleCountRef.current++
    }
    lastCycleProgressRef.current = cycleProgress

    // Determine which nostril is active based on cycle and phase
    const isOddCycle = cycleCountRef.current % 2 === 0
    const isInhaling = phase === BreathPhase.INHALE
    const isExhaling = phase === BreathPhase.EXHALE
    const isHolding = phase === BreathPhase.HOLD_IN || phase === BreathPhase.HOLD_OUT

    // During holds, both nostrils are sealed
    if (isHolding) {
      stateRef.current = {
        leftActive: false,
        rightActive: false,
        isInhaling: false,
        progress,
      }
    } else if (isInhaling) {
      // Inhale through one nostril
      stateRef.current = {
        leftActive: isOddCycle, // Odd cycles: left first
        rightActive: !isOddCycle, // Even cycles: right first
        isInhaling: true,
        progress,
      }
    } else if (isExhaling) {
      // Exhale through opposite nostril
      stateRef.current = {
        leftActive: !isOddCycle, // Opposite of inhale
        rightActive: isOddCycle,
        isInhaling: false,
        progress,
      }
    }
  })

  // End points for prana flow
  const rootPos = new THREE.Vector3(0, -3, 0)

  return (
    <group>
      {/* Left nostril (Ida) */}
      <NostrilIndicator
        position={LEFT_NOSTRIL}
        color={IDA_COLOR}
        isActive={stateRef.current.leftActive}
        isInhaling={stateRef.current.isInhaling}
      />

      {/* Right nostril (Pingala) */}
      <NostrilIndicator
        position={RIGHT_NOSTRIL}
        color={PINGALA_COLOR}
        isActive={stateRef.current.rightActive}
        isInhaling={stateRef.current.isInhaling}
      />

      {/* Prana flow through Ida (left) */}
      <PranaFlow
        startPos={LEFT_NOSTRIL}
        endPos={rootPos}
        color={IDA_COLOR}
        isActive={stateRef.current.leftActive}
        progress={stateRef.current.progress}
        isInhaling={stateRef.current.isInhaling}
      />

      {/* Prana flow through Pingala (right) */}
      <PranaFlow
        startPos={RIGHT_NOSTRIL}
        endPos={rootPos}
        color={PINGALA_COLOR}
        isActive={stateRef.current.rightActive}
        progress={stateRef.current.progress}
        isInhaling={stateRef.current.isInhaling}
      />
    </group>
  )
}
