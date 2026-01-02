import { useRef, useMemo } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'
import { useBreathStore } from '../stores'
import { useAudio } from '../audio'

/**
 * ProgressiveGrid - A grid that slowly shifts hue over time
 *
 * Uses custom shader for smooth, continuous color evolution.
 * Creates a sense of progression rather than static looping.
 */

// Custom grid shader material
const ProgressiveGridMaterial = shaderMaterial(
  {
    uTime: 0,
    uHueShift: 0,
    uLumens: 0,
    uFadeDistance: 50,
    uCellSize: 1,
    uSectionSize: 5,
  },
  // Vertex shader
  `
    varying vec2 vWorldPos;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  // Fragment shader
  `
    uniform float uTime;
    uniform float uHueShift;
    uniform float uLumens;
    uniform float uFadeDistance;
    uniform float uCellSize;
    uniform float uSectionSize;

    varying vec2 vWorldPos;

    // HSL to RGB conversion
    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x;
      float s = hsl.y;
      float l = hsl.z;

      float c = (1.0 - abs(2.0 * l - 1.0)) * s;
      float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
      float m = l - c / 2.0;

      vec3 rgb;
      if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
      else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
      else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
      else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
      else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
      else rgb = vec3(c, 0.0, x);

      return rgb + m;
    }

    float gridLine(vec2 pos, float size, float thickness) {
      vec2 grid = abs(fract(pos / size - 0.5) - 0.5) / fwidth(pos / size);
      return 1.0 - min(min(grid.x, grid.y), 1.0) * thickness;
    }

    void main() {
      // Distance fade
      float dist = length(vWorldPos);
      float fade = 1.0 - smoothstep(uFadeDistance * 0.3, uFadeDistance, dist);

      // Grid lines
      float cellLine = gridLine(vWorldPos, uCellSize, 0.5);
      float sectionLine = gridLine(vWorldPos, uSectionSize, 0.3);

      // Combine lines
      float line = max(cellLine * 0.3, sectionLine);

      // Progressive hue (green -> cyan -> blue -> purple -> red -> green)
      float hue = fract(0.42 + uHueShift / 360.0); // Start at green (0.42)

      // Brightness modulated by lumens
      float brightness = 0.4 + uLumens * 0.12;

      // Cell color: dark
      vec3 cellColor = hsl2rgb(vec3(hue, 0.5, 0.08));

      // Section color: bright
      vec3 sectionColor = hsl2rgb(vec3(hue, 1.0, brightness));

      // Mix based on line type
      vec3 color = mix(cellColor, sectionColor, sectionLine);
      color = mix(vec3(0.0), color, line);

      // Apply fade
      float alpha = line * fade;

      gl_FragColor = vec4(color, alpha);
    }
  `
)

extend({ ProgressiveGridMaterial })

// TypeScript declaration for the custom material
declare module '@react-three/fiber' {
  interface ThreeElements {
    progressiveGridMaterial: JSX.IntrinsicElements['shaderMaterial'] & {
      uTime?: number
      uHueShift?: number
      uLumens?: number
      uFadeDistance?: number
      uCellSize?: number
      uSectionSize?: number
    }
  }
}

// Hue shift speed (degrees per breath cycle)
const HUE_SHIFT_SPEED = 3

export function ProgressiveGrid() {
  const { getTransportSeconds } = useAudio()
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Track cycle count for hue progression
  const cycleCountRef = useRef(0)
  const lastCycleProgressRef = useRef(0)

  // Create large plane geometry
  const geometry = useMemo(() => new THREE.PlaneGeometry(200, 200), [])

  useFrame(() => {
    if (!materialRef.current) return

    const { bpm } = useBreathStore.getState()
    const time = getTransportSeconds()

    // Calculate cycle progress
    const cycleDuration = 60 / bpm
    const cycleProgress = (time % cycleDuration) / cycleDuration

    // Detect cycle completion
    if (cycleProgress < lastCycleProgressRef.current - 0.5) {
      cycleCountRef.current++
    }
    lastCycleProgressRef.current = cycleProgress

    // Calculate hue shift based on cycles + current progress
    const totalProgress = cycleCountRef.current + cycleProgress
    const hueShift = totalProgress * HUE_SHIFT_SPEED

    // Calculate lumens from breath state (simple sine approximation)
    const lumens = 2.5 + Math.sin(cycleProgress * Math.PI * 2) * 2.5

    // Update uniforms
    materialRef.current.uniforms.uTime.value = time
    materialRef.current.uniforms.uHueShift.value = hueShift
    materialRef.current.uniforms.uLumens.value = lumens
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <primitive object={geometry} attach="geometry" />
      <progressiveGridMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uFadeDistance={50}
        uCellSize={1}
        uSectionSize={5}
      />
    </mesh>
  )
}
