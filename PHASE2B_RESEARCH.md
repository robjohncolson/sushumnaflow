# React Three Fiber for Electron: Building a Cyber Void 3D Renderer

A parallel 3D renderer coexisting with Pixi.js in an Electron desktop application requires careful attention to WebGL context management, performance optimization, and proper resource disposal. This guide provides the complete technical foundation for achieving **30+ FPS with 50+ buildings** using a Tron/Battlezone "cyber void" aesthetic.

## Coexisting with Pixi.js requires prefixed components and visibility toggling

When integrating R3F alongside Pixi.js, a TypeScript collision occurs between `ThreeElements` and `PixiElements` on the `color` property. PixiJS React v8 solves this with prefixed components—use `<pixiSprite />` instead of `<sprite />`. Configure your `global.d.ts`:

```typescript
import { type UnprefixedPixiElements } from '@pixi/react'
declare module '@pixi/react' {
  interface PixiElements extends UnprefixedPixiElements {}
}
```

For runtime switching between renderers, **avoid conditional mounting**—this causes expensive recompilation. Instead, use CSS visibility to hide inactive renderers while preserving state:

```tsx
function DualRenderer({ mode }: { mode: '2d' | '3d' }) {
  return (
    <>
      <PixiStage style={{ display: mode === '2d' ? 'block' : 'none' }} />
      <Canvas style={{ display: mode === '3d' ? 'block' : 'none' }}>
        <Scene3D visible={mode === '3d'} />
      </Canvas>
    </>
  );
}
```

Shared state between renderers works best with Zustand. For performance-critical updates in the render loop, use `getState()` instead of reactive selectors to avoid triggering React re-renders:

```tsx
useFrame(() => {
  // Direct access without re-renders
  ref.current.position.x = useStore.getState().camera.x;
});
```

## WebGL context loss in Electron requires explicit handling

Electron has documented WebGL issues: context loss on minimize, context not restoring after GPU process crash, and problems with dual-GPU switching. Configure your Canvas with defensive settings:

```tsx
<Canvas
  gl={{
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: true,
  }}
  fallback={<FallbackUI />}
/>
```

For the Electron main process, disable domain blocking for 3D APIs and optionally force integrated GPU to avoid switching issues:

```javascript
app.disableDomainBlockingFor3DAPIs();
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// Optional: force low-power GPU for stability
app.commandLine.appendSwitch('force_low_power_gpu');
```

Handle context loss with event listeners that call `event.preventDefault()` to allow restoration:

```tsx
useEffect(() => {
  const canvas = gl.domElement;
  const handleLost = (e: WebGLContextEvent) => {
    e.preventDefault();
    cancelAnimationFrame(animationId);
  };
  const handleRestored = () => reinitializeScene();
  
  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);
  return () => { /* cleanup */ };
}, [gl]);
```

## Memory disposal follows a strict hierarchy for long-running apps

Three.js resources **do not auto-dispose** when removed from the scene. You must explicitly dispose geometries, materials, textures, and render targets. Create a `ResourceTracker` for systematic cleanup:

```typescript
class ResourceTracker {
  resources = new Set<{ dispose: () => void }>();
  
  track<T extends { dispose?: () => void }>(resource: T): T {
    if (resource.dispose) this.resources.add(resource);
    return resource;
  }
  
  dispose() {
    for (const r of this.resources) r.dispose();
    this.resources.clear();
  }
}
```

For scene-wide disposal when switching to 2D mode:

```typescript
function disposeScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    const materials = Array.isArray((obj as THREE.Mesh).material)
      ? (obj as THREE.Mesh).material
      : [(obj as THREE.Mesh).material];
    
    materials?.forEach((mat) => {
      Object.values(mat).forEach((v) => {
        if (v instanceof THREE.Texture) v.dispose();
      });
      mat.dispose();
    });
  });
}
```

R3F's useLoader caches assets—clear them explicitly when switching views:

```typescript
useGLTF.clear('/model.glb');
useTexture.clear('/texture.png');
```

Monitor memory with `renderer.info.memory` (shows geometry and texture counts) or use the `r3f-perf` package for visual debugging.

## InstancedMesh delivers 50+ buildings in a single draw call

For **50 buildings with similar geometry**, InstancedMesh reduces draw calls from 50 to 1. Create it with a temporary Object3D to compute matrices:

```tsx
function Buildings({ buildings, temp = new THREE.Object3D() }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    buildings.forEach((b, i) => {
      temp.position.set(b.x, b.height / 2, b.z);
      temp.scale.set(b.width, b.height, b.depth);
      temp.updateMatrix();
      ref.current!.setMatrixAt(i, temp.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [buildings]);
  
  return (
    <instancedMesh ref={ref} args={[null, null, buildings.length]}>
      <boxGeometry />
      <meshBasicMaterial color="#00ffff" wireframe />
    </instancedMesh>
  );
}
```

Drei's `<Instances>` component provides a declarative API but has **documented CPU overhead**—for 500+ objects, use raw InstancedMesh directly. The declarative approach works well for your 50-building target:

```tsx
<Instances limit={100}>
  <boxGeometry />
  <meshBasicMaterial wireframe color="cyan" toneMapped={false} />
  {buildings.map((b, i) => (
    <Instance key={i} position={[b.x, b.height/2, b.z]} scale={[1, b.height, 1]} />
  ))}
</Instances>
```

## Performance optimization checklist for 30+ FPS

Enable automatic quality scaling with drei's performance components:

```tsx
<Canvas dpr={[1, 2]} performance={{ min: 0.5 }}>
  <AdaptiveDpr pixelated />
  <AdaptiveEvents />
  <PerformanceMonitor 
    onDecline={() => setQuality('low')} 
    onIncline={() => setQuality('high')}
  />
</Canvas>
```

Share materials and geometries across meshes—never define them inline in JSX loops:

```tsx
const sharedGeometry = useMemo(() => new THREE.BoxGeometry(), []);
const sharedMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
  wireframe: true, 
  color: 0x00ffff 
}), []);
```

Never allocate objects inside `useFrame`—reuse pre-allocated vectors:

```tsx
const tempVec = useMemo(() => new THREE.Vector3(), []);

useFrame(() => {
  // GOOD: reuse object
  mesh.current.position.lerp(tempVec.set(x, y, z), 0.1);
  // BAD: new allocation every frame
  // mesh.current.position.lerp(new THREE.Vector3(x, y, z), 0.1);
});
```

## The cyber void aesthetic uses black backgrounds with fog depth

Configure the void with linear fog matching the background color for seamless fade:

```tsx
<Canvas>
  <color attach="background" args={['#000000']} />
  <fog attach="fog" args={['#000000', 10, 80]} />
  
  <Grid
    infiniteGrid
    cellSize={1}
    cellThickness={0.5}
    cellColor="#004400"
    sectionSize={5}
    sectionThickness={1}
    sectionColor="#00ff00"
    fadeDistance={80}
  />
</Canvas>
```

For wireframe materials with glow-ready properties, use **MeshBasicMaterial for performance** (no lighting calculations) with emissive colors pushed above 1.0:

```tsx
// Classic wireframe - no bloom needed
<meshBasicMaterial color="#00ffff" wireframe />

// Bloom-ready emissive - set toneMapped={false}
<meshBasicMaterial 
  color={[0, 2, 2]}  // RGB values > 1 for HDR
  wireframe 
  toneMapped={false} 
/>
```

Low-poly geometries enhance the retro feel. Use minimal segment counts:

| Geometry | Retro Settings |
|----------|---------------|
| BoxGeometry | `[1, 1, 1, 1, 1, 1]` (12 triangles) |
| SphereGeometry | `[1, 8, 6]` (~96 triangles) |
| IcosahedronGeometry | `[1, 0]` (20 faces—ideal for low-poly spheres) |
| ConeGeometry | `[0.5, 1.5, 6]` (hexagonal) |

## Bloom requires careful threshold configuration for selective glow

Install `@react-three/postprocessing` for optimized effect chains. The library automatically merges effects into minimal render passes:

```tsx
<EffectComposer multisampling={8}>
  <Bloom
    intensity={1.5}
    luminanceThreshold={1}      // Only HDR colors bloom
    luminanceSmoothing={0.025}
    mipmapBlur={true}           // Better performance
    kernelSize={KernelSize.LARGE}
  />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
</EffectComposer>
```

**Critical requirement**: Materials must have `toneMapped={false}` and emissive values above 1.0 to bloom:

```tsx
// Will NOT bloom (clamped to 0-1)
<meshStandardMaterial emissive="cyan" emissiveIntensity={0.5} />

// WILL bloom (HDR, not tone-mapped)
<meshStandardMaterial 
  emissive="cyan" 
  emissiveIntensity={3} 
  toneMapped={false}
/>
```

For performance-sensitive quality presets:

| Quality | Settings |
|---------|----------|
| Low | `kernelSize: SMALL`, `mipmapBlur: true`, `multisampling: 0` |
| Medium | `kernelSize: MEDIUM`, `mipmapBlur: true`, `multisampling: 4` |
| High | `kernelSize: LARGE`, `multisampling: 8` |

Disable effects entirely when performance drops:

```tsx
function AdaptiveEffects() {
  const perf = useThree((s) => s.performance.current);
  if (perf < 0.5) return null;
  
  return (
    <EffectComposer>
      <Bloom intensity={perf >= 0.8 ? 1.5 : 0.8} mipmapBlur />
    </EffectComposer>
  );
}
```

## Raycasting and controls work declaratively in R3F

R3F provides automatic raycasting—just add event handlers to meshes:

```tsx
<mesh
  onClick={(e) => {
    e.stopPropagation();  // Prevent events on objects behind
    selectBuilding(e.object.userData.id);
  }}
  onPointerOver={() => setHovered(true)}
  onPointerOut={() => setHovered(false)}
>
```

Configure OrbitControls for an isometric-style view with constraints:

```tsx
<OrbitControls
  makeDefault
  minPolarAngle={Math.PI / 6}    // Limit vertical rotation
  maxPolarAngle={Math.PI / 2.5}
  minDistance={10}               // Zoom limits
  maxDistance={100}
  enableDamping
  dampingFactor={0.05}
/>
```

For drag-to-move with grid snapping:

```tsx
const gridSize = 1;
const snap = (v: number) => Math.round(v / gridSize) * gridSize;

<DragControls
  axisLock="y"  // Lock to horizontal plane
  onDrag={(matrix) => {
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
    updatePosition(id, [snap(pos.x), 0, snap(pos.z)]);
  }}
  onDragStart={() => orbitRef.current.enabled = false}
  onDragEnd={() => orbitRef.current.enabled = true}
>
  <mesh />
</DragControls>
```

## Mapping world.json data to 3D geometry

For procedural building generation from JSON coordinates, create a mapping function that converts domain data to visual properties:

```tsx
interface Building {
  id: string;
  x: number;
  y: number;
  type: 'residential' | 'commercial' | 'industrial';
  luminosity: number;  // 0-5 scale
}

function buildingToGeometry(type: Building['type']): THREE.BufferGeometry {
  switch (type) {
    case 'residential': return new THREE.BoxGeometry(1, 2, 1);
    case 'commercial': return new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
    case 'industrial': return new THREE.BoxGeometry(2, 1.5, 2);
  }
}

function luminosityToVisual(luminosity: number) {
  return {
    emissiveIntensity: 0.5 + luminosity * 0.5,  // 0.5 to 3.0
    scale: 0.8 + luminosity * 0.1,              // 0.8 to 1.3
    opacity: 0.6 + luminosity * 0.08,           // 0.6 to 1.0
  };
}
```

Animate buildings with breathing scale and floating motion via `useFrame`:

```tsx
function AnimatedBuilding({ data }: { data: Building }) {
  const ref = useRef<THREE.Mesh>(null);
  const visual = luminosityToVisual(data.luminosity);
  
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    
    // Breathing scale based on luminosity
    const breathe = 1 + Math.sin(t * 2) * 0.02 * data.luminosity;
    ref.current.scale.setScalar(visual.scale * breathe);
    
    // Floating motion
    ref.current.position.y = 0.5 + Math.sin(t + data.x) * 0.1;
    
    // Slow rotation for special buildings
    if (data.luminosity > 3) {
      ref.current.rotation.y += 0.005;
    }
  });
  
  return (
    <mesh ref={ref} position={[data.x, 0.5, data.y]}>
      <primitive object={buildingToGeometry(data.type)} attach="geometry" />
      <meshBasicMaterial
        color={[0, visual.emissiveIntensity, visual.emissiveIntensity]}
        wireframe
        toneMapped={false}
        transparent
        opacity={visual.opacity}
      />
    </mesh>
  );
}
```

## Complete implementation architecture

Putting it all together, structure your 3D renderer as a self-contained component that manages its own lifecycle:

```tsx
function CyberVoidRenderer({ buildings, visible, onSelect }) {
  const sceneRef = useRef<THREE.Scene>(null);
  
  useEffect(() => {
    return () => {
      if (sceneRef.current) disposeScene(sceneRef.current);
      useGLTF.preload.clear();
    };
  }, []);
  
  if (!visible) return null;
  
  return (
    <Canvas
      onCreated={({ scene }) => { sceneRef.current = scene; }}
      gl={{ powerPreference: 'high-performance', antialias: true }}
      camera={{ position: [20, 20, 20], fov: 50 }}
      dpr={[1, 2]}
      performance={{ min: 0.5 }}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 20, 100]} />
      
      <Grid infiniteGrid cellColor="#003300" sectionColor="#00ff00" fadeDistance={100} />
      
      <Instances limit={buildings.length}>
        <boxGeometry />
        <meshBasicMaterial wireframe color={[0, 2, 2]} toneMapped={false} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.x, 1, b.y]}
            onClick={() => onSelect(b.id)}
          />
        ))}
      </Instances>
      
      <OrbitControls minDistance={10} maxDistance={80} maxPolarAngle={Math.PI / 2.2} />
      <AdaptiveDpr pixelated />
      
      <EffectComposer>
        <Bloom luminanceThreshold={1} intensity={1.5} mipmapBlur />
      </EffectComposer>
      
      <MemoryMonitor /> {/* Dev only */}
    </Canvas>
  );
}
```

## Electron-specific window handling

Handle minimize/restore to preserve resources:

```javascript
// main.js
mainWindow = new BrowserWindow({
  webPreferences: {
    backgroundThrottling: false,  // Prevent RAF throttling
  }
});

mainWindow.on('minimize', () => mainWindow.webContents.send('pause-render'));
mainWindow.on('restore', () => mainWindow.webContents.send('resume-render'));
```

In the renderer, toggle `frameloop` between `'always'` and `'never'`:

```tsx
const [paused, setPaused] = useState(false);

useEffect(() => {
  ipcRenderer.on('pause-render', () => setPaused(true));
  ipcRenderer.on('resume-render', () => setPaused(false));
}, []);

<Canvas frameloop={paused ? 'never' : 'always'}>
```

This architecture delivers a performant, properly-managed 3D renderer that coexists cleanly with your existing Pixi.js 2D view while achieving the distinctive cyber void aesthetic with bloom-enhanced wireframe buildings.