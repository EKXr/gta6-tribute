// All sound is synthesized with WebAudio: no audio files, nothing fetched. Short oscillator
// and noise blips cover the effects (punch, shot, pickup, cash, door, crash, mission sting),
// a two-tone siren loops while the player is wanted, and a slow minor-key bass-and-pad loop
// plays as the city's music. The context is created lazily on the first user gesture, as
// browsers require; until then every call is a no-op. M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let sirenNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    startMusic();
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ensure()) return;
    const t0 = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay = 0) {
    if (!ensure()) return;
    const t0 = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter).connect(gain).connect(master);
    source.start(t0);
  }

  // A lazy eight-bar loop: a low bass line walks a minor progression while a soft pad
  // chord changes every two bars. Scheduled a bar at a time from a lookahead timer.
  const BASS = [55, 55, 65.4, 55, 49, 49, 58.3, 73.4];
  const PADS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  function scheduleBar() {
    if (!context) return;
    const bar = musicStep % 8;
    const bass = BASS[bar];
    for (let beat = 0; beat < 4; beat += 1) tone(bass * (beat % 2 ? 2 : 1), 0.22, 'triangle', 0.16, 0, beat * 0.24);
    if (bar % 2 === 0) {
      const chord = PADS[(bar / 2) % PADS.length];
      for (const note of chord) tone(note, 1.7, 'sine', 0.045);
    }
    musicStep += 1;
  }

  function startMusic() {
    if (musicTimer !== null) return;
    scheduleBar();
    musicTimer = window.setInterval(scheduleBar, 960);
  }

  function setSiren(on) {
    if (on && sirenNodes === null) {
      if (!ensure()) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      osc.type = 'square';
      osc.frequency.value = 840;
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0.028;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } else if (!on && sirenNodes !== null) {
      try {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
      } catch {
        // Already stopped: nothing to clean up beyond dropping the reference.
      }
      sirenNodes = null;
    }
  }

  return {
    unlock() {
      ensure();
    },
    punch() {
      noise(0.08, 0.5, 900);
      tone(140, 0.09, 'sine', 0.4, 60);
    },
    shot() {
      noise(0.16, 0.7, 2400);
      tone(220, 0.1, 'sawtooth', 0.25, 40);
    },
    dryFire() {
      tone(1200, 0.04, 'square', 0.12);
    },
    door() {
      tone(320, 0.07, 'square', 0.15, 210);
      tone(210, 0.09, 'square', 0.15, 160, 0.07);
    },
    cash() {
      tone(880, 0.09, 'square', 0.18);
      tone(1320, 0.14, 'square', 0.18, 0, 0.08);
    },
    pickup() {
      tone(520, 0.08, 'triangle', 0.3, 780);
    },
    crash(strength) {
      noise(0.25, Math.min(0.8, 0.25 + strength / 220), 700);
      tone(90, 0.22, 'sine', 0.4, 40);
    },
    sting(win) {
      const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      notes.forEach((note, i) => tone(note, 0.22, 'triangle', 0.3, 0, i * 0.13));
    },
    hurt() {
      tone(300, 0.15, 'sawtooth', 0.3, 120);
    },
    setSiren,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
