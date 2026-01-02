import * as Tone from 'tone'

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

  // Chakra scale for arpeggiator (C minor pentatonic extended)
  private readonly chakraScale = ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4']

  // Preview tone synth (reused for all hover events)
  private previewSynth!: Tone.Synth
  private previewVolume!: Tone.Volume
  private previewReverb!: Tone.Reverb

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
    this.createPulseLayer()
    this.createBassLayer()
    this.createArpLayer()
    this.createMelodyLayer()
    this.createPreviewSynth()
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

  /**
   * PULSE (threshold 1+) - Rhythmic 8th note texture
   * FeedbackDelay for spaciousness
   */
  private createPulseLayer(): void {
    const volume = new Tone.Volume(-100) // Start silent
    const filter = new Tone.Filter(1200, 'lowpass')
    const delay = new Tone.FeedbackDelay('8n', 0.25)

    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
    })

    synth.chain(filter, delay, volume, this.masterBus)

    // Incommensurable loop length (17 beats)
    const loop = new Tone.Loop((time) => {
      if (!this.layers.get('pulse')?.active) return
      const note = Math.random() > 0.4 ? 'C4' : 'G3'
      synth.triggerAttackRelease(note, '16n', time)
    }, '8n')

    this.layers.set('pulse', {
      synth,
      volume,
      filter,
      effects: [delay],
      loop,
      active: false,
      threshold: 1,
    })
  }

  /**
   * BASS (threshold 2+) - Sub-bass grounding
   * 200Hz lowpass filter
   */
  private createBassLayer(): void {
    const volume = new Tone.Volume(-100)
    const filter = new Tone.Filter(200, 'lowpass', -24)

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.6, release: 0.8 },
    })

    synth.chain(filter, volume, this.masterBus)

    // 23-beat incommensurable pattern
    let noteIndex = 0
    const bassNotes = ['C2', 'C2', 'G1', 'C2', 'Eb2']

    const loop = new Tone.Loop((time) => {
      if (!this.layers.get('bass')?.active) return
      const note = bassNotes[noteIndex % bassNotes.length]
      synth.triggerAttackRelease(note, '2n', time)
      noteIndex++
    }, '2n')

    this.layers.set('bass', {
      synth,
      volume,
      filter,
      effects: [],
      loop,
      active: false,
      threshold: 2,
    })
  }

  /**
   * ARP (threshold 3+) - Random-walk arpeggiator
   * AutoFilter synced to Transport
   */
  private createArpLayer(): void {
    const volume = new Tone.Volume(-100)
    const autoFilter = new Tone.AutoFilter({
      frequency: '4n',
      baseFrequency: 400,
      octaves: 3,
    }).start()

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.4 },
    })
    synth.maxPolyphony = 4

    synth.chain(autoFilter, volume, this.masterBus)

    // Random walk through chakra scale
    const pattern = new Tone.Pattern(
      (time, note) => {
        if (!this.layers.get('arp')?.active) return
        synth.triggerAttackRelease(note, '8n', time)
      },
      this.chakraScale,
      'randomWalk'
    )
    pattern.interval = '8n'
    pattern.probability = 0.6
    pattern.humanize = '32n'

    this.layers.set('arp', {
      synth,
      volume,
      effects: [autoFilter],
      loop: pattern,
      active: false,
      threshold: 3,
    })
  }

  /**
   * MELODY (threshold 4+) - High-frequency shimmer
   * Higher reverb wet (0.6+)
   */
  private createMelodyLayer(): void {
    const volume = new Tone.Volume(-100)
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.65 })
    const filter = new Tone.Filter(3000, 'highpass')

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.5, sustain: 0.4, release: 1.5 },
    })

    synth.chain(filter, reverb, volume, this.masterBus)

    // Sparse melody with 29-beat cycle (prime number)
    const melodyNotes = ['C5', 'Eb5', 'G5', 'Bb5', 'C6']
    let melodyIndex = 0

    const loop = new Tone.Loop((time) => {
      if (!this.layers.get('melody')?.active) return
      if (Math.random() > 0.3) return // Sparse triggering

      const note = melodyNotes[melodyIndex % melodyNotes.length]
      synth.triggerAttackRelease(note, '2n', time)
      melodyIndex++
    }, '4n')

    this.layers.set('melody', {
      synth,
      volume,
      filter,
      effects: [reverb],
      loop,
      active: false,
      threshold: 4,
    })
  }

  /**
   * Set the Lumens value (0-5) and modulate all audio parameters
   * Uses rampTo for smooth transitions
   */
  setLumens(value: number, transitionTime = 2): void {
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
