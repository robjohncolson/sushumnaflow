import { create } from 'zustand'
import type { MapMode } from '../codex'

interface ViewState {
  // Map mode: which energy system to visualize
  mapMode: MapMode
  // Learn mode: enables hover/click interactions with codex entries
  learnMode: boolean
  // Currently hovered codex entry ID (only set when learnMode === true)
  hoveredId: string | null
  // Currently selected codex entry ID (persists until cleared)
  selectedId: string | null

  // Setters
  setMapMode: (mode: MapMode) => void
  setLearnMode: (enabled: boolean) => void
  setHoveredId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  clearSelection: () => void
}

export const useViewStore = create<ViewState>((set) => ({
  mapMode: 'KUNDALINI',
  learnMode: false,
  hoveredId: null,
  selectedId: null,

  setMapMode: (mapMode) => set({ mapMode, hoveredId: null, selectedId: null }),

  setLearnMode: (learnMode) =>
    set({
      learnMode,
      // Clear hover state when disabling learn mode
      hoveredId: learnMode ? null : null,
    }),

  setHoveredId: (hoveredId) => set({ hoveredId }),

  setSelectedId: (selectedId) => set({ selectedId }),

  clearSelection: () => set({ hoveredId: null, selectedId: null }),
}))
