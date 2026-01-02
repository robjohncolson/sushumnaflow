import { create } from 'zustand'

export type QualityPreset = 'low' | 'medium' | 'high'

interface VisualState {
  quality: QualityPreset
  particleCount: number
  bloomEnabled: boolean

  setQuality: (quality: QualityPreset) => void
  setParticleCount: (count: number) => void
  setBloomEnabled: (enabled: boolean) => void
}

const qualitySettings: Record<QualityPreset, { particleCount: number }> = {
  low: { particleCount: 500 },
  medium: { particleCount: 1500 },
  high: { particleCount: 3000 },
}

export const useVisualStore = create<VisualState>((set) => ({
  quality: 'medium',
  particleCount: qualitySettings.medium.particleCount,
  bloomEnabled: true,

  setQuality: (quality) =>
    set({
      quality,
      particleCount: qualitySettings[quality].particleCount,
    }),

  setParticleCount: (particleCount) =>
    set({ particleCount: Math.max(100, Math.min(5000, particleCount)) }),

  setBloomEnabled: (bloomEnabled) => set({ bloomEnabled }),
}))
