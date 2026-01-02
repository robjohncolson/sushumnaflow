import { useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { PranaParticles } from './PranaParticles'
import { KundaliniLayer } from './KundaliniLayer'
import { OrbitLayer } from './OrbitLayer'
import { KundaliniOrb } from './KundaliniOrb'
import { NadiShodhana } from './NadiShodhana'
import { BandhaRings } from './BandhaRings'
import { ProgressiveGrid } from './ProgressiveGrid'
import { disposeScene } from '../three/ResourceTracker'
import { useVisualStore, useBreathStore, useViewStore } from '../stores'

/**
 * Handle WebGL context loss/restore per PHASE2B_RESEARCH.md
 */
function ContextHandler() {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handleLost = (e: Event) => {
      e.preventDefault()
      console.warn('WebGL context lost')
    }

    const handleRestored = () => {
      console.log('WebGL context restored')
    }

    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [gl])

  return null
}

/**
 * Post-processing effects - disabled for wireframe style
 */
function AdaptiveEffects() {
  // Bloom disabled for clean wireframe aesthetic
  return null
}

/**
 * The Cyber Void scene content
 */
function Scene() {
  const sceneRef = useRef<THREE.Scene>(null)
  const { setQuality } = useVisualStore()
  const isRunning = useBreathStore((s) => s.isRunning)
  const mapMode = useViewStore((s) => s.mapMode)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sceneRef.current) {
        disposeScene(sceneRef.current)
      }
    }
  }, [])

  return (
    <>
      <ContextHandler />

      {/* Black void background */}
      <color attach="background" args={['#000000']} />

      {/* Black fog for depth fade */}
      <fog attach="fog" args={['#000000', 15, 60]} />

      {/* Performance monitoring */}
      <PerformanceMonitor
        onDecline={() => setQuality('low')}
        onIncline={() => setQuality('high')}
      />

      {/* Ambient light for glass material */}
      <ambientLight intensity={0.2} />

      {/* Progressive neon grid - shifts hue over time */}
      <ProgressiveGrid />

      {/* Kundalini Layer - visible only in KUNDALINI mode */}
      <group visible={mapMode === 'KUNDALINI'}>
        <KundaliniLayer />
        {/* Bandha lock indicators */}
        {isRunning && <BandhaRings />}
        {/* Single Kundalini orb rising through Sushumna */}
        {isRunning && <KundaliniOrb />}
        {/* Nadi Shodhana alternate nostril indicators */}
        {isRunning && <NadiShodhana />}
      </group>

      {/* Orbit Layer - visible only in ORBIT mode */}
      <group visible={mapMode === 'ORBIT'}>
        <OrbitLayer />
        {/* Prana particles for ORBIT mode (microcosmic orbit path) */}
        {isRunning && <PranaParticles />}
      </group>

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={25}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.5}
      />

      {/* Adaptive bloom post-processing */}
      <AdaptiveEffects />

      <AdaptiveDpr pixelated />
    </>
  )
}

/**
 * Main CyberVoid canvas component
 */
export function CyberVoid() {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        camera={{
          position: [0, 5, 15],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
