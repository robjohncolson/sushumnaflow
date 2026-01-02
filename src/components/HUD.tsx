import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Orbit,
  ArrowUpDown,
  BookOpen,
  BookX,
} from 'lucide-react'
import { useBreathStore, useAudioStore, useViewStore } from '../stores'
import { useAudio } from '../audio'
import { calculateBreathState, getPhaseLabel, getPhaseColor } from '../engines/breathEngine'
import { CodexCard } from './CodexCard'

/**
 * Phase indicator showing current breath phase
 */
function PhaseIndicator() {
  const { bpm, ratios, isRunning } = useBreathStore()
  const { getTransportSeconds } = useAudio()
  const [phase, setPhase] = useState('Ready')
  const [progress, setProgress] = useState(0)
  const [color, setColor] = useState('#00ffff')
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!isRunning) {
      setPhase('Ready')
      setProgress(0)
      setColor('#00ffff')
      return
    }

    const update = () => {
      const time = getTransportSeconds()
      const state = calculateBreathState(time, bpm, ratios)
      setPhase(getPhaseLabel(state.phase))
      setProgress(state.progress)
      setColor(getPhaseColor(state.phase))
      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, bpm, ratios, getTransportSeconds])

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-3xl font-light tracking-widest uppercase"
        style={{ color }}
      >
        {phase}
      </span>
      <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Control button component
 */
function ControlButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-3 rounded-lg border transition-all duration-200',
        'hover:scale-105 active:scale-95',
        active
          ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
          : 'border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Slider component for numeric values
 */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  unit?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className="text-neon-cyan">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-neon-cyan
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-webkit-slider-thumb]:transition-transform"
      />
    </div>
  )
}

/**
 * Ratio input group for breath timing
 */
function RatioInputs() {
  const { ratios, setRatios } = useBreathStore()

  const labels = [
    { key: 'inhale' as const, label: 'In' },
    { key: 'holdIn' as const, label: 'Hold' },
    { key: 'exhale' as const, label: 'Out' },
    { key: 'holdOut' as const, label: 'Rest' },
  ]

  return (
    <div className="flex gap-2">
      {labels.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-white/40 uppercase">{label}</span>
          <input
            type="number"
            min={0}
            max={8}
            value={ratios[key]}
            onChange={(e) =>
              setRatios({ [key]: Math.max(0, parseInt(e.target.value) || 0) })
            }
            className="w-10 h-8 bg-white/5 border border-white/20 rounded text-center
              text-neon-cyan text-sm focus:outline-none focus:border-neon-cyan
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Main HUD component
 */
export function HUD() {
  const { bpm, setBpm, isRunning, setIsRunning } = useBreathStore()
  const { volume, setVolume, isMuted, toggleMuted } = useAudioStore()
  const { mapMode, setMapMode, learnMode, setLearnMode } = useViewStore()
  const { init, start, stop, isInitialized } = useAudio()

  const handleStartStop = useCallback(async () => {
    if (!isInitialized) {
      await init()
    }

    if (isRunning) {
      stop()
      setIsRunning(false)
    } else {
      start()
      setIsRunning(true)
    }
  }, [isInitialized, isRunning, init, start, stop, setIsRunning])

  const handleReset = useCallback(() => {
    stop()
    setIsRunning(false)
  }, [stop, setIsRunning])

  const toggleMapMode = useCallback(() => {
    setMapMode(mapMode === 'KUNDALINI' ? 'ORBIT' : 'KUNDALINI')
  }, [mapMode, setMapMode])

  const toggleLearnMode = useCallback(() => {
    setLearnMode(!learnMode)
  }, [learnMode, setLearnMode])

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top center - Phase indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <PhaseIndicator />
      </div>

      {/* Bottom center - Main controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex flex-col items-center gap-6">
          {/* Ratio inputs */}
          <RatioInputs />

          {/* BPM slider */}
          <div className="w-48">
            <Slider
              label="Breaths/min"
              value={bpm}
              min={1}
              max={12}
              onChange={setBpm}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-3">
            <ControlButton onClick={toggleMuted} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </ControlButton>

            <ControlButton
              onClick={handleStartStop}
              active={isRunning}
              title={isRunning ? 'Stop' : 'Start'}
            >
              {isRunning ? <Pause size={24} /> : <Play size={24} />}
            </ControlButton>

            <ControlButton onClick={handleReset} title="Reset">
              <RotateCcw size={20} />
            </ControlButton>
          </div>
        </div>
      </div>

      {/* Left side - Map Mode + Learn Mode toggles */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="flex flex-col items-center gap-4">
          {/* Map Mode Toggle */}
          <div className="flex flex-col items-center gap-2">
            <ControlButton
              onClick={toggleMapMode}
              active={mapMode === 'ORBIT'}
              title={`Mode: ${mapMode}`}
            >
              {mapMode === 'KUNDALINI' ? (
                <ArrowUpDown size={20} />
              ) : (
                <Orbit size={20} />
              )}
            </ControlButton>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              {mapMode === 'KUNDALINI' ? 'Kundalini' : 'Orbit'}
            </span>
          </div>

          {/* Learn Mode Toggle */}
          <div className="flex flex-col items-center gap-2">
            <ControlButton
              onClick={toggleLearnMode}
              active={learnMode}
              title={learnMode ? 'Learn Mode: ON' : 'Learn Mode: OFF'}
            >
              {learnMode ? <BookOpen size={20} /> : <BookX size={20} />}
            </ControlButton>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              {learnMode ? 'Learn' : 'Practice'}
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Volume */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="w-24">
          <Slider
            label="Volume"
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            onChange={(v) => setVolume(v / 100)}
            unit="%"
          />
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/30 uppercase">
          Sushumna
        </h1>
      </div>

      {/* Codex Card (Learn Mode) */}
      <CodexCard />
    </div>
  )
}
