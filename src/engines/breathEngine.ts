import type { BreathRatios } from '../stores/breathStore'

export enum BreathPhase {
  INHALE = 'INHALE',
  HOLD_IN = 'HOLD_IN',
  EXHALE = 'EXHALE',
  HOLD_OUT = 'HOLD_OUT',
}

/**
 * Bandha (lock) states based on breath phase
 *
 * Traditional timing per Yoga Kundalini Upanishad:
 * - Mula Bandha: Root lock, raises Apana upward (HOLD_IN)
 * - Jalandhara Bandha: Throat lock, seals Prana (HOLD_IN)
 * - Uddiyana Bandha: Abdominal lock, creates upward suction (end of EXHALE, HOLD_OUT)
 */
export interface BandhaState {
  mula: boolean // Root lock (perineum)
  uddiyana: boolean // Abdominal lock (navel drawn in/up)
  jalandhara: boolean // Throat lock (chin to chest)
}

/**
 * Kundalini position along Sushumna
 * Y coordinates: -3 (Muladhara) to +3 (Sahasrara)
 */
export interface KundaliniState {
  y: number // Current Y position along spine
  isRising: boolean // True when ascending, false when gathering
  atCrown: boolean // True when Kundalini has reached Sahasrara
}

export interface BreathState {
  phase: BreathPhase
  progress: number // 0.0 to 1.0 within current phase
  cycleProgress: number // 0.0 to 1.0 within full cycle
  lumens: number // 0.0 to 5.0
  bandhas: BandhaState
  kundalini: KundaliniState
}

/**
 * Pure function: Calculate breath state from transport time.
 *
 * BPM here means "breaths per minute" - one complete cycle.
 * At 4 BPM with 1:1:1:1 ratio, each phase is 3.75 seconds.
 */
export function calculateBreathState(
  currentTime: number,
  bpm: number,
  ratios: BreathRatios
): BreathState {
  // Calculate total cycle duration in seconds
  const cycleDuration = 60 / bpm
  const totalRatio = ratios.inhale + ratios.holdIn + ratios.exhale + ratios.holdOut

  // Calculate phase durations
  const inhaleDuration = (ratios.inhale / totalRatio) * cycleDuration
  const holdInDuration = (ratios.holdIn / totalRatio) * cycleDuration
  const exhaleDuration = (ratios.exhale / totalRatio) * cycleDuration
  const holdOutDuration = (ratios.holdOut / totalRatio) * cycleDuration

  // Phase boundaries (cumulative)
  const inhaleEnd = inhaleDuration
  const holdInEnd = inhaleEnd + holdInDuration
  const exhaleEnd = holdInEnd + exhaleDuration
  // holdOutEnd === cycleDuration

  // Position within current cycle
  const cyclePosition = currentTime % cycleDuration
  const cycleProgress = cyclePosition / cycleDuration

  let phase: BreathPhase
  let progress: number
  let lumens: number
  let bandhas: BandhaState
  let kundalini: KundaliniState

  // Y range: -3 (Muladhara) to +3 (Sahasrara)
  const Y_MIN = -3
  const Y_MAX = 3
  const Y_RANGE = Y_MAX - Y_MIN

  if (cyclePosition < inhaleEnd) {
    // INHALE: Prana enters, gathers at Muladhara
    // Kundalini coils/gathers energy at root
    phase = BreathPhase.INHALE
    progress = inhaleDuration > 0 ? cyclePosition / inhaleDuration : 1
    lumens = 1.0 + progress * 2.0

    // No bandhas during inhale
    bandhas = { mula: false, uddiyana: false, jalandhara: false }

    // Kundalini stays at root, gathering energy
    kundalini = {
      y: Y_MIN,
      isRising: false,
      atCrown: false,
    }
  } else if (cyclePosition < holdInEnd) {
    // HOLD_IN (Antara Kumbhaka): Internal retention
    // Bandhas engage, Kundalini RISES through Sushumna
    // This is where the magic happens - pressure forces Kundalini upward
    phase = BreathPhase.HOLD_IN
    progress = holdInDuration > 0 ? (cyclePosition - inhaleEnd) / holdInDuration : 1
    lumens = 3.0 + progress * 2.0

    // Mula raises Apana, Jalandhara seals Prana - creates upward pressure
    bandhas = { mula: true, uddiyana: false, jalandhara: true }

    // Kundalini rises from root to crown during hold
    kundalini = {
      y: Y_MIN + progress * Y_RANGE,
      isRising: true,
      atCrown: progress > 0.95,
    }
  } else if (cyclePosition < exhaleEnd) {
    // EXHALE: Release, Kundalini at crown then begins descent
    phase = BreathPhase.EXHALE
    progress = exhaleDuration > 0 ? (cyclePosition - holdInEnd) / exhaleDuration : 1
    lumens = 5.0 - progress * 3.0

    // Uddiyana engages during exhale to maintain lift
    bandhas = { mula: true, uddiyana: true, jalandhara: false }

    // Kundalini at crown for first half, then descends
    if (progress < 0.3) {
      kundalini = {
        y: Y_MAX,
        isRising: false,
        atCrown: true,
      }
    } else {
      // Gentle descent during exhale
      const descentProgress = (progress - 0.3) / 0.7
      kundalini = {
        y: Y_MAX - descentProgress * Y_RANGE * 0.5, // Descend halfway
        isRising: false,
        atCrown: false,
      }
    }
  } else {
    // HOLD_OUT (Bahya Kumbhaka): External retention
    // Kundalini returns to root, preparing for next cycle
    phase = BreathPhase.HOLD_OUT
    progress = holdOutDuration > 0 ? (cyclePosition - exhaleEnd) / holdOutDuration : 1
    lumens = 2.0 - progress * 2.0

    // All three bandhas briefly, then release
    const releasing = progress > 0.7
    bandhas = { mula: !releasing, uddiyana: !releasing, jalandhara: !releasing }

    // Complete descent to root
    const startY = Y_MAX - Y_RANGE * 0.5 // Where exhale left off
    kundalini = {
      y: startY - progress * (startY - Y_MIN),
      isRising: false,
      atCrown: false,
    }
  }

  return {
    phase,
    progress,
    cycleProgress,
    lumens,
    bandhas,
    kundalini,
  }
}

/**
 * Get a human-readable phase label
 */
export function getPhaseLabel(phase: BreathPhase): string {
  switch (phase) {
    case BreathPhase.INHALE:
      return 'Inhale'
    case BreathPhase.HOLD_IN:
      return 'Hold'
    case BreathPhase.EXHALE:
      return 'Exhale'
    case BreathPhase.HOLD_OUT:
      return 'Rest'
  }
}

/**
 * Get phase color for UI
 */
export function getPhaseColor(phase: BreathPhase): string {
  switch (phase) {
    case BreathPhase.INHALE:
      return '#00ffff' // Cyan - rising energy
    case BreathPhase.HOLD_IN:
      return '#ff00ff' // Magenta - transmutation
    case BreathPhase.EXHALE:
      return '#00ff88' // Green - descending
    case BreathPhase.HOLD_OUT:
      return '#4400aa' // Deep purple - void
  }
}
