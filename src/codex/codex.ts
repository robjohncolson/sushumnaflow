/**
 * Codex Data Layer
 *
 * Contains metadata for energy centers (chakras/dantians) used in
 * both KUNDALINI and ORBIT visualization modes.
 */

export type MapMode = 'KUNDALINI' | 'ORBIT'
export type CodexKind = 'chakra' | 'dantian'

export interface CodexEntry {
  id: string
  kind: CodexKind
  mode: MapMode
  name: string
  elementOrQuality: string
  frequencyHz: number
  locationHint: string
  anchor: { x: number; y: number; z: number }
  color: string
}

/**
 * CODEX: Complete registry of energy centers
 *
 * KUNDALINI mode: 7 chakras along the spine (y: -3 to +3)
 * ORBIT mode: 3 dantians (lower, middle, upper)
 */
export const CODEX: Record<string, CodexEntry> = {
  // ============ KUNDALINI: 7 Chakras ============
  muladhara: {
    id: 'muladhara',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Muladhara',
    elementOrQuality: 'Earth',
    frequencyHz: 396,
    locationHint: 'Base of spine',
    anchor: { x: 0, y: -3, z: 0 },
    color: '#ff0000',
  },
  svadhisthana: {
    id: 'svadhisthana',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Svadhisthana',
    elementOrQuality: 'Water',
    frequencyHz: 417,
    locationHint: 'Below navel',
    anchor: { x: 0, y: -2, z: 0 },
    color: '#ff7700',
  },
  manipura: {
    id: 'manipura',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Manipura',
    elementOrQuality: 'Fire',
    frequencyHz: 528,
    locationHint: 'Solar plexus',
    anchor: { x: 0, y: -1, z: 0 },
    color: '#ffff00',
  },
  anahata: {
    id: 'anahata',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Anahata',
    elementOrQuality: 'Air',
    frequencyHz: 639,
    locationHint: 'Heart center',
    anchor: { x: 0, y: 0, z: 0 },
    color: '#00ff00',
  },
  vishuddha: {
    id: 'vishuddha',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Vishuddha',
    elementOrQuality: 'Ether',
    frequencyHz: 741,
    locationHint: 'Throat',
    anchor: { x: 0, y: 1, z: 0 },
    color: '#00ffff',
  },
  ajna: {
    id: 'ajna',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Ajna',
    elementOrQuality: 'Light',
    frequencyHz: 852,
    locationHint: 'Third eye',
    anchor: { x: 0, y: 2, z: 0 },
    color: '#4444ff',
  },
  sahasrara: {
    id: 'sahasrara',
    kind: 'chakra',
    mode: 'KUNDALINI',
    name: 'Sahasrara',
    elementOrQuality: 'Consciousness',
    frequencyHz: 963,
    locationHint: 'Crown',
    anchor: { x: 0, y: 3, z: 0 },
    color: '#ff00ff',
  },

  // ============ ORBIT: 3 Dantians ============
  lowerDantian: {
    id: 'lowerDantian',
    kind: 'dantian',
    mode: 'ORBIT',
    name: 'Lower Dantian',
    elementOrQuality: 'Jing (Essence)',
    frequencyHz: 136.1, // Earth frequency / Om
    locationHint: 'Below navel, center of body',
    anchor: { x: 0, y: -2, z: 0.25 },
    color: '#ff4400',
  },
  middleDantian: {
    id: 'middleDantian',
    kind: 'dantian',
    mode: 'ORBIT',
    name: 'Middle Dantian',
    elementOrQuality: 'Qi (Energy)',
    frequencyHz: 256, // Middle C
    locationHint: 'Heart center',
    anchor: { x: 0, y: 0, z: 0.25 },
    color: '#00ff88',
  },
  upperDantian: {
    id: 'upperDantian',
    kind: 'dantian',
    mode: 'ORBIT',
    name: 'Upper Dantian',
    elementOrQuality: 'Shen (Spirit)',
    frequencyHz: 432, // Cosmic pitch
    locationHint: 'Third eye / pineal',
    anchor: { x: 0, y: 2, z: 0.2 },
    color: '#aa44ff',
  },
}

/**
 * Get a single codex entry by ID
 */
export function getCodexEntry(id: string): CodexEntry | null {
  return CODEX[id] ?? null
}

/**
 * Get all codex entries for a given map mode
 */
export function getCodexEntriesForMode(mode: MapMode): CodexEntry[] {
  return Object.values(CODEX).filter((entry) => entry.mode === mode)
}

/**
 * Get chakra entries only (for KUNDALINI mode)
 */
export function getChakraEntries(): CodexEntry[] {
  return getCodexEntriesForMode('KUNDALINI')
}

/**
 * Get dantian entries only (for ORBIT mode)
 */
export function getDantianEntries(): CodexEntry[] {
  return getCodexEntriesForMode('ORBIT')
}
