import { useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { PranaParticles } from './PranaParticles'
import { ChakraSpine } from './ChakraSpine'
import { disposeScene } from '../three/ResourceTracker'
import { useVisualStore, useBreathStore } from '../stores'

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
 * Adaptive bloom effects based on performance
 */
function AdaptiveEffects() {
  const { bloomEnabled } = useVisualStore()
  const { performance } = useThree((state) => ({ performance: state.performance }))

  if (!bloomEnabled || performance.current < 0.5) return null

  return (
    <EffectComposer multisampling={performance.current >= 0.8 ? 4 : 0}>
      <Bloom
        intensity={performance.current >= 0.8 ? 1.5 : 0.8}
        luminanceThreshold={1}
        luminanceSmoothing={0.025}
        mipmapBlur={true}
        kernelSize={
          performance.current >= 0.8 ? KernelSize.MEDIUM : KernelSize.SMALL
        }
      />
    </EffectComposer>
  )
}

/**
 * The Cyber Void scene content
 */
function Scene() {
  const sceneRef = useRef<THREE.Scene>(null)
  const { setQuality } = useVisualStore()
  const isRunning = useBreathStore((s) => s.isRunning)

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

      {/* Infinite neon grid */}
      <Grid
        infiniteGrid
        cellSize={1}
        cellThickness={0.3}
        cellColor="#003322"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#00ff88"
        fadeDistance={50}
        fadeStrength={1.5}
        position={[0, -3, 0]}
      />

      {/* Chakra spine visualization */}
      <ChakraSpine />

      {/* Prana particles - only animate when running */}
      {isRunning && <PranaParticles />}

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
