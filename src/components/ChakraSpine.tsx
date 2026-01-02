import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBreathStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState } from '../engines/breathEngine'

// Chakra data
const CHAKRAS = [
  { y: -2.5, color: '#ff0000', name: 'Root' },
  { y: -1.5, color: '#ff7700', name: 'Sacral' },
  { y: -0.5, color: '#ffff00', name: 'Solar' },
  { y: 0.5, color: '#00ff00', name: 'Heart' },
  { y: 1.5, color: '#00ffff', name: 'Throat' },
  { y: 2.5, color: '#4444ff', name: 'Third Eye' },
  { y: 3.5, color: '#ff00ff', name: 'Crown' },
]

/**
 * Individual chakra visualization
 */
function Chakra({
  y,
  color,
  index,
  lumens,
}: {
  y: number
  color: string
  index: number
  lumens: number
}) {
  const ringRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  // Activation based on lumens (higher chakras need more energy)
  const activationThreshold = index * 0.7
  const activation = Math.max(0, Math.min(1, (lumens - activationThreshold) / 2))

  // Pre-compute HDR color
  const hdrColor = useMemo(() => {
    const c = new THREE.Color(color)
    return [c.r * 2, c.g * 2, c.b * 2] as [number, number, number]
  }, [color])

  useFrame(({ clock }) => {
    if (!ringRef.current || !coreRef.current) return

    const time = clock.getElapsedTime()

    // Rotate ring
    ringRef.current.rotation.z = time * 0.5 + index * 0.5
    ringRef.current.rotation.x = Math.sin(time * 0.3 + index) * 0.2

    // Pulse core based on activation
    const pulse = 1 + Math.sin(time * 3 + index) * 0.15 * activation
    coreRef.current.scale.setScalar(0.1 + activation * 0.15 * pulse)

    // Update opacity based on activation
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial
    const coreMat = coreRef.current.material as THREE.MeshBasicMaterial
    ringMat.opacity = 0.2 + activation * 0.6
    coreMat.opacity = 0.3 + activation * 0.7
  })

  return (
    <group position={[0, y, 0]}>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.4 + activation * 0.2, 0.02, 8, 32]} />
        <meshBasicMaterial
          color={hdrColor}
          toneMapped={false}
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>

      {/* Inner core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.15, 1]} />
        <meshBasicMaterial
          color={hdrColor}
          toneMapped={false}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  )
}

/**
 * Spine connecting all chakras
 */
function SpineLine({ lumens }: { lumens: number }) {
  const lineRef = useRef<THREE.Line>(null)

  // Create line object imperatively to avoid JSX <line> SVG conflict
  const lineObject = useMemo(() => {
    const points = CHAKRAS.map((c) => new THREE.Vector3(0, c.y, 0))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0, 1.4, 1.4),
      transparent: true,
      opacity: 0.4,
    })
    return new THREE.Line(geometry, material)
  }, [])

  useFrame(() => {
    const mat = lineObject.material as THREE.LineBasicMaterial
    mat.color.setRGB(0, 1 + lumens * 0.4, 1 + lumens * 0.4)
    mat.opacity = 0.3 + lumens * 0.1
  })

  return <primitive ref={lineRef} object={lineObject} />
}

/**
 * ChakraSpine - Visualization of the seven chakras along the sushumna
 */
export function ChakraSpine() {
  const { bpm, ratios, isRunning } = useBreathStore()
  const { getTransportSeconds } = useAudio()
  const lumensRef = useRef(0)

  useFrame(() => {
    if (isRunning) {
      const time = getTransportSeconds()
      const breathState = calculateBreathState(time, bpm, ratios)
      lumensRef.current = breathState.lumens
    } else {
      // Fade to base state when stopped
      lumensRef.current = lumensRef.current * 0.95
    }
  })

  return (
    <group>
      {/* Spine line */}
      <SpineLine lumens={lumensRef.current} />

      {/* Individual chakras */}
      {CHAKRAS.map((chakra, index) => (
        <Chakra
          key={chakra.name}
          y={chakra.y}
          color={chakra.color}
          index={index}
          lumens={lumensRef.current}
        />
      ))}
    </group>
  )
}
