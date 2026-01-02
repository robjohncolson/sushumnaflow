import { create } from 'zustand'

interface AudioState {
  volume: number
  isMuted: boolean
  isInitialized: boolean

  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  setInitialized: (initialized: boolean) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  volume: 0.7,
  isMuted: false,
  isInitialized: false,

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  setMuted: (isMuted) => set({ isMuted }),

  toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),

  setInitialized: (isInitialized) => set({ isInitialized }),
}))
