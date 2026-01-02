# Building state-reactive procedural audio with Tone.js in Electron

A **singleton AudioEngine pattern wrapped in React context** offers the best architecture for state-reactive audio responding to values like `globalLumens`. Combine this with threshold-based layer activation, proper AudioContext lifecycle management, and Electron's `backgroundThrottling: false` to build a CPU-efficient procedural audio system that sounds distinctly digital. Pure oscillators (sine, triangle, sawtooth) without samples create the synthetic aesthetic, while Brian Eno-style incommensurable loop lengths generate endless variation.

## Architectural foundation: singleton engine with context provider

The most robust pattern for complex audio applications combines a **singleton AudioEngine class** for centralized control with a **React Context wrapper** for component tree access. This separates audio logic from React's render cycle while exposing reactive methods like `setLumens()`.

```typescript
// AudioEngine.ts - Singleton pattern
class AudioEngine {
  private static instance: AudioEngine | null = null;
  private initialized = false;
  private layers: Map<string, AudioLayer> = new Map();
  
  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
    this.setupLayers();
    this.initialized = true;
  }

  setLumens(value: number): void { /* map 0-5 to audio params */ }
  setStreak(n: number): void { /* modulate based on streak */ }
  dispose(): void { /* cleanup all nodes */ }
}
```

The Context wrapper then provides this engine to React components:

```typescript
const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider = ({ children }) => {
  const engineRef = useRef<AudioEngine | null>(null);
  
  useEffect(() => {
    engineRef.current = AudioEngine.getInstance();
    return () => engineRef.current?.dispose();
  }, []);
  
  return (
    <AudioContext.Provider value={{
      setLumens: (v) => engineRef.current?.setLumens(v),
      setStreak: (n) => engineRef.current?.setStreak(n),
    }}>
      {children}
    </AudioContext.Provider>
  );
};
```

**Critical for React integration**: always initialize Tone.js objects inside `useEffect`, not in `useRef` initializers. A documented bug causes re-creation on every render when initializing directly in refs.

## AudioContext lifecycle: gestures, blur, and Electron specifics

Modern browsers mandate user interaction before audio plays—the AudioContext starts in `"suspended"` state. Tone.js provides `Tone.start()` to handle this, but **lazy initialization on first user gesture** works best:

```typescript
async ensureContext(): Promise<void> {
  if (Tone.context.state !== "running") {
    await Tone.start();
  }
}
```

For Electron desktop apps, configure the BrowserWindow to prevent background throttling that would interrupt audio:

```javascript
// main.js
const mainWindow = new BrowserWindow({
  webPreferences: {
    backgroundThrottling: false  // Critical for continuous audio
  }
});
app.commandLine.appendSwitch("disable-renderer-backgrounding");
```

Handle window blur/focus to optionally suspend audio when the app loses focus. Use both the visibility API and window events for redundancy:

```typescript
useEffect(() => {
  const handleBlur = () => Tone.context.suspend();
  const handleFocus = () => {
    if (Tone.context.state === "suspended") Tone.context.resume();
  };
  
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', () => {
    document.hidden ? handleBlur() : handleFocus();
  });
  
  return () => { /* cleanup listeners */ };
}, []);
```

Electron-specific gotchas include the `blur` event occasionally not firing with `alwaysOnTop: true` on Linux, and AudioWorklet modules requiring special handling (inline Blob URLs) due to file protocol constraints.

## Layered stem architecture with threshold activation

A **layered system with threshold-based activation** maps directly to the `globalLumens` 0-5 scale. Each stem (drone, pulse, bass, arpeggio, melody) activates when intensity crosses its threshold:

| Stem | Threshold | Character |
|------|-----------|-----------|
| Drone | 0 (always on) | Foundation layer, volume/filter vary with intensity |
| Pulse | 1+ | Rhythmic texture, 8th-note patterns |
| Bass | 2+ | Low-end foundation, simple sequences |
| Arpeggio | 3+ | Melodic movement, pattern-based |
| Melody | 4-5 | Sparse, prominent single-voice line |

Each layer consists of a **synth source**, **Volume node**, optional **effects**, and a **Tone.Loop**:

```typescript
createDroneLayer() {
  const volume = new Tone.Volume(-18);
  const filter = new Tone.Filter(800, "lowpass");
  const synth = new Tone.FatOscillator({
    frequency: 55,
    type: "sine",
    count: 3,
    spread: 20  // Slight detuning for richness
  });
  
  synth.chain(filter, volume, this.masterBus);
  
  const lfo = new Tone.LFO(0.05, -15, 15);  // Slow pitch wobble
  lfo.connect(synth.detune);
  
  return { synth, volume, filter, lfo, active: false };
}
```

**FatOscillator** creates thickness by layering multiple detuned oscillators internally—far more efficient than manually creating separate nodes. The `spread` parameter in cents controls detuning width.

## Mapping state values to audio parameters

The `setLumens(0-5)` method should modulate multiple parameters simultaneously using **normalized scaling** and `rampTo()` for smooth transitions:

```typescript
setLumens(value: number, transitionTime = 2): void {
  const norm = value / 5;  // Normalize to 0-1
  
  // Drone volume: -30dB to -10dB
  this.layers.drone.volume.volume.rampTo(-30 + (norm * 20), transitionTime);
  
  // Filter cutoff: exponential feels more natural
  const freq = 200 * Math.pow(25, norm);  // 200Hz to 5000Hz
  this.layers.drone.filter.frequency.rampTo(freq, transitionTime);
  
  // Reverb wet: 0.2 to 0.8
  this.masterReverb.wet.rampTo(0.2 + (norm * 0.6), transitionTime);
  
  // Activate/deactivate layers based on thresholds
  this.updateLayerActivation(value);
}

updateLayerActivation(lumens: number): void {
  const thresholds = { pulse: 1, bass: 2, arpeggio: 3, melody: 4 };
  
  Object.entries(thresholds).forEach(([name, thresh]) => {
    const layer = this.layers[name];
    if (lumens >= thresh && !layer.active) {
      layer.loop.start(0);
      layer.volume.volume.rampTo(-12, 1);  // Fade in
      layer.active = true;
    } else if (lumens < thresh && layer.active) {
      layer.volume.volume.rampTo(-100, 2);  // Fade to silence
      setTimeout(() => layer.loop.stop(), 2000);
      layer.active = false;
    }
  });
}
```

For streak counters, modulate parameters like **tempo**, **pattern probability**, or **additional harmonic layers**:

```typescript
setStreak(n: number): void {
  // Increase tempo slightly with streak
  const bpm = 60 + Math.min(n * 2, 40);  // 60-100 BPM
  Tone.Transport.bpm.rampTo(bpm, 1);
  
  // Increase arpeggio pattern probability
  if (this.layers.arpeggio.pattern) {
    this.layers.arpeggio.pattern.probability = 0.4 + Math.min(n * 0.05, 0.5);
  }
}
```

## Procedural generation and Eno-style techniques

Brian Eno's generative principles from "Music for Airports" translate directly to code: **incommensurable loop lengths** create endless non-repeating variations. Use **prime number or irregular ratios** for loop durations:

```typescript
// Loops of different lengths rarely align
const loopLengths = {
  drone: "17:0:0",      // 17 measures
  bass: "23:0:0",       // 23 measures  
  arpeggio: "13:0:0",   // 13 measures
  melody: "29:0:0"      // 29 measures
};
```

For generative melody, use **Tone.Pattern** with `"randomWalk"` to create coherent melodic movement constrained to a scale:

```typescript
const scale = ["C3", "D3", "E3", "G3", "A3", "C4", "D4"];

const melodyPattern = new Tone.Pattern((time, note) => {
  synth.triggerAttackRelease(note, "2n", time);
}, scale, "randomWalk");  // Steps up or down through array

melodyPattern.probability = 0.6;   // 60% chance each beat
melodyPattern.humanize = "32n";    // Slight timing variation
melodyPattern.interval = "4n";     // Quarter note spacing
```

Add **controlled randomness** with weighted probability—root notes more likely than passing tones:

```typescript
function weightedRandomNote(scale) {
  const weights = [4, 1, 2, 3, 2, 1, 1];  // Root emphasized
  const total = weights.reduce((a, b) => a + b);
  let r = Math.random() * total;
  for (let i = 0; i < scale.length; i++) {
    r -= weights[i];
    if (r <= 0) return scale[i];
  }
}
```

## Achieving the "computer sounds like a computer" aesthetic

Pure oscillators without samples create the synthetic character you want. Stick to **basic waveforms**—`"sine"`, `"triangle"`, `"square"`, `"sawtooth"`—which are CPU-efficient and sound distinctly digital. Avoid the `"sine8"` or partial-heavy variants that use more processing.

For **glitch/digital texture**, add occasional artifacts:

- **Bit-crushing** via Tone.BitCrusher reduces bit depth for lo-fi sampler character
- **Very short attack times** (0.01s) create percussive digital "clicks"
- **Square wave LFOs** on volume create hard-edged tremolo
- **Filter resonance spikes** (high Q values) create synthetic whistles

```typescript
// Digital texture layer
const glitchSynth = new Tone.Synth({
  oscillator: { type: "square" },
  envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 }
});

const bitCrusher = new Tone.BitCrusher(4);  // 4-bit resolution
glitchSynth.chain(bitCrusher, this.masterBus);
```

Reference Disasterpeace's work on **Fez** and **Hyper Light Drifter**: he used Native Instruments Massive for synthesis, creating modular compositions that adapt to game state—altitude, time of day, environmental triggers. The "controlled chaos" approach layers many inputs into structured output.

## CPU efficiency and memory management

For long-running Electron apps, efficiency matters. Key strategies:

**Limit polyphony** using PolySynth's `maxPolyphony`:
```typescript
const poly = new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 4  // Reuses voices instead of creating new ones
});
```

**Use shared effect buses** instead of per-voice effects:
```typescript
// One reverb for all stems (efficient)
const masterReverb = new Tone.Reverb({ decay: 3 }).toDestination();
droneSynth.connect(masterReverb);
bassSynth.connect(masterReverb);
arpeggioSynth.connect(masterReverb);
```

**Set latency hint** for background/ambient audio:
```typescript
Tone.setContext(new Tone.Context({ latencyHint: "playback" }));
```

**Always dispose nodes** when removing layers. Undisposed nodes cause memory leaks that manifest as crackling audio after minutes of playback:

```typescript
dispose(): void {
  Object.values(this.layers).forEach(layer => {
    layer.synth.disconnect();
    layer.synth.dispose();
    layer.volume.dispose();
    layer.loop.dispose();
    if (layer.filter) layer.filter.dispose();
  });
  this.masterReverb.dispose();
  Tone.Transport.stop();
  Tone.Transport.cancel();
}
```

Check disposal status with `synth.disposed` returning `true` after cleanup.

## Effects chain patterns for ambient sound

Route all stems through a **master bus** with shared processing:

```typescript
// Master effects chain
this.masterFilter = new Tone.Filter(2000, "lowpass");
this.masterReverb = new Tone.Reverb({ decay: 4, wet: 0.4 });
this.masterCompressor = new Tone.Compressor(-15, 3);
this.masterLimiter = new Tone.Limiter(-1);

this.masterFilter.chain(
  this.masterReverb,
  this.masterCompressor,
  this.masterLimiter,
  Tone.Destination
);
```

Per-stem effects add character before the master bus:

| Stem | Recommended Effects |
|------|-------------------|
| Drone | LFO→detune, slow AutoFilter |
| Pulse | FeedbackDelay ("8n", 0.3 feedback) |
| Bass | Lowpass filter (200Hz, -24dB/oct) |
| Arpeggio | AutoFilter synced to Transport |
| Melody | Reverb with higher wet (0.6+) |

## Complete implementation reference

Putting it together, the recommended architecture:

```typescript
class ProceduralAudioEngine {
  private static instance: ProceduralAudioEngine;
  private masterBus: Tone.Channel;
  private layers: Record<string, AudioLayer>;
  private currentLumens = 0;
  
  static getInstance() { /* singleton */ }
  
  async init() {
    await Tone.start();
    this.setupMasterBus();
    this.setupLayers();
    this.setupBlurHandlers();
    Tone.Transport.bpm.value = 72;
    Tone.Transport.start("+0.1");
  }
  
  setLumens(value: number) {
    this.currentLumens = value;
    this.modulateParameters(value);
    this.updateLayerActivation(value);
  }
  
  // ... layer creation, parameter modulation, disposal
}

// React integration
const audioEngine = ProceduralAudioEngine.getInstance();

useEffect(() => {
  audioEngine.setLumens(globalLumens);
}, [globalLumens]);

useEffect(() => {
  audioEngine.setStreak(streak);
}, [streak]);
```

The system responds immediately to state changes through `rampTo()` transitions, activates layers at appropriate thresholds, and properly cleans up on unmount—all while maintaining the synthetic, generative aesthetic suitable for a productivity/focus application similar to how **Endel** maps circadian rhythms and activity to soundscape parameters, or how **Fez** dynamically adjusts its ambient score based on player altitude and environment.