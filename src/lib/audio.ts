/**
 * 마을 사운드 시스템 — 외부 에셋 없이 WebAudio로 전부 합성.
 *
 * - BGM: 펜타토닉 플럭 멜로디 + 패드 + 베이스의 8마디 루프 (시드 고정)
 * - 앰비언스: 낮 새소리 / 밤 풀벌레 (낮밤에 따라 크로스페이드)
 * - SFX: 발소리(거리 기반), 점프/착지, 존 진입 차임, 수확 팝
 *
 * 브라우저 자동재생 정책상 init()은 반드시 사용자 제스처(입장 버튼)
 * 안에서 호출해야 한다. 모든 노드는 master 게인 하나에 묶여
 * 음소거 토글이 전체에 적용된다.
 */

const MUTE_KEY = "panda-village-muted";

// G 메이저 펜타토닉 (G3~E5 대역)
const SCALE = [196.0, 220.0, 246.9, 293.7, 329.6, 392.0, 440.0, 493.9, 587.3];
// 8마디 × 8비트 멜로디 (시드 고정 수열, -1은 쉼표)
const MELODY = [
  5, -1, 6, 5, 3, -1, 2, 3,
  5, -1, 6, 8, 7, 6, 5, -1,
  3, -1, 5, 3, 2, -1, 0, 1,
  2, 3, 2, -1, 1, -1, 0, -1,
  5, -1, 6, 5, 3, -1, 2, 3,
  7, -1, 8, 7, 6, 5, 6, -1,
  5, 3, 2, -1, 3, 5, 6, 7,
  5, -1, -1, -1, 2, -1, -1, -1,
];
// 2마디마다 코드 (루트 인덱스): I - IV - V - IV
const CHORDS = [0, 3, 4, 3];
const BPM = 74;
const BEAT = 60 / BPM / 2; // 8분음표 간격

class VillageAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private dayGain: GainNode | null = null;
  private nightGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private birdTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private stepToggle = false;

  muted = false;

  /** 사용자 제스처 안에서 호출 (입장 버튼) */
  init() {
    if (this.ctx || typeof window === "undefined") return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.muted =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(MUTE_KEY) === "1";
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);

    this.dayGain = ctx.createGain();
    this.dayGain.gain.value = 0;
    this.dayGain.connect(this.master);

    this.nightGain = ctx.createGain();
    this.nightGain.gain.value = 0;
    this.nightGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // 공용 노이즈 버퍼 (발소리·착지)
    const len = ctx.sampleRate * 0.25;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.startMusic();
    this.startAmbience();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : 0.5,
        this.ctx.currentTime + 0.15,
      );
    }
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* 프라이빗 모드 등에서 실패해도 무시 */
    }
    return this.muted;
  }

  // ---------- BGM ----------
  private pluck(freq: number, t: number, gain = 0.16) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(lp).connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  private pad(rootIdx: number, t: number, dur: number) {
    if (!this.ctx || !this.musicGain) return;
    // 루트 + 5도 + 옥타브의 부드러운 패드
    const freqs = [
      SCALE[rootIdx] / 2,
      SCALE[(rootIdx + 3) % SCALE.length] / 2,
      SCALE[rootIdx],
    ];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
  }

  private startMusic() {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.noteIndex = 0;
    this.schedulerTimer = setInterval(() => {
      if (!this.ctx) return;
      // 0.3초 앞까지 예약
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        const i = this.noteIndex % MELODY.length;
        const note = MELODY[i];
        if (note >= 0) this.pluck(SCALE[note], this.nextNoteTime);
        if (i % 16 === 0) {
          const chord = CHORDS[(i / 16) % CHORDS.length];
          this.pad(chord, this.nextNoteTime, BEAT * 16);
        }
        this.nextNoteTime += BEAT;
        this.noteIndex++;
      }
    }, 120);
  }

  // ---------- 앰비언스 ----------
  private chirp(t: number) {
    if (!this.ctx || !this.dayGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const f0 = 1800 + Math.random() * 900;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.65, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(this.dayGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private startAmbience() {
    if (!this.ctx || !this.nightGain) return;
    // 밤 풀벌레: 22Hz LFO로 트릴되는 고음 사인
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 4300;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 21;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.012;
    const g = this.ctx.createGain();
    g.gain.value = 0.012;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(g).connect(this.nightGain);
    osc.start();
    lfo.start();

    // 낮 새소리: 불규칙한 지저귐 묶음
    this.birdTimer = setInterval(() => {
      if (!this.ctx || !this.dayGain || this.dayGain.gain.value < 0.05) return;
      if (Math.random() < 0.55) {
        const t = this.ctx.currentTime + Math.random() * 0.3;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.chirp(t + i * 0.14);
      }
    }, 2600);
  }

  /** 낮밤 전환 시 앰비언스 크로스페이드 */
  setNight(isNight: boolean) {
    if (!this.ctx || !this.dayGain || !this.nightGain) return;
    const t = this.ctx.currentTime;
    this.dayGain.gain.linearRampToValueAtTime(isNight ? 0 : 1, t + 2.5);
    this.nightGain.gain.linearRampToValueAtTime(isNight ? 1 : 0, t + 2.5);
  }

  // ---------- SFX ----------
  /** 발소리 — 걸음마다 좌우 팬을 번갈아 살짝 이동 */
  footstep(running = false) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = running ? 1100 : 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(running ? 0.11 : 0.075, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    const pan = this.ctx.createStereoPanner();
    this.stepToggle = !this.stepToggle;
    pan.pan.value = this.stepToggle ? 0.15 : -0.15;
    src.connect(lp).connect(g).connect(pan).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.1);
  }

  jump() {
    this.blip(320, 620, 0.12, 0.08);
  }

  land() {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(lp).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.13);
  }

  /** 존 진입 차임 — 두 음 벨 */
  zoneChime() {
    if (!this.ctx) return;
    this.bell(784, 0);
    this.bell(1175, 0.14);
  }

  harvestPop() {
    this.blip(520, 880, 0.1, 0.1);
  }

  private bell(freq: number, delay: number) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + delay;
    for (const [mult, amp] of [
      [1, 0.09],
      [2.76, 0.03],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 1);
    }
  }

  private blip(f0: number, f1: number, dur: number, amp: number) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.03);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

/** 전역 싱글턴 — UI/월드 어디서든 import해 사용 */
export const audio = new VillageAudio();
