// robot js start

(() => {
  /* ===== সেটিং: শুধু এগুলো বদলাতে পারো ===== */
  const SEL = "#bannerpart"; // যে সেকশনের background এ robo.png আছে
  const IMG_W = 1918,
    IMG_H = 1080; // robo.png এর আসল সাইজ
  const MIN_X = 730; // ছবির এই px এর ডানে (রোবটের গায়ে) ক্লিক করলে কাজ করবে
  const EYES = [
    // চোখ (আসল ছবির px): x,y কেন্দ্র, w,h সাইজ, r = লেজারের ঢাল(deg)
    { x: 982, y: 517, w: 65, h: 102, r: -2 },
    { x: 1082, y: 512, w: 69, h: 113, r: 3 },
  ];

  // =========================================================================
  // [নোট - অটো-অফ]:
  // BREATHS বদলালেই সময় নিজে নিজে মিলে যাবে (3 = ৩ শ্বাস, 4 = ৪ শ্বাস, 5 = ৫ শ্বাস)।
  // শেষ শ্বাসে সাউন্ড, লেজার-চোখ ও গ্লো একসাথে ধীরে মিলিয়ে যায়।
  // ফেড ধীর/দ্রুত করতে FADE_LEN আর CSS-এর `2.3s` (ফেড-আউট অংশে) একসাথে বদলাও।
  // =========================================================================
  const BREATHS = 4; // মোট কয়টা শ্বাস শোনা যাবে (শেষ শ্বাসটা ধীরে মিলাবে)
  const FIRST_BREATH = 1.2; // ১ম শ্বাস শুরু (সেকেন্ড, ক্লিকের পর)
  const BREATH_LEN = 2.4; // প্রতি শ্বাসের দৈর্ঘ্য (সেকেন্ড)
  const FADE_LEN = 2.3; // শেষ শ্বাসে ফেড-আউটের সময় (সেকেন্ড)

  /* ===== অডিও ===== */
  let ctx,
    master,
    noise;
  function unlock() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      const n = ctx.sampleRate * 2,
        b = ctx.createBuffer(1, n, ctx.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noise = b;
    }
    if (ctx.state === "suspended") ctx.resume();
  }
  const G = (v, to) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (to) g.connect(to);
    return g;
  };
  function osc(type, f0, f1, t, dur, out, vol) {
    const o = ctx.createOscillator(),
      g = G(0, out);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  function hiss(t, dur, type, f0, f1, q, vol, out) {
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = G(0, out);
    s.buffer = noise;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  // স্টার্ট-আপ: ধাতব ক্র্যাশ + রিলে ক্লিক + সার্ভো হুইন + হুম
  function powerUp(t, bus) {
    osc("sine", 140, 32, t, 0.5, bus, 1.0); // থাম্প
    hiss(t, 0.4, "bandpass", 2200, 500, 0.8, 0.8, bus); // ক্র্যাশ
    [310, 487, 733, 1180, 1620].forEach((f) => osc("square", f, f * 0.98, t, 0.28, bus, 0.07)); // ধাতব ক্ল্যাংক
    [0.16, 0.27, 0.38].forEach((d) => hiss(t + d, 0.03, "highpass", 2500, 0, 1, 0.5, bus)); // রিলে ক্লিক
    const w = osc("sawtooth", 140, 950, t + 0.1, 0.6, bus, 0.0);
    w.disconnect();
    // সার্ভো হুইন (ছোট ছোট পালস)
    const sv = ctx.createOscillator(),
      bp = ctx.createBiquadFilter(),
      sg = G(0, bus);
    sv.type = "sawtooth";
    sv.frequency.setValueAtTime(140, t + 0.1);
    sv.frequency.exponentialRampToValueAtTime(950, t + 0.75);
    bp.type = "bandpass";
    bp.Q.value = 5;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1600, t + 0.75);
    [0.1, 0.27, 0.44, 0.6].forEach((d) => {
      sg.gain.setValueAtTime(0.16, t + d);
      sg.gain.setValueAtTime(0.03, t + d + 0.1);
    });
    sg.gain.setValueAtTime(0.0001, t + 0.8);
    sv.connect(bp);
    bp.connect(sg);
    sv.start(t + 0.1);
    sv.stop(t + 0.85);
    // হুম রাইজ
    const h = ctx.createOscillator(),
      lp = ctx.createBiquadFilter(),
      hg = G(0, bus);
    h.type = "sawtooth";
    h.frequency.setValueAtTime(50, t + 0.1);
    h.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    lp.type = "lowpass";
    lp.frequency.value = 420;
    hg.gain.setValueAtTime(0.0001, t + 0.1);
    hg.gain.linearRampToValueAtTime(0.3, t + 0.6);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    h.connect(lp);
    lp.connect(hg);
    h.start(t + 0.1);
    h.stop(t + 1.35);
    osc("square", 90, 90, t + 0.25, 0.25, bus, 0.06); // চোখ জ্বলার "জ্জ্জট"
  }

  // লেজার: চার্জ (0.25s) → জ্যাপ → বিম হাম
  function laser(t, bus) {
    osc("sine", 300, 1500, t, 0.25, bus, 0.16);
    const z = ctx.createOscillator(),
      lp = ctx.createBiquadFilter(),
      zg = G(0, bus),
      T = t + 0.25;
    z.type = "sawtooth";
    z.frequency.setValueAtTime(2200, T);
    z.frequency.exponentialRampToValueAtTime(160, T + 0.45);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5000, T);
    lp.frequency.exponentialRampToValueAtTime(600, T + 0.45);
    zg.gain.setValueAtTime(0.32, T);
    zg.gain.exponentialRampToValueAtTime(0.0001, T + 0.5);
    z.connect(lp);
    lp.connect(zg);
    z.start(T);
    z.stop(T + 0.55);
    hiss(T, 0.5, "bandpass", 3500, 1200, 1.2, 0.18, bus);
    [0.42, 0.7, 0.99, 1.28].forEach((d) => {
      osc("sawtooth", 2000, 220, T + d, 0.18, bus, 0.32);
      osc("sine", 1400, 160, T + d, 0.14, bus, 0.2);
      hiss(T + d, 0.08, "highpass", 3000, 0, 1, 0.12, bus);
    }); // প্রতিবার জ্বলার "পিউ"
    [110, 112.5].forEach((f) => {
      const o = ctx.createOscillator(),
        l = ctx.createBiquadFilter(),
        g = G(0, bus),
        lfo = ctx.createOscillator(),
        lg = G(0.05);
      o.type = "sawtooth";
      o.frequency.value = f;
      l.type = "lowpass";
      l.frequency.value = 700;
      lfo.frequency.value = 30;
      lfo.connect(lg);
      lg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, T);
      g.gain.linearRampToValueAtTime(0.1, T + 0.08);
      [
        [0.29, 0.01],
        [0.42, 0.1],
        [0.61, 0.01],
        [0.7, 0.1],
        [0.9, 0.02],
        [0.99, 0.1],
        [1.18, 0.01],
        [1.28, 0.1],
        [1.47, 0.03],
        [1.58, 0.0001],
      ].forEach(([d, v]) => g.gain.setValueAtTime(v, T + d)); // জ্বলে-নেভে-জ্বলে (বিমের সাথে মিলিয়ে)
      o.connect(l);
      l.connect(g);
      o.start(T);
      lfo.start(T);
      o.stop(T + 1.7);
      lfo.stop(T + 1.7);
    });
  }

  // রোবোটিক শ্বাস: ইনহেল/এক্সহেল + AM রাস্প
  function breath(t, bus) {
    const s = ctx.createBufferSource(),
      bp = ctx.createBiquadFilter(),
      am = G(0.55),
      env = G(0, bus),
      lfo = ctx.createOscillator(),
      lg = G(0.45);
    s.buffer = noise;
    s.loop = true;
    bp.type = "bandpass";
    bp.Q.value = 1.6;
    lfo.type = "square";
    lfo.frequency.value = 58;
    lfo.connect(lg);
    lg.connect(am.gain);
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1500, t + 0.9); // ইনহেল
    bp.frequency.setValueAtTime(1200, t + 1.1);
    bp.frequency.linearRampToValueAtTime(450, t + 2.2); // এক্সহেল
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.7);
    env.gain.linearRampToValueAtTime(0.0001, t + 1.0);
    env.gain.linearRampToValueAtTime(0.28, t + 1.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    s.connect(bp);
    bp.connect(am);
    am.connect(env);
    s.start(t, 0);
    lfo.start(t);
    s.stop(t + 2.4);
    lfo.stop(t + 2.4);
    osc("sine", 70, 70, t + 1.2, 1.0, bus, 0.04); // নিচু মোটর গুঞ্জন
  }

  function powerDown(t, bus) {
    osc("sawtooth", 500, 40, t, 0.7, bus, 0.18);
    hiss(t, 0.5, "lowpass", 1200, 80, 0.7, 0.3, bus);
  }

  /* ===== সেকশনের জন্য (background-size: cover ধরে) ===== */
  function init(el) {
    const ov = document.createElement("div");
    ov.className = "rfx";
    ov.innerHTML = '<i class="rfx-glow"></i>' + EYES.map(() => '<i class="rfx-beam"></i>').join("") + EYES.map(() => '<i class="rfx-eye"></i>').join("");
    el.appendChild(ov);
    const glow = ov.children[0],
      beams = [...ov.querySelectorAll(".rfx-beam")],
      eyes = [...ov.querySelectorAll(".rfx-eye")];
    let S = 1,
      OX = 0,
      OY = 0;
    const place = () => {
      const W = el.clientWidth,
        H = el.clientHeight;
      S = Math.max(W / IMG_W, H / IMG_H);
      OX = (W - IMG_W * S) / 2;
      OY = (H - IMG_H * S) / 2;
      Object.assign(ov.style, { left: 0, top: 0, width: W + "px", height: H + "px" });
      ov.style.setProperty("--u", (IMG_W * S) / 100 + "px");
      const cx = OX + 1032 * S,
        cy = OY + 515 * S;
      glow.style.background = `radial-gradient(ellipse ${IMG_W * S * 0.28}px ${IMG_H * S * 0.32}px at ${cx}px ${cy}px,rgba(255,20,40,.45),transparent 70%)`;
      EYES.forEach((e, i) => {
        const x = OX + e.x * S,
          y = OY + e.y * S;
        Object.assign(eyes[i].style, { left: x + "px", top: y + "px", width: e.w * S + "px", height: e.h * S + "px" });
        Object.assign(beams[i].style, { top: y + "px", width: x + "px" });
        beams[i].style.setProperty("--r", e.r + "deg");
      });
    };
    place();
    addEventListener("resize", place);
    addEventListener("load", place);
    if (window.ResizeObserver) new ResizeObserver(place).observe(el);

    let timer = null,
      laserTimer = null,
      autoOffTimer = null,
      nextB = 0,
      bus = null,
      active = false;

    function clearTimers() {
      clearInterval(timer);
      clearTimeout(laserTimer);
      clearTimeout(autoOffTimer);
      timer = null;
      laserTimer = null;
      autoOffTimer = null;
    }

    const restart = (n, cls) => {
      n.classList.remove(cls);
      void n.offsetWidth;
      n.classList.add(cls);
    };
    const inRobot = (e) => {
      if (e.target.closest && e.target.closest("a,button,input,textarea")) return false;
      const r = el.getBoundingClientRect();
      return (e.clientX - r.left - el.clientLeft - OX) / S >= MIN_X;
    };
    function pump() {
      if (!active || !ctx || !bus) return;
      while (nextB < ctx.currentTime + 1.5) {
        breath(nextB, bus);
        nextB += BREATH_LEN;
      }
    }
    function fire(e) {
      if (!inRobot(e)) return;
      if (active) return stop(); // ২য় ক্লিক = সাথে সাথে সব বন্ধ
      ov.classList.remove("fade-out");
      unlock();
      clearTimers();
      const t = ctx.currentTime + 0.03;
      active = true;
      bus = G(1, master); // ১ম ক্লিক: পুরো স্টার্ট-আপ
      nextB = t + FIRST_BREATH;
      timer = setInterval(pump, 400);
      pump();
      powerUp(t, bus);
      restart(ov, "on");

      laserTimer = setTimeout(() => {
        if (!active) return;
        restart(ov, "fire");
        laser(ctx.currentTime + 0.03, bus);
      }, 450);

      // শেষ শ্বাস শুরু হলে ধীরে ধীরে ফেড-আউট শুরু (সাউন্ড + লেজার/চোখ একসাথে)
      autoOffTimer = setTimeout(() => {
        if (active) stop(true);
      }, (FIRST_BREATH + (BREATHS - 1) * BREATH_LEN) * 1000);

      el.classList.remove("rfx-shake", "rfx-shake2");
      void el.offsetWidth;
      el.classList.add("rfx-shake");
    }
    function stop(fade) {
      if (!active) return;
      active = false;
      clearTimers();
      ov.classList.toggle("fade-out", !!fade);
      ov.classList.remove("on", "fire");
      if (ctx && bus) {
        const t = ctx.currentTime;
        const oldBus = bus;
        const d = fade ? FADE_LEN : 0.25;
        bus = null;
        oldBus.gain.cancelScheduledValues(t);
        oldBus.gain.setValueAtTime(oldBus.gain.value, t);
        oldBus.gain.linearRampToValueAtTime(0, t + d);
        if (!fade) powerDown(t, G(1, master)); // ক্লিকে বন্ধ করলে পাওয়ার-ডাউন সাউন্ড, অটো-অফে নয়
        setTimeout(() => oldBus.disconnect(), d * 1000 + 100);
      }
    }
    el.addEventListener("click", fire);
    document.addEventListener("visibilitychange", () => document.hidden && stop());
    el.addEventListener("mousemove", (e) => {
      el.style.cursor = inRobot(e) ? "pointer" : "";
    });
    el.addEventListener("animationend", (e) => e.target === el && el.classList.remove("rfx-shake", "rfx-shake2"));
  }
  document.querySelectorAll(SEL).forEach(init);
})();

// robot js end


// game-left js start

(() => {
  function init() {
    const box = document.querySelector(".game-left");
    if (!box) return;

    /* ---------- সময় (ms) ---------- */
    const BOMB_AT = 350; // বোমা উঠে ফাটে
    const SHOT_START = 420; // প্রথম গুলি
    const SHOT_GAP = 110; // দুই গুলির ফাঁক
    const SHOTS = 10;
    const BOMB_X = 514,
      BOMB_Y = -61; // বিস্ফোরণের কেন্দ্র (.game-left এর ভেতরে px)

    /* ---------- শব্দ (Web Audio) ---------- */
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx, master, noiseBuf, bus;

    function unlock() {
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7; // মোট আওয়াজ
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === "suspended") ctx.resume();
    }

    function noise(t, dur, type, f0, f1, vol) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(bus);
      src.start(t);
      src.stop(t + dur);
    }
    function thump(t, dur, f0, f1, vol) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + dur);
    }
    function boomSound(t) {
      noise(t, 1.0, "lowpass", 2000, 60, 1);
      thump(t, 0.7, 140, 30, 1);
      noise(t, 0.3, "highpass", 2500, 6000, 0.4);
    }
    function shotSound(t) {
      const k = 0.9 + Math.random() * 0.2;
      noise(t, 0.12, "bandpass", 2200 * k, 700, 0.6);
      thump(t, 0.08, 200 * k, 50, 0.5);
    }

    /* সব শব্দ আগে থেকেই ঠিক সময়ে সাজানো, ক্লিকের মুহূর্ত থেকে গোনা */
    function scheduleAudio(t0ms) {
      const go = () => {
        bus = ctx.createGain();
        bus.connect(master);
        const base = ctx.currentTime - (performance.now() - t0ms) / 1000;
        const at = (ms) => Math.max(ctx.currentTime, base + ms / 1000);
        boomSound(at(BOMB_AT));
        for (let i = 0; i < SHOTS; i++) shotSound(at(SHOT_START + i * SHOT_GAP));
        run.bus = bus;
      };
      if (ctx.state === "running") go();
      else ctx.resume().then(go);
    }

    /* ---------- বিস্ফোরণের স্পার্ক (canvas) ---------- */
    const S = 560;
    let cv,
      c2,
      parts = [],
      raf = 0,
      last = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);

    function fxInit() {
      if (cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv = document.createElement("canvas");
      cv.width = cv.height = S * dpr;
      cv.style.cssText = "position:absolute;pointer-events:none;width:" + S + "px;height:" + S + "px;left:" + (BOMB_X - S / 2) + "px;top:" + (BOMB_Y - S / 2) + "px";
      c2 = cv.getContext("2d");
      c2.scale(dpr, dpr);
      box.appendChild(cv);
    }

    function explode() {
      fxInit();
      const now = performance.now();
      parts.push({ k: "fire", t: now, life: 450 });
      for (let i = 0; i < 9; i++) parts.push({ k: "smoke", t: now, life: rnd(900, 1500), x: rnd(-25, 25), y: rnd(-25, 25), vx: rnd(-50, 50), vy: rnd(-70, -15), r: rnd(20, 40) });
      for (let i = 0; i < 80; i++) {
        const a = rnd(0, Math.PI * 2),
          sp = rnd(250, 750);
        parts.push({ k: "spark", t: now, life: rnd(450, 1000), x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, w: rnd(1.4, 3) });
      }
      for (let i = 0; i < 28; i++) {
        const a = rnd(0, Math.PI * 2),
          sp = rnd(60, 260);
        parts.push({ k: "ember", t: now, life: rnd(900, 1600), x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rnd(1.5, 3.2) });
      }
      if (!raf) {
        last = now;
        raf = requestAnimationFrame(loop);
      }
    }

    function loop(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const cx = S / 2,
        cy = S / 2;
      c2.clearRect(0, 0, S, S);
      parts = parts.filter((p) => now - p.t < p.life);

      c2.globalCompositeOperation = "source-over"; // ধোঁয়া
      for (const p of parts)
        if (p.k === "smoke") {
          const a = (now - p.t) / p.life;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const r = p.r * (1 + a * 2.4);
          const g = c2.createRadialGradient(cx + p.x, cy + p.y, 0, cx + p.x, cy + p.y, r);
          g.addColorStop(0, "rgba(70,60,55," + 0.32 * (1 - a) + ")");
          g.addColorStop(1, "rgba(40,35,35,0)");
          c2.fillStyle = g;
          c2.beginPath();
          c2.arc(cx + p.x, cy + p.y, r, 0, 7);
          c2.fill();
        }

      c2.globalCompositeOperation = "lighter"; // আগুন, স্পার্ক
      for (const p of parts) {
        const a = (now - p.t) / p.life;
        if (p.k === "fire") {
          const e = 1 - Math.pow(1 - a, 3);
          const r = 25 + 125 * e,
            al = 1 - a;
          const g = c2.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, "rgba(255,255,235," + al + ")");
          g.addColorStop(0.25, "rgba(255,215,90," + al * 0.9 + ")");
          g.addColorStop(0.6, "rgba(255,110,20," + al * 0.55 + ")");
          g.addColorStop(1, "rgba(200,30,0,0)");
          c2.fillStyle = g;
          c2.beginPath();
          c2.arc(cx, cy, r, 0, 7);
          c2.fill();
        } else if (p.k === "spark") {
          const drag = Math.pow(0.03, dt);
          p.vx *= drag;
          p.vy = p.vy * drag + 760 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          c2.strokeStyle = a < 0.3 ? "rgba(255,246,200," + (1 - a) + ")" : a < 0.6 ? "rgba(255,194,71," + (1 - a) + ")" : "rgba(255,106,26," + (1 - a) + ")";
          c2.lineWidth = p.w * (1 - a * 0.7);
          c2.lineCap = "round";
          c2.beginPath();
          c2.moveTo(cx + p.x - p.vx * 0.035, cy + p.y - p.vy * 0.035);
          c2.lineTo(cx + p.x, cy + p.y);
          c2.stroke();
        } else if (p.k === "ember") {
          const drag = Math.pow(0.15, dt);
          p.vx *= drag;
          p.vy = p.vy * drag + 130 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const fl = 0.6 + Math.random() * 0.4;
          const g = c2.createRadialGradient(cx + p.x, cy + p.y, 0, cx + p.x, cy + p.y, p.r * 4);
          g.addColorStop(0, "rgba(255,200,90," + (1 - a) * fl + ")");
          g.addColorStop(1, "rgba(255,90,10,0)");
          c2.fillStyle = g;
          c2.beginPath();
          c2.arc(cx + p.x, cy + p.y, p.r * 4, 0, 7);
          c2.fill();
        }
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
      if (!raf) c2.clearRect(0, 0, S, S);
    }

    function fxClear() {
      parts = [];
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (c2) c2.clearRect(0, 0, S, S);
    }

    /* ---------- গুলি ---------- */
    function make(cls) {
      const e = document.createElement("i");
      e.className = cls;
      e.addEventListener("animationend", () => e.remove());
      box.appendChild(e);
    }
    function shoot() {
      box.classList.add("firing");
      make("flash");
      make("bullet");
    }

    /* ---------- ক্রম ---------- */
    let timers = [],
      run = { bus: null },
      running = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    function fire() {
      // ক্লিকে: বোমা ওঠে + স্পার্ক + গুলি + শব্দ, সব একসাথে
      if (running) return;
      running = true;
      unlock(); // ক্লিক = ব্রাউজারের অনুমতি, তাই শব্দ আসবে
      const t0 = performance.now();
      box.classList.add("fire");
      scheduleAudio(t0);
      later(explode, BOMB_AT);
      for (let i = 0; i < SHOTS; i++) later(shoot, SHOT_START + i * SHOT_GAP);
      later(() => box.classList.remove("firing"), SHOT_START + SHOTS * SHOT_GAP);
      later(
        () => {
          running = false;
        },
        SHOT_START + SHOTS * SHOT_GAP + 300,
      );
    }

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      running = false;
      if (run.bus) {
        // বাকি শব্দ চুপ
        run.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        run.bus = null;
      }
      fxClear();
      box.classList.remove("on", "fire", "firing");
      box.querySelectorAll(".bullet, .flash").forEach((e) => e.remove());
    }

    box.addEventListener("mouseenter", () => box.classList.add("on")); // শুধু পোজ
    box.addEventListener("click", fire); // ক্লিকে অ্যাকশন
    box.addEventListener("mouseleave", reset);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

// game-left js end


// h1 js start
document.querySelectorAll(".hv").forEach((el) => {
  el.innerHTML = [...el.textContent].map((c, i) => `<span style="transition-delay:${i * 50}ms">${c === " " ? "&nbsp;" : c}</span>`).join("");
});

// h1 js end


/// logo p js start
(() => {
  const logo = document.getElementById("hancokLogo") || document.querySelector(".logo");
  const robot = document.getElementById("walkingRobot");
  if (!logo || !robot) return;

  const TEXT_VISIBLE_TIME = 1200; // p দেখা যাওয়ার পর রোবট নামা শুরু
  const STEP_INTERVAL = 400;

  let walkCtx = null, stepTimer = null, firstStep = null, startTimer = null;
  let active = false, stepCount = 0;

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!walkCtx) walkCtx = new AC();
    return walkCtx.state === "suspended" ? walkCtx.resume() : Promise.resolve();
  }

  function playStepSound(isLeftFoot) {
    if (!walkCtx) return;
    const t = walkCtx.currentTime;

    const osc = walkCtx.createOscillator();
    const gain = walkCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(isLeftFoot ? 172 : 196, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.085);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.21, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    osc.connect(gain);
    gain.connect(walkCtx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    const click = walkCtx.createOscillator();
    const clickGain = walkCtx.createGain();
    click.type = "sine";
    click.frequency.setValueAtTime(isLeftFoot ? 560 : 690, t);
    click.frequency.exponentialRampToValueAtTime(200, t + 0.028);
    clickGain.gain.setValueAtTime(0.001, t);
    clickGain.gain.linearRampToValueAtTime(0.06, t + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    click.connect(clickGain);
    clickGain.connect(walkCtx.destination);
    click.start(t);
    click.stop(t + 0.035);
  }

  function stopSound() {
    clearTimeout(firstStep);
    clearInterval(stepTimer);
    firstStep = null;
    stepTimer = null;
  }

  function resetAll() {
    active = false;
    stepCount = 0;
    clearTimeout(startTimer);
    startTimer = null;
    stopSound();
    logo.classList.remove("is-clicked", "is-dropping", "is-walking");
  }

  function turnOffByLogoClick() {
    resetAll();
    logo.classList.add("is-off");
    void robot.offsetWidth;
  }

  // p-র নিচের কিনারা মেপে রোবটের শুরু ও নামার দূরত্ব ঠিক করে
  function measure() {
    const p = logo.querySelector("p");
    const pb = p.offsetTop + p.offsetHeight;
    logo.style.setProperty("--pb", pb + "px");
    logo.style.setProperty("--dy", logo.offsetHeight + 96 - pb + "px");
  }

  function startWalking() {
    if (!active) return;
    logo.classList.remove("is-dropping");
    logo.classList.add("is-walking");     // পা নড়া + হাঁটা শুরু
    ensureAudio().then(() => {
      if (!active) return;
      firstStep = setTimeout(() => {      // পা প্রথম প্রান্তে পৌঁছালে (0.2s)
        if (!active) return;
        playStepSound(false);
        stepCount = 1;
        stepTimer = setInterval(() => {
          if (!active) return;
          playStepSound(stepCount % 2 === 1);
          stepCount++;
        }, STEP_INTERVAL);
      }, 200);
    });
  }

  function trigger() {
    // অ্যানিমেশন চলা অবস্থায় আবার লোগোতে ক্লিক করলে সঙ্গে সঙ্গে অফ
    if (active) {
      turnOffByLogoClick();
      return;
    }

    active = true;
    stepCount = 0;
    logo.classList.remove("is-off");
    ensureAudio();
    measure();

    logo.classList.remove("is-clicked", "is-dropping", "is-walking");
    void logo.offsetWidth;
    logo.classList.add("is-clicked");     // ১. p নামবে

    startTimer = setTimeout(() => {
      if (active) logo.classList.add("is-dropping"); // ২. p-র মাঝখানের নিচ থেকে রোবট বেরিয়ে নামবে, পা স্থির
    }, TEXT_VISIBLE_TIME);
  }

  logo.addEventListener("click", trigger);

  robot.addEventListener("animationend", (e) => {
    if (e.target !== robot) return;
    if (e.animationName === "drop") startWalking(); // ৩. নামা শেষ → হাঁটা + সাউন্ড
    if (e.animationName === "walk") resetAll();     // ৪. হাঁটা শেষ → সাউন্ডও শেষ
  });
})();
// logo p js end

// match part js start

document.querySelectorAll(".match").forEach((m) => {
  const s = m.querySelector(".score"),
    [a, b] = s.textContent.split(":").map(Number);
  s.innerHTML = `<span class="${a > b ? "w" : ""}">${a}</span>:<span class="${b > a ? "w" : ""}">${b}</span>`;
  if (a === b) return;
  m.classList.add("has-win");
  m.querySelector(a > b ? ".team-left" : ".team-right").classList.add("win");
});

// match part js end


// vedio part js start

const videoCards = document.querySelectorAll('.video');

videoCards.forEach(card => {
  const curtainLeft = card.querySelector('.curtain-left');
  const curtainRight = card.querySelector('.curtain-right');

  // মাউস নিলে (Hover In)
  card.addEventListener('mouseenter', () => {
    // ১. পর্দা ওপর থেকে নিচে নেমে আসবে (ছবি ঢেকে ফেলবে)
    curtainLeft.style.transition = 'transform 0.3s ease-out';
    curtainRight.style.transition = 'transform 0.3s ease-out';
    curtainLeft.style.transform = 'translateY(0) scaleX(1)';
    curtainRight.style.transform = 'translateY(0) scaleX(1)';

    // ২. ০.৩ সেকেন্ড পর পর্দা দুপাশে সরে গিয়ে বাঁধা পড়বে
    setTimeout(() => {
      card.classList.add('curtains-closed');
    }, 300);
  });

  // মাউস সরালে (Hover Out)
  card.addEventListener('mouseleave', () => {
    // ১. পর্দা দুপাশ থেকে মাঝখানে এসে ছবি ঢেকে ফেলবে
    card.classList.remove('curtains-closed');

    // ২. ০.৩ সেকেন্ড পর পর্দা ওপরে উঠে যাবে
    setTimeout(() => {
      curtainLeft.style.transform = 'translateY(-100%) scaleX(1)';
      curtainRight.style.transform = 'translateY(-100%) scaleX(1)';
    }, 300);
  });
});



// vedio part js start





// copy right js start

(function () {
  var ctx;
  var colors = ["#FF0000", "#00E5FF", "#FFFF00", "#0000FF", "#FFFFFF", "#FF7700"];
  var trans = [
    "translateZ(55px)", "rotateY(180deg) translateZ(55px)",
    "rotateY(90deg) translateZ(55px)", "rotateY(-90deg) translateZ(55px)",
    "rotateX(90deg) translateZ(55px)", "rotateX(-90deg) translateZ(55px)"
  ];

  var rubik = document.getElementById("rubik");
  if (rubik && rubik.children.length === 0) {
    trans.forEach(function (t, f) {
      var face = document.createElement("div");
      face.className = "face";
      face.style.transform = t;
      face.innerHTML = ("<i style='background:" + colors[f] + "'></i>").repeat(9);
      rubik.appendChild(face);
    });
  }

  function tone(freq, delay, vol) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.7);
    } catch (e) {}
  }

  function robotStepSound(stepIndex) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      var now = ctx.currentTime;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = (stepIndex % 2 === 0) ? "square" : "sawtooth";

      var startFreq = (stepIndex % 2 === 0) ? 260 : 310;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  function startRoboticWalkSound(durationMs, stepIntervalMs) {
    var elapsed = 0;
    var stepIndex = 0;
    robotStepSound(stepIndex++);
    elapsed += stepIntervalMs;

    var timer = setInterval(function () {
      if (elapsed >= durationMs) {
        clearInterval(timer);
        return;
      }
      robotStepSound(stepIndex++);
      elapsed += stepIntervalMs;
    }, stepIntervalMs);
  }

  function spark(k) {
    var b = document.getElementById("sparkBox");
    if (!b) return;
    var cols = ["#FFD700", "#FFFFFF", "#FFAA00", "#FF4655", "#00E5FF", "#FF7700"];
    b.innerHTML = "";
    for (var i = 0; i < 70; i++) {
      var s = document.createElement("div"), c = cols[i % 6];
      var a = Math.random() * 2 * Math.PI, d = 120 + Math.random() * 200;
      s.className = "spark";
      s.style.background = c;
      s.style.boxShadow = "0 0 8px " + c + ",0 0 16px #fff";
      b.appendChild(s);
      s.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "translate(" + Math.cos(a) * d + "px," + Math.sin(a) * d + "px) scale(0)", opacity: 0 }
        ],
        { duration: 1100 * k, easing: "ease-out", fill: "forwards" }
      );
    }
  }

  function setLowerFooterDimmed(active) {
    var lowerTargets = document.querySelectorAll("#foot-part .foot-flex, #foot-part .foot-copy");
    lowerTargets.forEach(function (el) {
      el.classList.toggle("footer-dimmed", active);
    });
  }

  window.openCube = function () {
    var box = document.getElementById("cubeBox");
    if (!box || box.classList.contains("show")) return;

    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--k")) || 1;
    box.classList.remove("open", "go", "back", "bot-rise", "bot-wave", "bot-walk");

    setLowerFooterDimmed(true);
    tone(800, 0, 0.15);
    box.classList.add("show");

    setTimeout(function () {
      box.classList.add("open");
      tone(600, 0, 0.2);
    }, 1400 * k);

    setTimeout(function () {
      var copyEl = document.querySelector(".foot-copy");
      var r = box.getBoundingClientRect();
      var line = copyEl ? copyEl.getBoundingClientRect().top : (r.bottom + 40);
      box.style.setProperty("--dy", (line - 55 - (r.top + r.height / 2)) + "px");
      box.classList.add("go");
      spark(k);
      [1318, 1567, 2093, 2637, 3135, 3920].forEach(function (f, i) { tone(f, i * 0.09, 0.22); });
    }, 2400 * k);

    setTimeout(function () {
      box.classList.add("back");
      box.classList.remove("open", "go");
      var sb = document.getElementById("sparkBox");
      if (sb) sb.innerHTML = "";
    }, 4900 * k);

    setTimeout(function () {
      box.classList.add("bot-rise", "bot-wave");
      tone(1046, 0, 0.15);
      tone(1568, 0.15, 0.18);
    }, 5900 * k);

    setTimeout(function () {
      box.classList.remove("bot-wave");
      box.classList.add("bot-walk");
      tone(880, 0, 0.12); tone(660, 0.2, 0.12);
      startRoboticWalkSound(1900 * k, 220 * k);
    }, 7200 * k);

    setTimeout(function () {
      box.classList.remove("show", "back", "bot-rise", "bot-wave", "bot-walk");
      setLowerFooterDimmed(false);
    }, 9200 * k);
  };
})();

// Copyright JS End