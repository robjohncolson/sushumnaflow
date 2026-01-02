import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useViewStore, useBreathStore } from '../stores'
import { getChakraEntries, type CodexEntry } from '../codex'
import { ResourceTracker } from '../three/ResourceTracker'
import { useAudio } from '../audio'
import { calculateBreathState, BreathPhase } from '../engines/breathEngine'

/**
 * KundaliniLayer - Renders the 7 chakra system with nadis
 *
 * - Sushumna (central channel)
 * - Ida and Pingala (side channels - gentle helix, not strict caduceus)
 * - 7 Chakra nodes with hover interaction support
 */


interface ChakraNodeProps {
  entry: CodexEntry
  learnMode: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onPreviewTone: (freqHz: number) => void
}

/**
 * Individual Chakra Node with hover/click support
 * Responds to Kundalini orb proximity by expanding
 */
function ChakraNode({ entry, learnMode, onHover, onSelect, onPreviewTone }: ChakraNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const { getTransportSeconds } = useAudio()

  // Parse color (no HDR boost for wireframe style)
  const color = useMemo(() => new THREE.Color(entry.color), [entry.color])

  // Track proximity activation for smooth transitions
  const proximityRef = useRef(0)

  // Animation with Kundalini proximity response
  useFrame(({ clock }) => {
    if (!meshRef.current || !ringRef.current) return
    const t = clock.getElapsedTime()

    // Get Kundalini position
    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)
    const kundaliniY = breathState.kundalini.y

    // Calculate proximity (0 to 1 based on distance)
    const distance = Math.abs(kundaliniY - entry.anchor.y)
    const proximityRadius = 1.0 // How close Kundalini needs to be
    const targetProximity = Math.max(0, 1 - distance / proximityRadius)

    // Smooth transition
    proximityRef.current += (targetProximity - proximityRef.current) * 0.15
    const proximity = proximityRef.current

    // Base pulse + proximity expansion
    const basePulse = 1 + Math.sin(t * 2 + entry.anchor.y) * 0.1
    const proximityScale = 1 + proximity * 0.8 // Expand up to 80% when Kundalini passes
    const finalScale = basePulse * proximityScale

    meshRef.current.scale.setScalar(finalScale)

    // Ring expands and spins faster with proximity
    const ringScale = 1 + proximity * 0.5
    ringRef.current.scale.setScalar(ringScale)
    ringRef.current.rotation.z = t * (0.5 + proximity * 2)
    ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.2

    // Opacity boost with proximity (wireframe style)
    const meshMat = meshRef.current.material as THREE.MeshBasicMaterial
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial

    meshMat.opacity = 0.6 + proximity * 0.4
    ringMat.opacity = 0.4 + proximity * 0.4
  })

  const handlePointerOver = () => {
    if (learnMode) {
      onHover(entry.id)
      onPreviewTone(entry.frequencyHz)
    }
  }

  const handlePointerOut = () => {
    if (learnMode) onHover(null)
  }

  const handleClick = () => {
    if (learnMode) onSelect(entry.id)
  }

  return (
    <group
      position={[entry.anchor.x, entry.anchor.y, entry.anchor.z]}
      userData={{ codexId: entry.id }}
    >
      {/* Core sphere - wireframe */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <icosahedronGeometry args={[0.15, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          wireframe
        />
      </mesh>

      {/* Outer ring - wireframe */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.25, 0.02, 8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </group>
  )
}

/**
 * Sushumna - Central channel (straight line)
 */
function Sushumna() {
  const lineRef = useRef<THREE.Line>(null)

  const lineObject = useMemo(() => {
    const points = [new THREE.Vector3(0, -3.5, 0), new THREE.Vector3(0, 3.5, 0)]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0, 1.5, 1.5),
      transparent: true,
      opacity: 0.6,
    })
    return new THREE.Line(geometry, material)
  }, [])

  return <primitive ref={lineRef} object={lineObject} />
}

// Nadi curve helper - generates points for Ida or Pingala
function generateNadiCurve(isIda: boolean): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  const segments = 50
  const amplitude = 0.3
  const frequency = 1.5

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const y = -3 + t * 6

    const angle = t * Math.PI * 2 * frequency
    const xOffset = isIda ? -0.05 : 0.05
    const x = (isIda ? -1 : 1) * Math.abs(Math.sin(angle)) * amplitude + xOffset
    const z = (isIda ? 1 : -1) * Math.cos(angle) * amplitude * 0.3

    points.push(new THREE.Vector3(x, y, z))
  }

  return new THREE.CatmullRomCurve3(points)
}

// Prana orb that travels along a nadi
function PranaOrb({
  curve,
  color,
  isIda,
  cycleCountRef,
}: {
  curve: THREE.CatmullRomCurve3
  color: THREE.Color
  isIda: boolean
  cycleCountRef: React.MutableRefObject<number>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.Points>(null)
  const { getTransportSeconds } = useAudio()

  // Trail positions - more points for smoother trail
  const trailPositions = useRef<Float32Array>(new Float32Array(15 * 3))

  useFrame(() => {
    if (!meshRef.current) return

    // Read fresh breath state every frame
    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)
    const { phase, progress } = breathState

    const isOddCycle = cycleCountRef.current % 2 === 0
    const isInhaling = phase === BreathPhase.INHALE
    const isExhaling = phase === BreathPhase.EXHALE

    // Determine if this nadi is active
    let isActive = false
    let isDescending = true

    if (isInhaling) {
      isActive = isIda ? isOddCycle : !isOddCycle
      isDescending = true
    } else if (isExhaling) {
      isActive = isIda ? !isOddCycle : isOddCycle
      isDescending = false
    }

    if (!isActive) {
      meshRef.current.visible = false
      if (trailRef.current) trailRef.current.visible = false
      return
    }

    meshRef.current.visible = true
    if (trailRef.current) trailRef.current.visible = true

    // Calculate position on curve (0 = bottom, 1 = top)
    // Descending (inhale): start at top (1), move to bottom (0)
    // Ascending (exhale): start at bottom (0), move to top (1)
    const t = isDescending ? 1 - progress : progress
    const pos = curve.getPointAt(Math.max(0.001, Math.min(0.999, t)))

    meshRef.current.position.copy(pos)

    // Gentle pulse
    const pulse = 1 + Math.sin(time * 6) * 0.2
    meshRef.current.scale.setScalar(pulse)

    // Update trail
    if (trailRef.current) {
      const positions = trailPositions.current
      const trailLength = 15

      // Shift existing positions
      for (let i = trailLength - 1; i > 0; i--) {
        positions[i * 3] = positions[(i - 1) * 3]
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1]
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2]
      }

      // Add current position
      positions[0] = pos.x
      positions[1] = pos.y
      positions[2] = pos.z

      const geom = trailRef.current.geometry as THREE.BufferGeometry
      geom.attributes.position.needsUpdate = true
    }
  })

  // Trail geometry
  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(trailPositions.current, 3))
    return geom
  }, [])

  return (
    <group>
      {/* Main prana orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.08, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          wireframe
        />
      </mesh>

      {/* Trail */}
      <points ref={trailRef}>
        <primitive object={trailGeometry} attach="geometry" />
        <pointsMaterial
          color={color}
          size={0.05}
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

/**
 * Ida and Pingala - Side channels (gentle helix)
 *
 * Animated based on Nadi Shodhana breath pattern:
 * - Ida (left) = lunar/cooling = blue - active during left nostril breathing
 * - Pingala (right) = solar/heating = orange - active during right nostril breathing
 *
 * Flow direction:
 * - Inhale: prana flows DOWN from nostril to root
 * - Exhale: prana flows UP from root to nostril
 */
function NadiChannels() {
  const trackerRef = useRef(new ResourceTracker())
  const idaRef = useRef<THREE.Line>(null)
  const pingalaRef = useRef<THREE.Line>(null)
  const { getTransportSeconds } = useAudio()

  // Track cycle for alternating nostrils
  const cycleCountRef = useRef(0)
  const lastCycleProgressRef = useRef(0)


  // Create curves for prana orbs to follow
  const idaCurve = useMemo(() => generateNadiCurve(true), [])
  const pingalaCurve = useMemo(() => generateNadiCurve(false), [])

  const idaColor = useMemo(() => new THREE.Color('#4488aa'), [])
  const pingalaColor = useMemo(() => new THREE.Color('#cc6644'), [])

  const { idaLine, pingalaLine } = useMemo(() => {
    const idaPts = idaCurve.getPoints(100)
    const pingalaPts = pingalaCurve.getPoints(100)

    const idaGeometry = new THREE.BufferGeometry().setFromPoints(idaPts)
    const pingalaGeometry = new THREE.BufferGeometry().setFromPoints(pingalaPts)

    // Ida = left = lunar = blue/silver
    const idaMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#4488aa'),
      transparent: true,
      opacity: 0.3,
    })

    // Pingala = right = solar = orange/gold
    const pingalaMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#cc6644'),
      transparent: true,
      opacity: 0.3,
    })

    trackerRef.current.track(idaGeometry)
    trackerRef.current.track(pingalaGeometry)
    trackerRef.current.track(idaMaterial)
    trackerRef.current.track(pingalaMaterial)

    return {
      idaLine: new THREE.Line(idaGeometry, idaMaterial),
      pingalaLine: new THREE.Line(pingalaGeometry, pingalaMaterial),
    }
  }, [idaCurve, pingalaCurve])

  // Animate nadis based on breath
  useFrame(({ clock }) => {
    if (!idaRef.current || !pingalaRef.current) return

    const { bpm, ratios } = useBreathStore.getState()
    const time = getTransportSeconds()
    const breathState = calculateBreathState(time, bpm, ratios)
    const { phase, cycleProgress } = breathState

    // Detect new cycle for alternating pattern
    if (cycleProgress < lastCycleProgressRef.current - 0.5) {
      cycleCountRef.current++
    }
    lastCycleProgressRef.current = cycleProgress

    const isOddCycle = cycleCountRef.current % 2 === 0
    const isInhaling = phase === BreathPhase.INHALE
    const isExhaling = phase === BreathPhase.EXHALE
    const isHolding = phase === BreathPhase.HOLD_IN || phase === BreathPhase.HOLD_OUT

    // Determine which nadi is active
    let idaActive = false
    let pingalaActive = false

    if (isInhaling) {
      idaActive = isOddCycle
      pingalaActive = !isOddCycle
    } else if (isExhaling) {
      idaActive = !isOddCycle
      pingalaActive = isOddCycle
    }

    const idaMat = idaRef.current.material as THREE.LineBasicMaterial
    const pingalaMat = pingalaRef.current.material as THREE.LineBasicMaterial

    // Base opacity when inactive
    const baseOpacity = 0.2
    const activeOpacity = 0.5

    if (isHolding) {
      // During holds, both dim but pulse gently
      const holdPulse = 0.25 + Math.sin(clock.getElapsedTime() * 3) * 0.1
      idaMat.opacity = holdPulse
      pingalaMat.opacity = holdPulse
    } else {
      idaMat.opacity = idaActive ? activeOpacity : baseOpacity
      pingalaMat.opacity = pingalaActive ? activeOpacity : baseOpacity
    }
  })

  useEffect(() => {
    return () => {
      trackerRef.current.dispose()
    }
  }, [])

  return (
    <group>
      <primitive ref={idaRef} object={idaLine} />
      <primitive ref={pingalaRef} object={pingalaLine} />

      {/* Prana orb traveling along Ida */}
      <PranaOrb
        curve={idaCurve}
        color={idaColor}
        isIda={true}
        cycleCountRef={cycleCountRef}
      />

      {/* Prana orb traveling along Pingala */}
      <PranaOrb
        curve={pingalaCurve}
        color={pingalaColor}
        isIda={false}
        cycleCountRef={cycleCountRef}
      />
    </group>
  )
}

/**
 * KundaliniLayer - Main export
 */
export function KundaliniLayer() {
  const learnMode = useViewStore((s) => s.learnMode)
  const setHoveredId = useViewStore((s) => s.setHoveredId)
  const setSelectedId = useViewStore((s) => s.setSelectedId)
  const { previewTone } = useAudio()

  const chakraEntries = useMemo(() => getChakraEntries(), [])

  return (
    <group>
      {/* Central channel */}
      <Sushumna />

      {/* Side channels */}
      <NadiChannels />

      {/* 7 Chakra nodes */}
      {chakraEntries.map((entry) => (
        <ChakraNode
          key={entry.id}
          entry={entry}
          learnMode={learnMode}
          onHover={setHoveredId}
          onSelect={setSelectedId}
          onPreviewTone={previewTone}
        />
      ))}
    </group>
  )
}
