import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useViewStore } from '../stores'
import { getChakraEntries, type CodexEntry } from '../codex'
import { ResourceTracker } from '../three/ResourceTracker'
import { useAudio } from '../audio'

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
 */
function ChakraNode({ entry, learnMode, onHover, onSelect, onPreviewTone }: ChakraNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  // Parse color
  const color = useMemo(() => new THREE.Color(entry.color), [entry.color])
  const hdrColor = useMemo(
    () => [color.r * 2, color.g * 2, color.b * 2] as [number, number, number],
    [color]
  )

  // Animation
  useFrame(({ clock }) => {
    if (!meshRef.current || !ringRef.current) return
    const t = clock.getElapsedTime()

    // Gentle pulsing
    const pulse = 1 + Math.sin(t * 2 + entry.anchor.y) * 0.1
    meshRef.current.scale.setScalar(pulse)

    // Ring rotation
    ringRef.current.rotation.z = t * 0.5
    ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.2
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
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <icosahedronGeometry args={[0.15, 1]} />
        <meshBasicMaterial
          color={hdrColor}
          toneMapped={false}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Outer ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.25, 0.02, 8, 32]} />
        <meshBasicMaterial
          color={hdrColor}
          toneMapped={false}
          transparent
          opacity={0.5}
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

/**
 * Ida and Pingala - Side channels (gentle helix)
 *
 * NOTE: This is a "gentle wrap / parallel helix" that reads clearly
 * but doesn't claim strict canonical caduceus crossings at each chakra.
 */
function NadiChannels() {
  const trackerRef = useRef(new ResourceTracker())

  const { idaLine, pingalaLine } = useMemo(() => {
    const idaPoints: THREE.Vector3[] = []
    const pingalaPoints: THREE.Vector3[] = []

    // Create gentle helix from bottom to top
    const segments = 100
    const amplitude = 0.3 // How far from center
    const frequency = 1.5 // Number of wraps

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const y = -3 + t * 6 // From y=-3 to y=+3

      // Gentle sinusoidal wrap
      const angle = t * Math.PI * 2 * frequency
      const xIda = Math.sin(angle) * amplitude
      const zIda = Math.cos(angle) * amplitude * 0.3
      const xPingala = -Math.sin(angle) * amplitude
      const zPingala = -Math.cos(angle) * amplitude * 0.3

      idaPoints.push(new THREE.Vector3(xIda, y, zIda))
      pingalaPoints.push(new THREE.Vector3(xPingala, y, zPingala))
    }

    const idaGeometry = new THREE.BufferGeometry().setFromPoints(idaPoints)
    const pingalaGeometry = new THREE.BufferGeometry().setFromPoints(pingalaPoints)

    const idaMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.5, 0.5, 0.5), // Red-ish (solar)
      transparent: true,
      opacity: 0.4,
    })

    const pingalaMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.5, 0.5, 1.5), // Blue-ish (lunar)
      transparent: true,
      opacity: 0.4,
    })

    trackerRef.current.track(idaGeometry)
    trackerRef.current.track(pingalaGeometry)
    trackerRef.current.track(idaMaterial)
    trackerRef.current.track(pingalaMaterial)

    return {
      idaLine: new THREE.Line(idaGeometry, idaMaterial),
      pingalaLine: new THREE.Line(pingalaGeometry, pingalaMaterial),
    }
  }, [])

  useEffect(() => {
    return () => {
      trackerRef.current.dispose()
    }
  }, [])

  return (
    <group>
      <primitive object={idaLine} />
      <primitive object={pingalaLine} />
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
