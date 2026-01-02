# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SushumnaFlow** is a desktop biofeedback application for pranayama (breath) visualization. It maps breath phases to generative audio textures and 3D energy kinetics.

**Aesthetic:** "Cyber Void" (black fog, neon wireframes, liquid light particles). Fluidity over rigidity—audio and visuals drift and flow rather than switching mechanically.

## Commands

```bash
npm run dev          # Start Vite dev server (browser)
npm run electron:dev # Start with Electron (dev server + electron)
npm run build        # TypeScript check + production build
npx tsc --noEmit     # Type check only
```

## Architecture

### The Master Clock
- **Tone.Transport** is the single source of truth for timing
- Visuals read `Tone.Transport.seconds` in `useFrame` to calculate breath state
- **NEVER** use `setInterval`, `setTimeout`, or `Date.now()` for synchronization

### Audio Engine (`src/audio/AudioEngine.ts`)
- **Singleton class** with `getInstance()` pattern
- Pure oscillators only (Sine, Triangle, Sawtooth)—no samples
- 5 stems with threshold activation via `setLumens(0-5)`:
  - 0: Drone (always-on FatOscillator)
  - 1+: Pulse, 2+: Bass, 3+: Arp, 4+: Melody
- Must call `init()` before use (requires user gesture for AudioContext)
- Guards on `setVolume()`, `setMuted()`, `dispose()` check `initialized` state

### Visual Engine (`src/components/`)
- **CyberVoid.tsx**: R3F Canvas with fog, Grid, bloom post-processing
- **PranaParticles.tsx**: InstancedMesh particles synced to breath phase
- **ChakraSpine.tsx**: 7 chakra nodes along sushumna channel

### State Management
- **Zustand stores** (`src/stores/`): breathStore, audioStore, visualStore
- **High-frequency state uses Refs** in useFrame—never trigger re-renders
- Access stores in useFrame via `store.getState()`, not reactive selectors

### Breath Math (`src/engines/breathEngine.ts`)
Pure function: `calculateBreathState(currentTime, bpm, ratios)` returns:
- `phase`: INHALE | HOLD_IN | EXHALE | HOLD_OUT
- `progress`: 0.0-1.0
- `lumens`: mapped per phase (drives audio density)

### Orbit Modes
- **Linear (Kundalini):** Particles rise/descend along spine
- **Microcosmic (Taoist):** Particles rise up back, descend down front

## Critical Constraints

1. **No allocations in useFrame**—pre-allocate vectors, reuse Object3D
2. **ResourceTracker pattern** for geometry/material disposal
3. **Bloom requires**: `toneMapped={false}`, emissive intensity > 1.0
4. **Electron settings**: `backgroundThrottling: false`, GPU flags in `electron/main.js`

## Key Documentation

| File | Purpose |
|------|---------|
| `SPEC.md` | Core technical specification |
| `PHASE2B_RESEARCH.md` | R3F + Electron patterns, WebGL context handling |
| `tonejs-procedural-audio.md` | AudioEngine architecture, generative techniques |
