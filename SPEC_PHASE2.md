# SPEC_PHASE2.md — SushumnaFlow Phase 2 Addendum
**Scope:** Avatar overlay, Codex data + Learn Mode, explicit dual-mode systems (Kundalini vs Orbit).
**Non-goals:** No syncretic blended map, no stop-and-go orbit stations, no vocal/bija samples.

---

## 0) Phase 2 Decisions (Locked)
1. **Avatar style:** “Cyber‑Mystic Glass” — stylized semi‑transparent GLTF human, low‑poly/wireframe, no realistic skin textures.
2. **System modes:** Explicit toggle:
   - **KUNDALINI (Vedic):** Nadi trio + 7 Chakras
   - **ORBIT (Taoist):** Ren/Du loop + 3 Dantians
   - Do **not** combine both maps into one display.
3. **Interaction:** **Learn Mode toggle**
   - Learn ON: hover shows Codex Card (Name, Element/Quality, Frequency).
   - Learn OFF: Practice mode is purely visual (no hover UI).
4. **Orbit motion:** Must stay **fluid** (no station stops).
5. **Audio:** Procedural synth only (Tone.js), no samples, no vocal mantras.

---

## 1) Non‑Negotiable Architecture Constraints (Carryover)
### 1.1 Master Clock
- **Tone.Transport is the master clock**.
- Breath math derives timing from `Tone.Transport.seconds` only.
- No `Date.now()`, `performance.now()`, `setInterval`, `setTimeout` for core timing.

### 1.2 Store Discipline (No 60fps Zustand Writes)
- Zustand stores hold **low-frequency settings/UI state only**.
- Per-frame values are computed in R3F `useFrame()` via `store.getState()`.

### 1.3 R3F Performance + Lifecycle
- Cyber Void aesthetic rules remain:
  - `background: #000000`
  - linear fog `#000000`
  - neon wireframes / HDR bloom materials must be `toneMapped={false}` and color/emissive > 1.
- Use `InstancedMesh` for particles.
- No allocations inside `useFrame` (pre-allocate temp vectors/matrices/Object3D).
- New resources must be disposed (ResourceTracker pattern).

### 1.4 Mode Switching Must Be “Visibility Switching”
- Prefer keeping both mode groups mounted and toggling `visible`
  (avoids expensive shader recompiles / geometry rebuilds).

---

## 2) Coordinate System: Anatomical Landmarks Mapping (Adopted)
We standardize an **anatomy-aligned Y axis**:

- `Y = +3.0` → Crown (Sahasrara / Baihui)
- `Y = +2.0` → Brow/Third Eye (Ajna / Yintang)
- `Y = +1.0` → Throat (Vishuddha / Tiantu region)
- `Y =  0.0` → Heart center (Anahata / Danzhong)
- `Y = -1.0` → Navel/Solar plexus region (Manipura)
- `Y = -2.0` → Lower abdomen / below navel region (Svadhisthana / Lower Dantian neighborhood)
- `Y = -3.0` → Perineum/base (Muladhara / Huiyin)

This is the **visual teaching scaffold** for the avatar overlay and node placement.

---

## 3) Codex System (Data-First “Knowledge Layer”)

### 3.1 Data Model
Create `src/codex/codex.ts`:

```ts
export type MapMode = 'KUNDALINI' | 'ORBIT';
export type CodexKind = 'CHAKRA' | 'DANTIAN' | 'NADI' | 'VESSEL';

export interface CodexEntry {
  id: string;                  // stable key (e.g. "chakra.muladhara")
  kind: CodexKind;
  mode: MapMode;               // which map it belongs to
  name: string;                // display name
  originalName?: string;       // Sanskrit or Chinese term (optional)
  elementOrQuality: string;    // (Earth/Water/Fire...) or (Jing/Qi/Shen)
  frequencyHz: number;         // app mapping (no claim of canon)
  locationHint: string;        // "perineum", "throat", "below navel", etc.
  anchor: {
    x: number; y: number; z: number;   // world-space anchor for node placement
  };
  colorHDR?: [number, number, number]; // optional HDR color for bloom-ready visuals
}
