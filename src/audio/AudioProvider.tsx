import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { AudioEngine } from './AudioEngine'
import { useAudioStore } from '../stores'

interface AudioContextValue {
  init: () => Promise<void>
  start: () => void
  stop: () => void
  setLumens: (value: number) => void
  setVolume: (value: number) => void
  setMuted: (muted: boolean) => void
  getTransportSeconds: () => number
  isInitialized: boolean
}

const AudioContext = createContext<AudioContextValue | null>(null)

interface AudioProviderProps {
  children: ReactNode
}

export function AudioProvider({ children }: AudioProviderProps) {
  const engineRef = useRef<AudioEngine | null>(null)
  const { isInitialized, setInitialized, volume, isMuted } = useAudioStore()

  // Initialize engine ref
  useEffect(() => {
    engineRef.current = AudioEngine.getInstance()

    // Handle window blur/focus for audio suspension
    const handleBlur = () => {
      // Optionally suspend audio when window loses focus
      // Commented out per spec - backgroundThrottling: false handles this
      // engineRef.current could suspend here if needed
    }

    const handleFocus = () => {
      // Resume if suspended
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur()
      } else {
        handleFocus()
      }
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      engineRef.current?.dispose()
    }
  }, [])

  // Sync volume changes
  useEffect(() => {
    engineRef.current?.setVolume(volume)
  }, [volume])

  // Sync mute changes
  useEffect(() => {
    engineRef.current?.setMuted(isMuted)
  }, [isMuted])

  const init = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = AudioEngine.getInstance()
    }
    await engineRef.current.init()
    setInitialized(true)
  }, [setInitialized])

  const start = useCallback(() => {
    engineRef.current?.start()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
  }, [])

  const setLumens = useCallback((value: number) => {
    engineRef.current?.setLumens(value)
  }, [])

  const setVolume = useCallback((value: number) => {
    engineRef.current?.setVolume(value)
  }, [])

  const setMuted = useCallback((muted: boolean) => {
    engineRef.current?.setMuted(muted)
  }, [])

  const getTransportSeconds = useCallback(() => {
    return engineRef.current?.getTransportSeconds() ?? 0
  }, [])

  const value: AudioContextValue = {
    init,
    start,
    stop,
    setLumens,
    setVolume,
    setMuted,
    getTransportSeconds,
    isInitialized,
  }

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
