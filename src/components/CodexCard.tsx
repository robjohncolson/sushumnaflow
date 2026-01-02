import { useViewStore } from '../stores'
import { getCodexEntry } from '../codex'

/**
 * CodexCard — HUD overlay showing energy center information
 *
 * Only renders when:
 * - learnMode is ON
 * - A codex entry is hovered or selected
 *
 * Priority: selectedId > hoveredId
 */
export function CodexCard() {
  const learnMode = useViewStore((s) => s.learnMode)
  const hoveredId = useViewStore((s) => s.hoveredId)
  const selectedId = useViewStore((s) => s.selectedId)

  // Don't render if learn mode is off
  if (!learnMode) return null

  // Prefer selected over hovered
  const activeId = selectedId ?? hoveredId
  if (!activeId) return null

  const entry = getCodexEntry(activeId)
  if (!entry) return null

  return (
    <div className="absolute top-24 right-8 pointer-events-none">
      <div
        className="bg-black/80 border rounded-lg p-4 min-w-[200px] backdrop-blur-sm"
        style={{ borderColor: entry.color }}
      >
        {/* Name */}
        <h3
          className="text-lg font-medium tracking-wide"
          style={{ color: entry.color }}
        >
          {entry.name}
        </h3>

        {/* Element/Quality */}
        <p className="text-white/70 text-sm mt-1">{entry.elementOrQuality}</p>

        {/* Frequency */}
        <p className="text-neon-cyan text-sm mt-2 font-mono">
          {entry.frequencyHz} Hz
        </p>

        {/* Location hint (small text) */}
        <p className="text-white/40 text-xs mt-2 italic">
          {entry.locationHint}
        </p>

        {/* Mode indicator */}
        <div className="mt-3 pt-2 border-t border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            {entry.kind === 'chakra' ? 'Kundalini' : 'Orbit'}
          </span>
        </div>
      </div>
    </div>
  )
}
