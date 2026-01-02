# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SushumnaFlow** is a desktop biofeedback application for pranayama (breath) visualization. It maps breath phases to generative audio textures and 3D energy kinetics.

**Current Status:** Specification and research phase—no implementation code exists yet. The repository contains technical design documents only.

**Aesthetic:** "Cyber Void" (black fog, neon wireframes, liquid light particles). Fluidity over rigidity—audio and visuals drift and flow rather than switching mechanically.

## Technology Stack (Specified)

| Layer | Technology |
|-------|------------|
| Runtime | Electron (Main Process) |
| Frontend | React 18 + Vite (Renderer Process) |
| 3D Engine | React Three Fiber (R3F) + Drei |
| Audio | Tone.js |
| State | Zustand (separated stores) |
| Styling | TailwindCSS |
| Post-Processing | @react-three/postprocessing |

## Architecture Constraints

### The Master Clock
- **Tone.Transport** is the single source of truth for timing
- Visuals read `Tone.Transport.seconds` in `useFrame` to calculate breath state
- Audio events scheduled relative to Transport time
- **NEVER** use `setInterval`, `setTimeout`, or `Date.now()` for synchronization

### Audio Architecture
- **Singleton AudioEngine class** wrapped in React Context—no React hooks for audio generation
- Pure oscillators only (Sine, Triangle, Sawtooth)—no external samples
- Brian Eno-style incommensurable loops (prime number lengths: 17m, 23m, 13m, 29m) for endless variation
- **Lumens System (0.0-5.0)** drives audio density:
  - 0.0: Drone (always-on FatOscillator)
  - 1.0+: Pulse (rhythmic 8th notes)
  - 2.0+: Bass (sub-bass grounding)
  - 3.0+: Arp (random-walk arpeggiator)
  - 4.0+: Melody (high-frequency shimmer)

### Visual Architecture
- **ResourceTracker pattern** for manual geometry/material disposal
- **InstancedMesh** for Prana particles (target: 1000-5000 instances, single draw call)
- Bloom requires: `toneMapped={false}`, emissive intensity > 1.0, threshold at 1.0
- Handle WebGL context loss with event listeners

### State Management
- **Low-frequency (Zustand stores):** BPM, Ratios, OrbitMode, Volume, Quality presets
- **High-frequency (Refs):** Particle positions, phase progress, audio metering—never trigger re-renders

## Core Algorithms

### Breath Math (Pure Function)
Input: `currentTime`, `BPM`, `Ratios [Inhale, Hold, Exhale, Hold]`
Output:
- `Phase`: INHALE | HOLD_IN | EXHALE | HOLD_OUT
- `Progress`: 0.0-1.0
- `Lumens`: mapped per phase (Inhale: 1→4, Hold In: 5, Exhale: 4→1, Hold Out: 0)

### Orbit Modes
- **Linear (Kundalini):** Particles rise up spine (Inhale), descend down spine (Exhale)
- **Microcosmic (Taoist):** Particles rise up spine (Inhale), descend down front channel (Exhale)

## Electron Configuration

```javascript
// Required BrowserWindow settings
{
  webPreferences: { backgroundThrottling: false }
}
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.disableDomainBlockingFor3DAPIs();
```

## Performance Targets

- 30+ FPS minimum
- Adaptive quality scaling via PerformanceMonitor
- Never allocate objects in `useFrame`—pre-allocate and reuse vectors
- Share geometries/materials—never define inline in JSX loops
- Latency hint: `"playback"` for CPU-efficient audio

## Key Documentation Files

| File | Purpose |
|------|---------|
| `SPEC.md` | Core technical specification |
| `PHASE2B_RESEARCH.md` | R3F + Electron integration patterns, WebGL context handling, bloom configuration |
| `tonejs-procedural-audio.md` | AudioEngine architecture, layer thresholds, Eno-style generative techniques |
| `visualizing-chakras.txt` | Reference research on energy visualization concepts |

## Implementation Notes

When implementing, reference the research documents for:
- WebGL context loss handling patterns (`PHASE2B_RESEARCH.md`)
- Layer activation thresholds and `rampTo()` transitions (`tonejs-procedural-audio.md`)
- AudioContext lifecycle and blur/focus handling (`tonejs-procedural-audio.md`)
- InstancedMesh setup and performance optimization (`PHASE2B_RESEARCH.md`)
