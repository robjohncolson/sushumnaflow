import * as Tone from 'tone'
import { BreathPhase } from '../engines/breathEngine'

/**
 * Audio Layer structure following the spec
 */
interface AudioLayer {
  synth: Tone.FatOscillator | Tone.Synth | Tone.PolySynth
  volume: Tone.Volume
  filter?: Tone.Filter
  effects: (Tone.ToneAudioNode)[]
  loop?: Tone.Loop | Tone.Pattern<string>
  lfo?: Tone.LFO
  active: boolean
  threshold: number
}

/**
 * Singleton AudioEngine following the patterns from tonejs-procedural-audio.md
 *
 * - Uses Tone.Transport as master clock
 * - Pure oscillators only (no samples)
 * - Threshold-based layer activation via setLumens()
 * - Brian Eno-style incommensurable loop lengths
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null
  private initialized = false
  private disposed = false

  private layers: Map<string, AudioLayer> = new Map()
  private masterBus!: Tone.Channel
  private masterReverb!: Tone.Reverb
  private masterCompressor!: Tone.Compressor
  private masterLimiter!: Tone.Limiter

  private currentLumens = 0
  private lastPhase: BreathPhase = BreathPhase.INHALE
  private breathBpm = 4 // breaths per minute

  // Preview tone synth (reused for all hover events)
  private previewSynth!: Tone.Synth
  private previewVolume!: Tone.Volume
  private previewReverb!: Tone.Reverb

  // Breath-synced synths (triggered on phase changes)
  private breathSynth!: Tone.PolySynth
  private breathVolume!: Tone.Volume
  private breathReverb!: Tone.Reverb

  // Rising tone for Kundalini ascent
  private risingSynth!: Tone.Synth
  private risingVolume!: Tone.Volume
  private risingFilter!: Tone.Filter

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  async init(): Promise<void> {
    if (this.initialized || this.disposed) return

    // Wait for user gesture
    await Tone.start()

    // Set latency hint for ambient audio (CPU efficient)
    Tone.setContext(new Tone.Context({ latencyHint: 'playback' }))

    this.setupMasterBus()
    this.setupLayers()

    // Set default BPM
    Tone.getTransport().bpm.value = 72

    this.initialized = true
  }

  private setupMasterBus(): void {
    // Master effects chain per spec
    this.masterReverb = new Tone.Reverb({ decay: 4, wet: 0.3 })
    this.masterCompressor = new Tone.Compressor(-15, 3)
    this.masterLimiter = new Tone.Limiter(-1)
    this.masterBus = new Tone.Channel(-6) // Master volume

    this.masterBus.chain(
      this.masterReverb,
      this.masterCompressor,
      this.masterLimiter,
      Tone.getDestination()
    )
  }

  private setupLayers(): void {
    this.createDroneLayer()
    // Disabled independent loops - they don't sync to breath
    // this.createPulseLayer()
    // this.createBassLayer()
    // this.createArpLayer()
    // this.createMelodyLayer()
    this.createPreviewSynth()
    this.createBreathSynths()
  }

  /**
   * Create breath-synced synthesizers
   * These respond directly to breath phase changes
   */
  private createBreathSynths(): void {
    // Breath transition synth - plays chords on phase changes
    this.breathVolume = new Tone.Volume(-20)
    this.breathReverb = new Tone.Reverb({ decay: 3, wet: 0.6 })

    this.breathSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.5,
        decay: 1,
        sustain: 0.3,
        release: 2,
      },
    })
    this.breathSynth.maxPolyphony = 4
    this.breathSynth.chain(this.breathReverb, this.breathVolume, this.masterBus)

    // Rising synth - gentle tone that rises with Kundalini
    // Using sine wave with heavy reverb for ethereal quality
    this.risingVolume = new Tone.Volume(-100) // Start silent
    this.risingFilter = new Tone.Filter(800, 'lowpass', -12)
    const risingReverb = new Tone.Reverb({ decay: 4, wet: 0.7 })

    this.risingSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.8,  // Slow attack for gentle fade in
        decay: 0.3,
        sustain: 0.6,
        release: 1.5, // Long release for smooth fade
      },
    })
    this.risingSynth.chain(this.risingFilter, risingReverb, this.risingVolume, this.masterBus)
  }

  /**
   * Preview synth for Learn Mode hover interactions
   * Gentle, short tone that plays the chakra/dantian frequency
   */
  private createPreviewSynth(): void {
    this.previewVolume = new Tone.Volume(-18) // Gentle volume
    this.previewReverb = new Tone.Reverb({ decay: 2, wet: 0.5 })

    this.previewSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.08,
        decay: 0.3,
        sustain: 0.2,
        release: 0.8,
      },
    })

    this.previewSynth.chain(this.previewReverb, this.previewVolume, this.masterBus)
  }

  /**
   * DRONE (threshold 0) - Always on foundation layer
   * FatOscillator with LFO detune, slow AutoFilter
   */
  private createDroneLayer(): void {
    const volume = new Tone.Volume(-24)
    const filter = new Tone.Filter(400, 'lowpass', -24)
    const autoFilter = new Tone.AutoFilter({
      frequency: 0.05,
      baseFrequency: 200,
      octaves: 2,
    }).start()

    const synth = new Tone.FatOscillator({
      frequency: 55, // A1
      type: 'sine',
      count: 3,
      spread: 20,
    })

    // Slow pitch wobble LFO
    const lfo = new Tone.LFO(0.03, -8, 8)
    lfo.connect(synth.detune)

    synth.chain(filter, autoFilter, volume, this.masterBus)

    this.layers.set('drone', {
      synth,
      volume,
      filter,
      effects: [autoFilter],
      lfo,
      active: false,
      threshold: 0,
    })
  }

  // NOTE: Pulse, Bass, Arp, Melody layers removed
  // They ran on fixed Transport timing that didn't sync with breath
  // Now using breath-synced audio only (drone + breathSynth + risingSynth)

  /**
   * Set breath BPM - updates internal timing
   */
  setBreathBpm(bpm: number): void {
    this.breathBpm = bpm
    // Scale transport BPM so rhythmic elements sync with breath
    // At 4 breaths/min, one cycle = 15 seconds
    // Musical BPM should be a multiple that feels natural
    if (this.initialized) {
      const musicalBpm = Math.max(40, bpm * 16) // 4 BPM breath = 64 BPM music
      Tone.getTransport().bpm.rampTo(musicalBpm, 2)
    }
  }

  /**
   * Set the current breath state - called every frame
   * Handles phase transitions and continuous modulation
   */
  setBreathState(phase: BreathPhase, progress: number, kundaliniY: number): void {
    if (!this.initialized) return

    // Detect phase change
    if (phase !== this.lastPhase) {
      this.onPhaseChange(phase)
      this.lastPhase = phase
    }

    // Continuous modulation based on phase and progress
    this.modulateBreathAudio(phase, progress, kundaliniY)
  }

  /**
   * Handle phase transitions - trigger appropriate sounds
   */
  private onPhaseChange(newPhase: BreathPhase): void {
    // Calculate note duration based on breath BPM
    const cycleDuration = 60 / this.breathBpm
    const phaseDuration = cycleDuration / 4

    switch (newPhase) {
      case BreathPhase.INHALE:
        // Soft descending chord - prana entering
        this.breathSynth.triggerAttackRelease(['C3', 'G3', 'C4'], phaseDuration * 0.8)
        // Stop rising synth
        this.risingSynth.triggerRelease()
        this.risingVolume.volume.rampTo(-100, 0.5)
        break

      case BreathPhase.HOLD_IN:
        // Tension chord - energy building
        this.breathSynth.triggerAttackRelease(['C3', 'Eb3', 'G3', 'Bb3'], phaseDuration * 0.9)
        break

      case BreathPhase.EXHALE:
        // Rising tone begins - Kundalini ascends (gentle volume)
        this.risingVolume.volume.rampTo(-24, 0.5)
        this.risingSynth.triggerAttack('A2') // Start at A2 (110Hz)
        // Ascending chord
        this.breathSynth.triggerAttackRelease(['C3', 'E3', 'G3', 'C4'], phaseDuration * 0.8)
        break

      case BreathPhase.HOLD_OUT:
        // Crown arrival - shimmering high chord
        this.breathSynth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], phaseDuration * 0.9)
        // Rising synth reaches peak
        this.risingFilter.frequency.rampTo(2000, 0.5)
        break
    }
  }

  /**
   * Continuous modulation based on breath state
   */
  private modulateBreathAudio(phase: BreathPhase, progress: number, kundaliniY: number): void {
    // Modulate rising synth frequency based on Kundalini position
    // Y ranges from -3 to +3, map to frequency 110Hz to 220Hz (gentle 1 octave rise)
    if (phase === BreathPhase.EXHALE || phase === BreathPhase.HOLD_OUT) {
      const yNorm = (kundaliniY + 3) / 6 // 0 to 1
      const freq = 110 * Math.pow(2, yNorm) // 110Hz to 220Hz (1 octave, A2 to A3)
      this.risingSynth.frequency.rampTo(freq, 0.3) // Slower ramp for smoothness
      this.risingFilter.frequency.rampTo(400 + yNorm * 600, 0.3)
    }

    // Drone pitch bend based on breath phase
    const drone = this.layers.get('drone')
    if (drone) {
      let detune = 0
      if (phase === BreathPhase.INHALE) {
        // Slight pitch drop during inhale
        detune = -progress * 20
      } else if (phase === BreathPhase.EXHALE) {
        // Slight pitch rise during exhale
        detune = progress * 30
      }
      (drone.synth as Tone.FatOscillator).detune.rampTo(detune, 0.2)
    }
  }

  /**
   * Set the Lumens value (0-5) and modulate all audio parameters
   * Uses rampTo for smooth transitions
   */
  setLumens(value: number, transitionTime = 0.5): void {
    if (!this.initialized) return

    this.currentLumens = Math.max(0, Math.min(5, value))
    const norm = this.currentLumens / 5

    // Modulate drone layer (always active)
    const drone = this.layers.get('drone')
    if (drone) {
      // Volume: -30dB to -12dB
      drone.volume.volume.rampTo(-30 + norm * 18, transitionTime)
      // Filter cutoff: 200Hz to 2000Hz (exponential feels natural)
      const freq = 200 * Math.pow(10, norm)
      drone.filter?.frequency.rampTo(freq, transitionTime)
    }

    // Master reverb wet: 0.2 to 0.6
    this.masterReverb.wet.rampTo(0.2 + norm * 0.4, transitionTime)

    // Update layer activation based on thresholds
    this.updateLayerActivation(transitionTime)
  }

  private updateLayerActivation(transitionTime: number): void {
    for (const [name, layer] of this.layers) {
      if (name === 'drone') {
        // Drone is always active
        if (!layer.active) {
          (layer.synth as Tone.FatOscillator).start()
          layer.lfo?.start()
          layer.active = true
        }
        continue
      }

      const shouldBeActive = this.currentLumens >= layer.threshold

      if (shouldBeActive && !layer.active) {
        // Activate layer
        layer.loop?.start(0)
        layer.volume.volume.rampTo(-14, transitionTime)
        layer.active = true
      } else if (!shouldBeActive && layer.active) {
        // Deactivate layer
        layer.volume.volume.rampTo(-100, transitionTime)
        // Stop loop after fade out
        setTimeout(() => {
          layer.loop?.stop()
        }, transitionTime * 1000)
        layer.active = false
      }
    }
  }

  /**
   * Start the transport and all active layers
   */
  start(): void {
    if (!this.initialized) return
    Tone.getTransport().start('+0.1')

    // Start drone immediately
    const drone = this.layers.get('drone')
    if (drone && !drone.active) {
      (drone.synth as Tone.FatOscillator).start()
      drone.lfo?.start()
      drone.active = true
    }
  }

  /**
   * Stop transport and all layers
   */
  stop(): void {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0

    // Stop all layers
    for (const [, layer] of this.layers) {
      layer.loop?.stop()
      if ('stop' in layer.synth) {
        (layer.synth as Tone.FatOscillator).stop()
      }
      layer.active = false
    }
  }

  /**
   * Set master volume
   */
  setVolume(value: number): void {
    if (!this.initialized || !this.masterBus) return
    const db = value > 0 ? 20 * Math.log10(value) : -100
    this.masterBus.volume.rampTo(db, 0.1)
  }

  /**
   * Mute/unmute
   */
  setMuted(muted: boolean): void {
    if (!this.initialized || !this.masterBus) return
    this.masterBus.mute = muted
  }

  /**
   * Play a gentle preview tone at the given frequency
   * Used for Learn Mode hover interactions
   * Reuses the same synth node (no allocation per call)
   */
  previewTone(freqHz: number): void {
    if (!this.initialized || !this.previewSynth) return

    // Trigger a short, gentle tone at the chakra/dantian frequency
    // The synth envelope handles the gentle attack/release
    this.previewSynth.triggerAttackRelease(freqHz, '8n')
  }

  /**
   * Get current transport time (for visuals to sync)
   */
  getTransportSeconds(): number {
    return Tone.getTransport().seconds
  }

  /**
   * Clean up all audio nodes
   */
  dispose(): void {
    if (this.disposed || !this.initialized) return

    this.stop()

    // Dispose all layers
    for (const [, layer] of this.layers) {
      layer.synth.disconnect()
      layer.synth.dispose()
      layer.volume.dispose()
      layer.filter?.dispose()
      layer.loop?.dispose()
      layer.lfo?.dispose()
      layer.effects.forEach((e) => e.dispose())
    }

    this.layers.clear()

    // Dispose preview synth
    this.previewSynth?.dispose()
    this.previewVolume?.dispose()
    this.previewReverb?.dispose()

    // Dispose breath synths
    this.breathSynth?.dispose()
    this.breathVolume?.dispose()
    this.breathReverb?.dispose()
    this.risingSynth?.dispose()
    this.risingVolume?.dispose()
    this.risingFilter?.dispose()

    // Dispose master chain (with null checks)
    this.masterReverb?.dispose()
    this.masterCompressor?.dispose()
    this.masterLimiter?.dispose()
    this.masterBus?.dispose()

    Tone.getTransport().cancel()

    this.disposed = true
    this.initialized = false
    AudioEngine.instance = null
  }

  get isInitialized(): boolean {
    return this.initialized
  }
}
