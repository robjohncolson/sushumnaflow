# TECHNICAL SPECIFICATION: SushumnaFlow

## 1. Project Overview
**SushumnaFlow** is a desktop biofeedback application for pranayama visualization. It maps breath phases to generative audio textures and 3D energy kinetics.

**Aesthetic:** "Cyber Void" (Black fog, neon wireframes, liquid light particles).
**Philosophy:** Fluidity over rigidity. Audio and visuals drift and flow rather than switching mechanically.

## 2. Technology Stack
*   **Runtime:** Electron (Main Process)
*   **Frontend:** React 18 + Vite (Renderer Process)
*   **3D Engine:** React Three Fiber (R3F) + Drei
*   **Audio Engine:** Tone.js
*   **State Management:** Zustand (Separated Stores)
*   **Styling:** TailwindCSS

## 3. Architecture Constraints

### A. The Master Clock
*   **Tone.Transport** is the single source of truth for timing.
*   **Visuals:** In `useFrame`, read `Tone.Transport.seconds` to calculate breath state.
*   **Audio:** Schedule events relative to Transport time.
*   **Constraint:** Never use `setInterval`, `setTimeout`, or `Date.now()` for synchronization.

### B. Audio Architecture (Reference: `tonejs-procedural-audio.md`)
*   **Pattern:** Singleton Class (`AudioEngine`). No React hooks for audio generation.
*   **Synthesis:** Pure oscillators only (Sine, Triangle, Saw). No external samples.
*   **Generative Logic:** "Eno-style" incommensurable loops (e.g., loop lengths of 17m, 23m) to prevent repetition.
*   **The "Lumens" System:** Audio density is driven by a 0.0 to 5.0 float value.
    *   **0.0 (Drone):** Always on. FatOscillator foundation.
    *   **1.0 (Pulse):** Rhythmic texture (8th notes).
    *   **2.0 (Bass):** Sub-bass grounding.
    *   **3.0 (Arp):** Random-walk arpeggiator (Chakra scale).
    *   **4.0+ (Melody):** High-frequency "shimmer."

### C. Visual Architecture (Reference: `PHASE2B_RESEARCH.md`)
*   **Resource Management:** Must implement `ResourceTracker` pattern to dispose of geometries/materials manually on unmount.
*   **Kinetics:** Use `InstancedMesh` for Prana particles (Target: 1000-5000 instances).
*   **Bloom Strategy:**
    *   Materials must have `toneMapped={false}`.
    *   Emissive intensity must be > 1.0 (HDR).
    *   Bloom threshold set to 1.0.
*   **Context Safety:** Handle WebGL context loss via event listeners.

### D. State Management
*   **Low-Frequency State (Zustand):**
    *   `useBreathStore`: BPM, Ratios, OrbitMode.
    *   `useAudioStore`: Volume, Mute.
    *   `useVisualStore`: Quality presets.
*   **High-Frequency State (Refs):**
    *   Particle positions, Phase progress, and Audio metering must NOT trigger React re-renders. Handle these mutably within the Render Loop.

## 4. Implementation Logic

### The Breath Math (Pure Function)
Input: `currentTime`, `BPM`, `Ratios [Inhale, Hold, Exhale, Hold]`.
Output:
*   `Phase`: Enum (INHALE, HOLD_IN, EXHALE, HOLD_OUT)
*   `Progress`: 0.0 to 1.0
*   `Lumens`: 0.0 to 5.0 (Mapped to Phase)
    *   *Inhale:* Ramp 1.0 -> 4.0
    *   *Hold In:* Sustain 5.0 (Transmutation)
    *   *Exhale:* Ramp 4.0 -> 1.0
    *   *Hold Out:* Sustain 0.0 (Void)

### The Orbit Modes
*   **Linear (Kundalini):** Particles rise up the spine (Inhale) and descend down the spine (Exhale).
*   **Microcosmic (Taoist):** Particles rise up the spine (Inhale) and descend down the *front* channel (Exhale).

## 5. Electron Specifics
*   `backgroundThrottling: false` in BrowserWindow configuration.
*   Flag: `disable-renderer-backgrounding`.
*   Flag: `ignore-gpu-blocklist`.