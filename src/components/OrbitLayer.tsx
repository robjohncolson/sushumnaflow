import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useViewStore } from '../stores'
import { getDantianEntries, type CodexEntry } from '../codex'
import { ResourceTracker } from '../three/ResourceTracker'
import { useAudio } from '../audio'

/**
 * OrbitLayer - Renders the Taoist Microcosmic Orbit
 *
 * - Du Mai (Governor Vessel) - back ascent
 * - Ren Mai (Conception Vessel) - front descent
 * - 3 Dantian nodes with hover interaction support
 */

interface DantianNodeProps {
  entry: CodexEntry
  learnMode: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onPreviewTone: (freqHz: number) => void
}

/**
 * Individual Dantian Node with hover/click support
 */
function DantianNode({ entry, learnMode, onHover, onSelect, onPreviewTone }: DantianNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)

  // Parse color (no HDR boost for wireframe style)
  const color = useMemo(() => new THREE.Color(entry.color), [entry.color])

  // Animation
  useFrame(({ clock }) => {
    if (!meshRef.current || !outerRef.current) return
    const t = clock.getElapsedTime()

    // Breathing pulse
    const pulse = 1 + Math.sin(t * 1.5 + entry.anchor.y) * 0.15
    meshRef.current.scale.setScalar(pulse)

    // Outer sphere rotation
    outerRef.current.rotation.y = t * 0.3
    outerRef.current.rotation.x = t * 0.2
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

  // Dantians are slightly larger than chakras
  const size = entry.id === 'lowerDantian' ? 0.25 : 0.2

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
        <icosahedronGeometry args={[size, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          wireframe
        />
      </mesh>

      {/* Outer wireframe sphere */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[size * 1.5, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          wireframe
        />
      </mesh>
    </group>
  )
}

/**
 * Du Mai (Governor Vessel) - Back ascent path
 * Runs up the spine from perineum to crown
 */
function DuMai() {
  const trackerRef = useRef(new ResourceTracker())

  const lineObject = useMemo(() => {
    // Create curve along the back
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -3, -0.3), // Base
      new THREE.Vector3(0, -2, -0.35), // Lower back
      new THREE.Vector3(0, -1, -0.35), // Mid back
      new THREE.Vector3(0, 0, -0.35), // Heart level
      new THREE.Vector3(0, 1, -0.3), // Upper back
      new THREE.Vector3(0, 2, -0.25), // Neck
      new THREE.Vector3(0, 2.8, -0.1), // Back of head
      new THREE.Vector3(0, 3.2, 0.1), // Crown
    ])

    const curvePoints = curve.getPoints(50)
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints)
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.5, 0.8, 0.3), // Golden yang
      transparent: true,
      opacity: 0.5,
    })

    trackerRef.current.track(geometry)
    trackerRef.current.track(material)

    return new THREE.Line(geometry, material)
  }, [])

  useEffect(() => {
    return () => {
      trackerRef.current.dispose()
    }
  }, [])

  return <primitive object={lineObject} />
}

/**
 * Ren Mai (Conception Vessel) - Front descent path
 * Runs down the front from crown to perineum
 */
function RenMai() {
  const trackerRef = useRef(new ResourceTracker())

  const lineObject = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.2, 0.1), // Crown
      new THREE.Vector3(0, 2.8, 0.25), // Forehead
      new THREE.Vector3(0, 2, 0.35), // Face
      new THREE.Vector3(0, 1, 0.35), // Throat
      new THREE.Vector3(0, 0, 0.4), // Heart/chest
      new THREE.Vector3(0, -1, 0.4), // Solar plexus
      new THREE.Vector3(0, -2, 0.35), // Navel
      new THREE.Vector3(0, -3, 0.1), // Return to base
    ])

    const curvePoints = curve.getPoints(50)
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints)
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.3, 0.8, 1.5), // Silver yin
      transparent: true,
      opacity: 0.5,
    })

    trackerRef.current.track(geometry)
    trackerRef.current.track(material)

    return new THREE.Line(geometry, material)
  }, [])

  useEffect(() => {
    return () => {
      trackerRef.current.dispose()
    }
  }, [])

  return <primitive object={lineObject} />
}

/**
 * Connection lines between dantians
 */
function DantianConnections() {
  const trackerRef = useRef(new ResourceTracker())

  const lineObject = useMemo(() => {
    const points = [
      new THREE.Vector3(0, -2, 0.25), // Lower dantian
      new THREE.Vector3(0, 0, 0.25), // Middle dantian
      new THREE.Vector3(0, 2, 0.2), // Upper dantian
    ]

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.5, 1.5, 0.8), // Jade green
      transparent: true,
      opacity: 0.4,
    })

    trackerRef.current.track(geometry)
    trackerRef.current.track(material)

    return new THREE.Line(geometry, material)
  }, [])

  useEffect(() => {
    return () => {
      trackerRef.current.dispose()
    }
  }, [])

  return <primitive object={lineObject} />
}

/**
 * OrbitLayer - Main export
 */
export function OrbitLayer() {
  const learnMode = useViewStore((s) => s.learnMode)
  const setHoveredId = useViewStore((s) => s.setHoveredId)
  const setSelectedId = useViewStore((s) => s.setSelectedId)
  const { previewTone } = useAudio()

  const dantianEntries = useMemo(() => getDantianEntries(), [])

  return (
    <group>
      {/* Microcosmic orbit paths */}
      <DuMai />
      <RenMai />

      {/* Connection between dantians */}
      <DantianConnections />

      {/* 3 Dantian nodes */}
      {dantianEntries.map((entry) => (
        <DantianNode
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
