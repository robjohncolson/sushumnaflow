import type { BreathRatios } from '../stores/breathStore'

export enum BreathPhase {
  INHALE = 'INHALE',
  HOLD_IN = 'HOLD_IN',
  EXHALE = 'EXHALE',
  HOLD_OUT = 'HOLD_OUT',
}

export interface BreathState {
  phase: BreathPhase
  progress: number // 0.0 to 1.0 within current phase
  cycleProgress: number // 0.0 to 1.0 within full cycle
  lumens: number // 0.0 to 5.0
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

  if (cyclePosition < inhaleEnd) {
    // INHALE: Lumens ramp from 1.0 to 4.0
    phase = BreathPhase.INHALE
    progress = inhaleDuration > 0 ? cyclePosition / inhaleDuration : 1
    lumens = 1.0 + progress * 3.0
  } else if (cyclePosition < holdInEnd) {
    // HOLD_IN: Lumens sustain at 5.0 (Transmutation)
    phase = BreathPhase.HOLD_IN
    progress = holdInDuration > 0 ? (cyclePosition - inhaleEnd) / holdInDuration : 1
    lumens = 5.0
  } else if (cyclePosition < exhaleEnd) {
    // EXHALE: Lumens ramp from 4.0 to 1.0
    phase = BreathPhase.EXHALE
    progress = exhaleDuration > 0 ? (cyclePosition - holdInEnd) / exhaleDuration : 1
    lumens = 4.0 - progress * 3.0
  } else {
    // HOLD_OUT: Lumens sustain at 0.0 (Void)
    phase = BreathPhase.HOLD_OUT
    progress = holdOutDuration > 0 ? (cyclePosition - exhaleEnd) / holdOutDuration : 1
    lumens = 0.0
  }

  return {
    phase,
    progress,
    cycleProgress,
    lumens,
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
