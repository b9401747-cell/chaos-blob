(() => {
  'use strict';

  // ---------- DOM ----------
  const stage = document.getElementById('stage');
  const blob = document.getElementById('blob');
  const blobShadow = document.getElementById('blobShadow');
  const eyes = document.getElementById('eyes');
  const mouth = document.getElementById('mouth');
  const scoreVal = document.getElementById('scoreVal');
  const bestVal = document.getElementById('bestVal');
  const comboVal = document.getElementById('comboVal');
  const comboBlock = document.getElementById('comboBlock');
  const comboBar = document.getElementById('comboBar');
  const soundBtn = document.getElementById('soundBtn');
  const themeBtn = document.getElementById('themeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');
  const hint = document.getElementById('hint');
  const rainbowOverlay = document.getElementById('rainbowOverlay');
  const secretBadge = document.getElementById('secretBadge');
  const clickCountEl = document.getElementById('clickCount');
  const bgGlow = document.getElementById('bgGlow');
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');

  // ---------- persisted state ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    }
  };

  let best = store.get('chaosblob_best', 0);
  let totalPokes = store.get('chaosblob_totalPokes', 0);
  let muted = store.get('chaosblob_muted', false);
  let theme = store.get('chaosblob_theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  bestVal.textContent = best;
  clickCountEl.textContent = totalPokes;
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  soundBtn.textContent = muted ? '🔇' : '🔊';

  // ---------- game state ----------
  let score = 0;
  let combo = 1;
  let comboDeadline = 0;
  const COMBO_WINDOW = 1400;
  let hue = 260;

  // ---------- canvas sizing ----------
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  function resizeCanvas() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ---------- physics state ----------
  const RADIUS = 80;
  let stageRect = stage.getBoundingClientRect();
  window.addEventListener('resize', () => { stageRect = stage.getBoundingClientRect(); });

  let pos = { x: stageRect.width / 2, y: stageRect.height * 0.42 };
  let vel = { x: 0, y: 0 };
  let squish = { x: 1, y: 1 };
  let rotation = 0;
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let pointerHistory = [];
  let pokeStart = null;

  const GRAVITY = 0.75;
  const FRICTION = 0.992;

  // ---------- audio ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playPop(pitch) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, pitch * 0.5), t0 + 0.12);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }
  function playFanfare() {
    if (muted || !audioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t0 = audioCtx.currentTime + i * 0.09;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    });
  }

  // ---------- particles ----------
  let particles = [];
  function burst(x, y, opts = {}) {
    const count = opts.count || 14;
    const colors = opts.colors || [`hsl(${hue} 90% 70%)`, `hsl(${(hue + 40) % 360} 90% 70%)`, '#fff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.speed || 4) * (0.4 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts.up || 0),
        life: 1,
        decay: 0.012 + Math.random() * 0.015,
        size: (opts.size || 5) * (0.6 + Math.random() * 0.8),
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: opts.shape || (Math.random() > 0.5 ? 'circle' : 'square'),
        spin: (Math.random() - 0.5) * 0.3
      });
    }
  }

  function stepParticles() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.rot = (p.rot || 0) + p.spin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  // ---------- floating text ----------
  function floatText(x, y, text, big) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.fontWeight = '800';
    el.style.fontSize = big ? '28px' : '18px';
    el.style.color = big ? '#ff6cab' : `hsl(${hue} 80% 55%)`;
    el.style.textShadow = '0 2px 8px rgba(0,0,0,0.25)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '15';
    el.style.transition = 'transform 0.7s ease-out, opacity 0.7s ease-out';
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -160%)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 750);
  }

  // ---------- toast ----------
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  const roasts = [
    "ow.", "again.", "you good?", "poke champion 🏆", "it's ticklish", "bloop.",
    "the blob feels nothing", "certified clicker", "why though", "*wobbles*",
    "unstoppable", "no thoughts, just poking", "the blob respects this", "squish squad"
  ];
  const milestones = [
    [50, "50! warming up 🔥"],
    [150, "150! the blob is scared now"],
    [300, "300! actual dedication"],
    [600, "600! get a hobby (this is your hobby)"],
    [1000, "1000! LEGENDARY POKER"],
    [2500, "2500! the blob has ascended"],
    [5000, "5000?! okay champion, go touch grass"]
  ];
  const hitMilestones = new Set();

  // ---------- expression ----------
  function setExpression(tier) {
    eyes.querySelectorAll('.eye').forEach(e => {
      e.style.transform = '';
      e.style.height = '14px';
      e.style.borderRadius = '50%';
    });
    mouth.style.border = '';
    mouth.style.background = 'transparent';
    if (tier === 0) {
      mouth.style.width = '30px';
      mouth.style.height = '14px';
      mouth.style.borderRadius = '0 0 16px 16px';
    } else if (tier === 1) {
      mouth.style.width = '38px';
      mouth.style.height = '20px';
      mouth.style.borderRadius = '0 0 24px 24px';
    } else if (tier === 2) {
      mouth.style.width = '44px';
      mouth.style.height = '26px';
      mouth.style.borderRadius = '0 0 30px 30px';
      eyes.querySelectorAll('.eye').forEach(e => { e.style.height = '10px'; e.style.borderRadius = '50% 50% 60% 60%'; });
    } else {
      mouth.style.width = '50px';
      mouth.style.height = '30px';
      mouth.style.borderRadius = '26px';
      mouth.style.border = 'none';
      mouth.style.background = '#221933';
      eyes.querySelectorAll('.eye').forEach(e => { e.style.transform = 'rotate(20deg) scaleY(0.6)'; });
    }
  }

  // ---------- konami ----------
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiBuf = [];
  window.addEventListener('keydown', (e) => {
    konamiBuf.push(e.key);
    konamiBuf = konamiBuf.slice(-konami.length);
    if (konamiBuf.join(',') === konami.join(',')) {
      triggerSecret();
    }
  });

  function triggerSecret() {
    secretBadge.hidden = false;
    secretBadge.style.animation = 'none';
    void secretBadge.offsetWidth;
    secretBadge.style.animation = '';
    rainbowOverlay.hidden = false;
    ensureAudio();
    playFanfare();
    burst(pos.x + stageRect.left, pos.y + stageRect.top, { count: 60, speed: 9, up: 4 });
    score += 500;
    updateScore();
    showToast('🎉 SECRET CODE! +500 bonus points!');
    setTimeout(() => { secretBadge.hidden = true; }, 1800);
    setTimeout(() => { rainbowOverlay.hidden = true; }, 5000);
  }

  // ---------- scoring ----------
  function updateScore() {
    scoreVal.textContent = score;
    if (score > best) {
      best = score;
      store.set('chaosblob_best', best);
      bestVal.textContent = best;
    }
    for (const [m, msg] of milestones) {
      if (score >= m && !hitMilestones.has(m)) {
        hitMilestones.add(m);
        showToast(msg);
      }
    }
  }

  function poke(clientX, clientY) {
    if (hint.style.opacity !== '0') hint.style.opacity = '0';
    ensureAudio();
    const now = performance.now();
    if (now < comboDeadline) {
      combo++;
    } else {
      combo = 1;
    }
    comboDeadline = now + COMBO_WINDOW;

    const gained = Math.min(combo, 60);
    score += gained;
    totalPokes++;
    store.set('chaosblob_totalPokes', totalPokes);
    clickCountEl.textContent = totalPokes;
    updateScore();

    comboVal.textContent = 'x' + combo;
    comboBlock.classList.add('pulse');
    setTimeout(() => comboBlock.classList.remove('pulse'), 150);

    hue = (260 + combo * 6) % 360;
    blob.style.setProperty('--blob-hue', hue);
    document.documentElement.style.setProperty('--blob-hue', hue);

    playPop(220 + Math.min(combo, 40) * 8);

    squish.x = 1.25; squish.y = 0.75;

    burst(clientX, clientY, { count: 8 + Math.min(combo, 20), speed: 3 + combo * 0.15 });
    floatText(clientX, clientY - 30, '+' + gained, combo % 10 === 0);

    let tier = 0;
    if (combo >= 30) tier = 3;
    else if (combo >= 15) tier = 2;
    else if (combo >= 5) tier = 1;
    setExpression(tier);

    if (tier === 3) {
      stage.classList.add('shake');
      setTimeout(() => stage.classList.remove('shake'), 350);
    }

    if (totalPokes % 7 === 0) {
      showToast(roasts[Math.floor(Math.random() * roasts.length)]);
    }
  }

  // ---------- pointer interaction (drag + fling + poke) ----------
  blob.addEventListener('pointerdown', (e) => {
    ensureAudio();
    dragging = true;
    blob.classList.add('grabbing');
    blob.setPointerCapture(e.pointerId);
    const rect = blob.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left - rect.width / 2;
    dragOffset.y = e.clientY - rect.top - rect.height / 2;
    pointerHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    pokeStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    vel.x = 0; vel.y = 0;
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    pos.x = e.clientX - stageRect.left - dragOffset.x;
    pos.y = e.clientY - stageRect.top - dragOffset.y;
    pointerHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (pointerHistory.length > 6) pointerHistory.shift();
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    blob.classList.remove('grabbing');

    const dist = pokeStart ? Math.hypot(e.clientX - pokeStart.x, e.clientY - pokeStart.y) : 999;
    const dt = pokeStart ? performance.now() - pokeStart.t : 999;

    if (dist < 8 && dt < 350) {
      poke(e.clientX, e.clientY);
      vel.x = (Math.random() - 0.5) * 4;
      vel.y = -4;
    } else if (pointerHistory.length >= 2) {
      const first = pointerHistory[0];
      const last = pointerHistory[pointerHistory.length - 1];
      const ddt = Math.max(16, last.t - first.t);
      vel.x = ((last.x - first.x) / ddt) * 16;
      vel.y = ((last.y - first.y) / ddt) * 16;
      vel.x = Math.max(-40, Math.min(40, vel.x));
      vel.y = Math.max(-40, Math.min(40, vel.y));
      if (Math.hypot(vel.x, vel.y) > 6) {
        burst(e.clientX, e.clientY, { count: 10, speed: 5 });
        playPop(300);
      }
    }
  });

  // ---------- controls ----------
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    store.set('chaosblob_muted', muted);
    soundBtn.textContent = muted ? '🔇' : '🔊';
    ensureAudio();
  });

  themeBtn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    store.set('chaosblob_theme', theme);
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });

  resetBtn.addEventListener('click', () => {
    score = 0;
    combo = 1;
    comboDeadline = 0;
    hitMilestones.clear();
    updateScore();
    comboVal.textContent = 'x1';
    setExpression(0);
    showToast('score reset — go again!');
  });

  // ---------- main loop ----------
  function loop() {
    if (!dragging) {
      vel.y += GRAVITY;
      pos.x += vel.x;
      pos.y += vel.y;
      vel.x *= FRICTION;

      const floor = stageRect.height - RADIUS - 12;
      if (pos.y > floor) {
        pos.y = floor;
        if (Math.abs(vel.y) > 1.2) {
          vel.y *= -0.52;
          squish.x = 1.3; squish.y = 0.7;
        } else {
          vel.y = 0;
        }
      }
      if (pos.y < RADIUS) { pos.y = RADIUS; vel.y *= -0.5; }
      if (pos.x < RADIUS) { pos.x = RADIUS; vel.x *= -0.6; }
      if (pos.x > stageRect.width - RADIUS) { pos.x = stageRect.width - RADIUS; vel.x *= -0.6; }
    }

    squish.x += (1 - squish.x) * 0.18;
    squish.y += (1 - squish.y) * 0.18;
    rotation = Math.max(-18, Math.min(18, vel.x * 0.8));

    blob.style.left = pos.x + 'px';
    blob.style.top = pos.y + 'px';
    blob.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${squish.x}, ${squish.y})`;

    const floorY = stageRect.height - RADIUS - 12;
    const heightRatio = Math.max(0, Math.min(1, (floorY - pos.y) / (stageRect.height * 0.5)));
    blobShadow.style.left = pos.x + 'px';
    blobShadow.style.top = (floorY + RADIUS - 6) + 'px';
    const shadowScale = 1 - heightRatio * 0.5;
    blobShadow.style.transform = `translate(-50%, -50%) scale(${shadowScale})`;
    blobShadow.style.opacity = String(0.55 - heightRatio * 0.3);

    const now = performance.now();
    const remaining = now < comboDeadline ? (comboDeadline - now) / COMBO_WINDOW : 0;
    comboBar.style.width = (remaining * 100) + '%';

    stepParticles();
    requestAnimationFrame(loop);
  }

  setExpression(0);
  requestAnimationFrame(loop);
})();
