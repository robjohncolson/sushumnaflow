import { create } from 'zustand'

export type OrbitMode = 'linear' | 'microcosmic'

export interface BreathRatios {
  inhale: number
  holdIn: number
  exhale: number
  holdOut: number
}

interface BreathState {
  // Settings
  bpm: number
  ratios: BreathRatios
  orbitMode: OrbitMode
  isRunning: boolean

  // Actions
  setBpm: (bpm: number) => void
  setRatios: (ratios: Partial<BreathRatios>) => void
  setOrbitMode: (mode: OrbitMode) => void
  setIsRunning: (running: boolean) => void
  toggleRunning: () => void
}

export const useBreathStore = create<BreathState>((set) => ({
  // Default: 4-4-4-4 box breathing at 4 BPM (15 second cycle)
  bpm: 4,
  ratios: {
    inhale: 1,
    holdIn: 1,
    exhale: 1,
    holdOut: 1,
  },
  orbitMode: 'linear',
  isRunning: false,

  setBpm: (bpm) => set({ bpm: Math.max(1, Math.min(12, bpm)) }),

  setRatios: (partial) =>
    set((state) => ({
      ratios: { ...state.ratios, ...partial },
    })),

  setOrbitMode: (orbitMode) => set({ orbitMode }),

  setIsRunning: (isRunning) => set({ isRunning }),

  toggleRunning: () => set((state) => ({ isRunning: !state.isRunning })),
}))
