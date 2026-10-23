/* ==========================================================================
   PC3D - Trình xem 3D thùng PC cho PC Builder (Three.js r147, không cần build)
   - Dựng thùng case + từng linh kiện bằng hình học thủ tục (procedural).
   - Linh kiện chưa chọn hiện dạng "khung ma" (ghost) để gợi ý vị trí lắp.
   - Hỗ trợ xoay/zoom, tháo kính, bật/tắt RGB + nguồn, hover/click chọn linh kiện.
   API:  const v = PC3D.create(container, { getProduct, onPick });
         v.update(build, issues[])  |  v.highlight(cat|null)
   ========================================================================== */
(function () {
  "use strict";

  const T = window.THREE;
  const PC3D = { supported: !!T };
  window.PC3D = PC3D;
  if (!T) return;

  /* ------------------------------------------------------------------ */
  /*  Hằng số & bảng style                                              */
  /* ------------------------------------------------------------------ */
  const PART_CATS = ["Mainboard", "CPU", "Cooler", "RAM", "GPU", "SSD", "HDD", "PSU"];
  const ALL_CATS = ["CPU", "Cooler", "Mainboard", "RAM", "GPU", "SSD", "HDD", "PSU", "Case"];

  const BRAND = {
    AMD: "#ed1c24", Intel: "#0a8cff", ASUS: "#22b8f0", MSI: "#ff3b3b", Corsair: "#ffd21f",
    Kingston: "#e11d2e", Samsung: "#2f54eb", WD: "#1d8cf8", DeepCool: "#19d3c5", NZXT: "#a78bfa",
    Seagate: "#6ee06a", NVIDIA: "#76b900"
  };
  const brandColor = (b) => BRAND[b] || "#38bdf8";

  const BOARDS = {
    ATX: { w: 24.4, h: 30.5, pcieTop: 18.5 },
    mATX: { w: 24.4, h: 24.4, pcieTop: 14.5 },
    ITX: { w: 17.0, h: 17.0, pcieTop: 10.0 }
  };

  const CASE_DEFAULT = { L: 44, H: 45, W: 22, ff: "ATX", color: 0x1a1d24, trim: 0x2b303b, fans: 2, fanRgb: false, isDefault: true };

  function caseStyle(p) {
    if (!p) return CASE_DEFAULT;
    const s = Object.assign({}, CASE_DEFAULT, { isDefault: false, ff: p.formFactor || "ATX" });
    if (s.ff === "mATX") { s.L = 39.5; s.H = 38.5; s.W = 21.5; }
    else if (s.ff === "ITX") { s.L = 34; s.H = 32; s.W = 20; }
    else { s.L = 46.5; s.H = 46.5; s.W = 23; }
    const white = /white|trắng/i.test(p.name) || p.id === 16;
    if (white) { s.color = 0xe6e9ee; s.trim = 0xc9ced8; s.white = true; }
    else { s.color = 0x15181e; s.trim = 0x242932; }
    if (p.id === 16) s.fans = 2;
    return s;
  }

  /* ------------------------------------------------------------------ */
  /*  Helper chung                                                      */
  /* ------------------------------------------------------------------ */
  const hexNum = (s) => (typeof s === "number" ? s : parseInt(String(s).replace("#", ""), 16));
  const mStd = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.35 }, o || {}));
  const mBasic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));

  function bx(w, h, d, m, x, y, z) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }
  function cylY(rt, rb, h, m, seg) {
    return new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 32), m);
  }
  function cylZ(r, h, m, seg) {
    const o = cylY(r, r, h, m, seg);
    o.rotation.x = Math.PI / 2;
    return o;
  }
  const noRay = () => {};

  const texCache = new Map();
  function canvasTexture(key, w, h, draw) {
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    t.userData.keep = true;
    texCache.set(key, t);
    return t;
  }

  /** Texture nhãn dán: o = {bg, grad, border, lines:[{t,size,color,weight,y,x,align}]} */
  function labelTexture(key, w, h, o) {
    return canvasTexture(key, w, h, (g) => {
      g.clearRect(0, 0, w, h);
      if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
      if (o.grad) {
        const gr = g.createLinearGradient(0, 0, w, 0);
        o.grad.forEach((c, i) => gr.addColorStop(i / (o.grad.length - 1), c));
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      if (o.border) { g.strokeStyle = o.border; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); }
      (o.lines || []).forEach((l) => {
        g.font = `${l.weight || 800} ${l.size}px Inter, "Segoe UI", Arial, sans-serif`;
        g.fillStyle = l.color || "#fff";
        g.textAlign = l.align || "center";
        g.textBaseline = "middle";
        g.fillText(l.t, l.x == null ? w / 2 : l.x, l.y == null ? h / 2 : l.y, w * 0.94);
      });
    });
  }

  function labelPlane(w, h, tex, basic) {
    const m = basic
      ? mBasic(0xffffff, { map: tex, transparent: true })
      : mStd(0xffffff, { map: tex, transparent: true, roughness: 0.5, metalness: 0.15 });
    return new T.Mesh(new T.PlaneGeometry(w, h), m);
  }

  /** Mặt nhãn hướng về -X (mặt trước case) / +X; chữ đọc từ dưới lên như thanh RAM thật */
  function sideLabel(w, h, tex, dir, x, y, z) {
    const grp = new T.Group();
    const pl = labelPlane(w, h, tex);
    pl.rotation.z = Math.PI / 2;
    grp.add(pl);
    grp.rotation.y = dir < 0 ? -Math.PI / 2 : Math.PI / 2;
    grp.position.set(x, y, z);
    return grp;
  }

  function rgbify(m, o) {
    m.userData.rgb = Object.assign({ offset: 0, scale: 1, target: m.emissive ? "emissive" : "color" }, o || {});
    return m;
  }

  function disposeTree(root) {
    root.traverse((n) => {
      if (n.geometry && !n.geometry.userData.keep) n.geometry.dispose();
      if (n.material) {
        (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
          ["map", "alphaMap", "emissiveMap"].forEach((k) => {
            if (m[k] && !m[k].userData.keep) m[k].dispose();
          });
          if (!m.userData.keep) m.dispose();
        });
      }
    });
  }

  function tube(points, r, m, seg) {
    const curve = new T.CatmullRomCurve3(points);
    return new T.Mesh(new T.TubeGeometry(curve, seg || 48, r, 8, false), m);
  }

  /* ------------------------------------------------------------------ */
  /*  Textures thủ tục                                                  */
  /* ------------------------------------------------------------------ */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function pcbTexture(base) {
    return canvasTexture("pcb-" + base, 512, 640, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const r = rng(7);
      g.lineWidth = 1.4;
      for (let i = 0; i < 120; i++) {
        let x = r() * w, y = r() * h;
        g.strokeStyle = `rgba(120,180,210,${0.07 + r() * 0.1})`;
        g.beginPath(); g.moveTo(x, y);
        const n = 3 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const t = r();
          if (t < 0.4) x += (r() - 0.5) * 140; else if (t < 0.8) y += (r() - 0.5) * 140;
          else { const d = (r() - 0.5) * 70; x += d; y += d; }
          g.lineTo(x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(210,180,100,${0.12 + r() * 0.2})`;
        g.beginPath(); g.arc(r() * w, r() * h, 1.6, 0, 7); g.fill();
      }
    });
  }

  function finTexture() {
    return canvasTexture("fins", 16, 8, (g, w, h) => {
      g.fillStyle = "#e4e8ee"; g.fillRect(0, 0, w / 2, h);
      g.fillStyle = "#6f7885"; g.fillRect(w / 2, 0, w / 2, h);
    });
  }

  function grillTexture() {
    return canvasTexture("grill", 64, 64, (g, w, h) => {
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#000";
      [[16, 16], [48, 16], [32, 48], [0, 48], [64, 48]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 9.5, 0, 7); g.fill(); });
    });
  }

  function glassStreakTexture() {
    return canvasTexture("streak", 256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const draw = (x0, wd, a) => {
        const gr = g.createLinearGradient(x0, 0, x0 + wd, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.save(); g.translate(w / 2, h / 2); g.rotate(-0.55); g.translate(-w / 2, -h / 2);
        g.fillRect(x0 - 200, -200, wd + 400 > 0 ? wd : wd, h + 400);
        g.restore();
      };
      draw(60, 40, 0.55); draw(130, 18, 0.35); draw(190, 60, 0.22);
    });
  }

  function blobTexture() {
    return canvasTexture("blob", 256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(0,0,0,.65)");
      gr.addColorStop(0.55, "rgba(0,0,0,.28)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Quạt                                                              */
  /* ------------------------------------------------------------------ */
  function makeFan(size, o) {
    o = o || {};
    const g = new T.Group();
    const frameMat = mStd(o.frame || 0x12151a, { roughness: 0.7, metalness: 0.25 });
    const h = size / 2;
    const s = new T.Shape();
    s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.lineTo(-h, -h);
    const hole = new T.Path(); hole.absarc(0, 0, size * 0.455, 0, Math.PI * 2, true); s.holes.push(hole);
    const fg = new T.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: false, curveSegments: 28 });
    fg.translate(0, 0, -1.25);
    g.add(new T.Mesh(fg, frameMat));

    const rotor = new T.Group();
    rotor.userData.spin = o.spin == null ? 11 : o.spin;
    const bladeMat = o.rgb
      ? rgbify(mStd(0x1c2128, { roughness: 0.5, metalness: 0.2, emissive: 0x000000, transparent: true, opacity: 0.92 }), { offset: o.offset || 0, scale: 0.55 })
      : mStd(0x1d2127, { roughness: 0.6, metalness: 0.2 });
    for (let i = 0; i < 9; i++) {
      const b = new T.Group();
      b.rotation.z = (i / 9) * Math.PI * 2;
      const blade = bx(size * 0.34, size * 0.21, 0.12, bladeMat, size * 0.3, 0, 0);
      blade.rotation.x = 0.55;
      b.add(blade);
      rotor.add(b);
    }
    const hub = cylZ(size * 0.17, 2.0, mStd(0x0b0d10, { roughness: 0.4, metalness: 0.6 }), 24);
    rotor.add(hub);
    if (o.rgb) {
      const cap = new T.Mesh(new T.CircleGeometry(size * 0.11, 24), rgbify(mBasic(0x000000), { offset: (o.offset || 0) + 0.08 }));
      cap.position.z = 1.02;
      rotor.add(cap);
    }
    g.add(rotor);

    if (o.rgb) {
      const ring = new T.Mesh(new T.TorusGeometry(size * 0.462, 0.14, 8, 48), rgbify(mBasic(0x000000), { offset: o.offset || 0 }));
      ring.position.z = 1.2;
      g.add(ring);
      const ring2 = ring.clone();
      ring2.material = ring.material;
      ring2.position.z = -1.2;
      g.add(ring2);
    }
    return g;
  }
  const orientFan = (fan, axis) => {
    if (axis === "x") fan.rotation.y = Math.PI / 2;
    else if (axis === "y") fan.rotation.x = Math.PI / 2;
    return fan;
  };

  /* ------------------------------------------------------------------ */
  /*  Layout (vị trí chuẩn của case + mainboard)                        */
  /* ------------------------------------------------------------------ */
  function computeLayout(build, get) {
    const cp = build.Case ? get(build.Case) : null;
    const mp = build.Mainboard ? get(build.Mainboard) : null;
    const cs = caseStyle(cp);
    const ff = (mp && mp.formFactor) || cs.ff;
    const bd = BOARDS[ff] || BOARDS.ATX;
    const o = { cs, ff, bd, caseP: cp, key: (cp ? cp.id : 0) + "|" + ff };
    o.L = cs.L; o.H = cs.H; o.W = cs.W;
    o.floorY = -o.H / 2 + 0.6; o.topY = o.H / 2 - 0.6;
    o.frontX = -o.L / 2 + 0.8; o.rearX = o.L / 2 - 0.6;
    o.zs = -o.W / 2 + 3.6; o.glassZ = o.W / 2 - 0.4;
    o.bw = bd.w; o.bh = bd.h;
    o.ytop = o.H / 2 - 6.7;
    o.xr = o.rearX - 0.8;
    o.bx = o.xr - bd.w / 2;
    o.by = o.ytop - bd.h / 2;
    o.pcieY = o.ytop - bd.pcieTop;
    o.m2Y = o.pcieY + 3;
    o.sy = o.pcieY + 8.5;
    o.sx = o.xr - 9.5;
    o.shroudTop = o.pcieY - 5.9;
    o.psuX1 = o.rearX - 0.3; o.psuX0 = o.psuX1 - 16;
    o.psuZ = (o.zs + o.glassZ) / 2;
    return o;
  }

  /* ------------------------------------------------------------------ */
  /*  Khung case                                                        */
  /* ------------------------------------------------------------------ */
  function buildCaseFrame(Lo) {
    const cs = Lo.cs, L = Lo.L, H = Lo.H, W = Lo.W;
    const g = new T.Group();
    g.userData.cat = "Case";
    const steel = mStd(cs.color, { roughness: 0.48, metalness: 0.6 });
    const trim = mStd(cs.trim, { roughness: 0.42, metalness: 0.65 });
    const lineMat = new T.LineBasicMaterial({ color: cs.white ? 0x9aa3b2 : 0x3b4351, transparent: true, opacity: 0.8 });
    const edge = (mesh) => {
      const l = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), lineMat);
      l.position.copy(mesh.position); l.raycast = noRay; g.add(l);
    };
    const add = (m) => (g.add(m), m);

    // Khay mainboard (tấm sau) + mặt khay tối + các lỗ đi dây
    add(bx(L, H, 0.5, steel, 0, 0, -W / 2 + 0.25));
    const tray = add(bx(L - 1.2, H - 1.2, 0.04, mStd(cs.white ? 0xc3c9d3 : 0x0d0f13, { roughness: 0.8, metalness: 0.4 }), 0, 0, -W / 2 + 0.52));
    tray.raycast = noRay;
    const hole = mBasic(0x020304);
    const cut = (w, h, x, y) => { const c = new T.Mesh(new T.PlaneGeometry(w, h), hole); c.position.set(x, y, -W / 2 + 0.55); c.raycast = noRay; g.add(c); };
    cut(11, 11, Lo.sx, Lo.sy);                                   // lỗ backplate tản CPU
    cut(2.6, 9, Lo.xr - 24.4 + 3.2, Lo.ytop - 11);               // lỗ dây 24-pin
    cut(2.6, 7, Lo.xr - 3.4, Lo.ytop - 0.5);                      // lỗ dây CPU 8-pin
    cut(10, 2.4, Lo.sx - 2, Lo.shroudTop + 3);                    // lỗ dây gầm

    // Nóc / đáy / chân
    const top = add(bx(L, 0.6, W, steel, 0, H / 2 - 0.3, 0)); edge(top);
    const bot = add(bx(L, 0.6, W, steel, 0, -H / 2 + 0.3, 0)); edge(bot);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      add(bx(4.2, 1.5, 2.4, mStd(0x0b0c0e, { roughness: 0.9, metalness: 0.1 }), sx * (L / 2 - 4.5), -H / 2 - 0.75, sz * (W / 2 - 3)));
    });
    // Nóc: khe thoát khí
    const vent = new T.Mesh(new T.PlaneGeometry(L * 0.5, W * 0.62), mStd(0x07080a, { roughness: 0.9 }));
    vent.rotation.x = -Math.PI / 2; vent.position.set(L * 0.1, H / 2 + 0.02, 0); vent.raycast = noRay; g.add(vent);

    // Mặt sau
    const rear = add(bx(0.6, H, W, steel, L / 2 - 0.3, 0, 0)); edge(rear);
    for (let i = 0; i < 7; i++) {   // nẹp khe PCIe
      add(bx(0.2, 1.7, 1.6, mStd(0x07080a, { roughness: 0.8 }), L / 2 + 0.05, Lo.pcieY - 0.4 - i * 2.03, Lo.zs + 5.2));
    }
    // Quạt thoát phía sau
    const rfan = makeFan(12, { rgb: false });
    orientFan(rfan, "x");
    rfan.position.set(Lo.rearX - 1.25, H / 2 - 6.6, Lo.zs + 10);
    g.add(rfan);

    // Mặt trước dạng lưới + quạt hút
    const gt = grillTexture().clone();
    gt.userData = {};
    gt.needsUpdate = true;
    gt.wrapS = gt.wrapT = T.RepeatWrapping;
    gt.repeat.set(W / 1.5, H / 1.5);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(W, H),
      mStd(cs.color, { roughness: 0.55, metalness: 0.5, alphaMap: gt, alphaTest: 0.5, side: T.DoubleSide })
    );
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.set(-L / 2 + 0.4, 0, 0);
    g.add(mesh);
    add(bx(0.8, 1.4, W, trim, -L / 2 + 0.4, H / 2 - 0.7, 0));
    add(bx(0.8, 1.4, W, trim, -L / 2 + 0.4, -H / 2 + 0.7, 0));
    add(bx(0.8, H, 0.8, trim, -L / 2 + 0.4, 0, W / 2 - 0.4));
    add(bx(0.8, H, 0.8, trim, -L / 2 + 0.4, 0, -W / 2 + 0.4));
    add(bx(0.8, H, 0.8, trim, L / 2 - 0.4, 0, W / 2 - 0.4));

    const nF = cs.fans || 2;
    for (let i = 0; i < nF; i++) {
      const f = makeFan(12, { rgb: !!cs.fanRgb, offset: i * 0.12 });
      orientFan(f, "x");
      f.position.set(Lo.frontX + 1.25, Lo.topY - 6.3 - i * 12.2, 0);
      g.add(f);
    }
    // Đèn nguồn nhỏ ở mặt trước
    const pled = new T.Mesh(new T.CircleGeometry(0.28, 16), mBasic(0x38bdf8));
    pled.rotation.y = -Math.PI / 2; pled.position.set(-L / 2 - 0.02, H / 2 - 4, W / 2 - 3); pled.raycast = noRay; g.add(pled);
    g.userData.powerLed = pled;

    // Gầm PSU (kính khói)
    const shH = Lo.shroudTop - Lo.floorY;
    const shL = Lo.rearX - (Lo.frontX + 3.2);
    const smoke = new T.Mesh(
      new T.BoxGeometry(shL, shH, Lo.glassZ - 0.6 - (-W / 2 + 1.0)),
      mStd(0x070a10, { roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.55, depthWrite: false })
    );
    smoke.position.set((Lo.rearX + Lo.frontX + 3.2) / 2, Lo.floorY + shH / 2, (Lo.glassZ - 0.6 + (-W / 2 + 1.0)) / 2);
    smoke.raycast = noRay;
    smoke.renderOrder = 2;
    g.add(smoke);
    const shEdge = new T.LineSegments(new T.EdgesGeometry(smoke.geometry), new T.LineBasicMaterial({ color: 0x4b5668, transparent: true, opacity: 0.7 }));
    shEdge.position.copy(smoke.position); shEdge.raycast = noRay; g.add(shEdge);
    const shLed = bx(shL * 0.9, 0.18, 0.18, rgbify(mBasic(0x000000), { offset: 0.5 }), smoke.position.x, Lo.shroudTop - 0.15, Lo.glassZ - 0.8);
    shLed.raycast = noRay; g.add(shLed);

    // Kính cường lực (xoay bản lề / tháo)
    const glassGroup = new T.Group();
    glassGroup.position.set(0, 0, 0);
    const gw = L - 1.6, gh = H - 1.6;
    const glassMat = new T.MeshPhysicalMaterial({
      color: 0x9cc3da, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.0,
      clearcoat: 1, clearcoatRoughness: 0.05, side: T.DoubleSide, depthWrite: false
    });
    const glass = new T.Mesh(new T.BoxGeometry(gw, gh, 0.35), glassMat);
    glass.position.set(0.1, 0, W / 2 - 0.2);
    glass.raycast = noRay;
    glass.renderOrder = 5;
    glassGroup.add(glass);
    const gEdge = new T.LineSegments(new T.EdgesGeometry(glass.geometry), new T.LineBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.55 }));
    gEdge.position.copy(glass.position); gEdge.raycast = noRay; glassGroup.add(gEdge);
    const streak = new T.Mesh(
      new T.PlaneGeometry(gw * 0.98, gh * 0.98),
      new T.MeshBasicMaterial({ map: glassStreakTexture(), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false })
    );
    streak.position.set(0.1, 0, W / 2 + 0.05);
    streak.raycast = noRay; streak.renderOrder = 6;
    glassGroup.add(streak);
    g.add(glassGroup);
    g.userData.glass = { group: glassGroup, mat: glassMat, edge: gEdge.material, streak: streak.material };

    // Đèn nội thất đổi màu theo RGB
    const light = new T.PointLight(0x38bdf8, 0.0, 70, 1.6);
    light.position.set(Lo.sx - 4, Lo.sy - 4, Lo.zs + 7);
    g.add(light);
    g.userData.light = light;
    const light2 = new T.PointLight(0xffffff, 0.35, 90, 1.4);
    light2.position.set(0, H / 2 - 3, W / 2 - 2);
    g.add(light2);

    g.userData.size = { L, H, W };
    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  Builders cho từng linh kiện                                       */
  /* ------------------------------------------------------------------ */
  const BUILD = {};
  const GHOST = {};

  /* ---------- Mainboard ---------- */
  function moboStyle(p) {
    if (p.brand === "ASUS") return { pcb: "#101319", sink: 0xaeb4bf, accent: "#22d3ee", dark: false };
    if (p.brand === "MSI") return { pcb: "#0b0d11", sink: 0x2a2e36, accent: "#ef4444", dark: true };
    return { pcb: "#0d1015", sink: 0x3a404b, accent: brandColor(p.brand), dark: true };
  }

  BUILD.Mainboard = (Lo, p) => {
    const st = moboStyle(p);
    const g = new T.Group();
    const add = (m) => (g.add(m), m);
    const { bw, bh, zs, sx, sy, xr, ytop, pcieY, m2Y } = Lo;
    const bX = Lo.bx, bY = Lo.by;

    const edgeMat = mStd(0x050608, { roughness: 0.6, metalness: 0.2 });
    const topMat = mStd(0xffffff, { map: pcbTexture(st.pcb), roughness: 0.5, metalness: 0.2 });
    const pcb = new T.Mesh(new T.BoxGeometry(bw, bh, 0.17), [edgeMat, edgeMat, edgeMat, edgeMat, topMat, edgeMat]);
    pcb.position.set(bX, bY, zs - 0.085);
    add(pcb);

    const slotMat = mStd(0x16191f, { roughness: 0.6, metalness: 0.3 });
    const sinkMat = mStd(st.sink, { roughness: 0.38, metalness: 0.85 });
    const darkMat = mStd(0x0a0b0d, { roughness: 0.7, metalness: 0.3 });
    const silver = mStd(0xaab2bd, { roughness: 0.3, metalness: 0.9 });
    const accentMat = mBasic(hexNum(st.accent));

    // Socket + ILM
    add(bx(7.4, 7.4, 0.6, mStd(0x1a1d23, { roughness: 0.5, metalness: 0.6 }), sx, sy, zs + 0.3));
    add(bx(4.7, 4.7, 0.06, mStd(0x4b3f22, { roughness: 0.35, metalness: 0.9 }), sx, sy, zs + 0.62));
    add(bx(6.6, 0.55, 0.3, silver, sx, sy + 3.0, zs + 0.75));
    add(bx(6.6, 0.55, 0.3, silver, sx, sy - 3.0, zs + 0.75));
    add(bx(0.55, 6.0, 0.3, silver, sx - 3.0, sy, zs + 0.75));
    add(bx(0.55, 6.0, 0.3, silver, sx + 3.0, sy, zs + 0.75));
    add(cylY(0.13, 0.13, 4.6, silver, 10)).position.set(sx - 3.55, sy - 1.2, zs + 0.9);

    // Tản nhiệt VRM
    const vrmA = add(bx(7.8, 1.7, 3.0, sinkMat, sx - 0.8, sy + 4.6, zs + 1.5));
    add(bx(7.8, 0.12, 3.02, accentMat, sx - 0.8, sy + 4.6, zs + 1.52)).scale.set(1, 1, 0.02);
    for (let i = 0; i < 6; i++) add(bx(0.12, 1.72, 3.02, darkMat, sx - 4.0 + i * 1.3, sy + 4.6, zs + 1.5));
    add(bx(1.6, 7.7, 2.7, sinkMat, sx + 5.0, sy - 0.65, zs + 1.35));
    for (let i = 0; i < 5; i++) add(bx(1.62, 0.12, 2.72, darkMat, sx + 5.0, sy - 3.4 + i * 1.5, zs + 1.35));
    vrmA.castShadow = false;

    // Cổng IO phía sau
    add(bx(5.0, 11.5, 3.2, mStd(0x15171b, { roughness: 0.5, metalness: 0.7 }), xr - 0.7, ytop - 6.55, zs + 1.6));
    const portCols = [0x2563eb, 0x0f0f12, 0x0f0f12, 0xdc2626, 0x0f0f12, 0x16a34a, 0xf59e0b, 0x0f0f12];
    portCols.forEach((c, i) => add(bx(0.12, 1.1, 1.5, mStd(c, { roughness: 0.5 }), xr + 1.82, ytop - 1.8 - i * 1.25, zs + 0.9 + (i % 2) * 1.6)));
    add(bx(2.4, 1.0, 1.5, darkMat, xr - 4.3, ytop - 1.1, zs + 0.75));    // 8-pin CPU

    // Chipset
    add(bx(4.6, 4.6, 1.2, sinkMat, xr - 14, pcieY - 3.0, zs + 0.6));
    const chipTex = labelTexture("chip-" + p.id, 256, 256, {
      lines: [
        { t: p.brand.toUpperCase(), size: 54, y: 90, color: st.dark ? "#e5e7eb" : "#1f2937" },
        { t: p.name.replace(new RegExp("^" + p.brand + "\\s*", "i"), "").toUpperCase().slice(0, 18), size: 24, y: 150, color: st.accent, weight: 700 }
      ]
    });
    const cl = labelPlane(4.2, 4.2, chipTex); cl.position.set(xr - 14, pcieY - 3.0, zs + 1.215); g.add(cl);

    // Khe RAM
    for (let i = 0; i < 4; i++) {
      const x = sx - 7.0 - i * 0.75;
      add(bx(0.55, 13.5, 1.0, slotMat, x, sy, zs + 0.5));
      add(bx(0.4, 0.5, 0.5, silver, x, sy + 7.0, zs + 0.5));
      add(bx(0.4, 0.5, 0.5, silver, x, sy - 7.0, zs + 0.5));
    }
    // Khe PCIe + M.2 + SATA + 24-pin
    add(bx(8.9, 1.0, 1.1, slotMat, xr - 5.8, pcieY - 0.55, zs + 0.55));
    add(bx(2.5, 1.0, 1.1, slotMat, xr - 2.7, pcieY - 2.58, zs + 0.55));
    add(bx(8.9, 1.0, 1.1, slotMat, xr - 5.8, pcieY - 4.61, zs + 0.55));
    add(bx(0.6, 2.0, 0.6, darkMat, sx + 4.6, m2Y, zs + 0.3));
    add(cylZ(0.28, 0.5, silver, 12)).position.set(sx - 4.6, m2Y, zs + 0.25);
    add(bx(1.6, 5.2, 1.5, mStd(0xdad3bf, { roughness: 0.6, metalness: 0.1 }), Lo.xr - bw + 1.2, ytop - 11, zs + 0.75));
    add(bx(1.4, 3.6, 1.1, darkMat, Lo.xr - bw + 1.4, pcieY - 3.5, zs + 0.55));
    add(bx(1.4, 3.6, 1.1, darkMat, Lo.xr - bw + 3.4, pcieY - 3.5, zs + 0.55));
    // Pin CMOS
    add(cylZ(1.1, 0.5, silver, 24)).position.set(xr - 8.5, pcieY - 6.8, zs + 0.3);
    return g;
  };
  GHOST.Mainboard = (Lo) => ghostGroup("Mainboard", [{ w: Lo.bw, h: Lo.bh, d: 0.5, x: Lo.bx, y: Lo.by, z: Lo.zs + 0.1 }]);

  /* ---------- CPU ---------- */
  BUILD.CPU = (Lo, p) => {
    const g = new T.Group();
    const lga = p.socket && /LGA/i.test(p.socket);
    const w = lga ? 4.5 : 4.2, h = lga ? 3.75 : 4.2;
    const { sx, sy, zs } = Lo;
    g.add(bx(w + 0.35, h + 0.35, 0.1, mStd(0x0f6a4a, { roughness: 0.6, metalness: 0.2 }), sx, sy, zs + 0.72));
    g.add(bx(w, h, 0.26, mStd(0xd2d7de, { roughness: 0.22, metalness: 0.95 }), sx, sy, zs + 0.9));
    const m = p.name.match(/(Ryzen\s\d|Core\si\d)/i);
    const model = p.name.replace(/^(AMD|Intel)\s*/i, "").replace(/(Ryzen\s\d|Core\si\d)[\s-]*/i, "");
    const tex = labelTexture("cpu-" + p.id, 256, 256, {
      lines: [
        { t: m ? m[1].toUpperCase() : p.brand.toUpperCase(), size: 38, y: 100, color: "#2b303a" },
        { t: model.toUpperCase().slice(0, 12), size: 36, y: 150, color: "#3b4350", weight: 700 }
      ]
    });
    const lab = labelPlane(w * 0.85, h * 0.85, tex); lab.position.set(sx, sy, zs + 1.035); g.add(lab);
    return g;
  };
  GHOST.CPU = (Lo) => ghostGroup("CPU", [{ w: 4.4, h: 4.4, d: 0.5, x: Lo.sx, y: Lo.sy, z: Lo.zs + 0.95 }]);

  /* ---------- Tản nhiệt ---------- */
  function isAIO(p) { return /aio|ls\d{3}|nước|liquid|\b(240|280|360)\b/i.test(p.name + " " + p.description); }

  BUILD.Cooler = (Lo, p) => {
    const g = new T.Group();
    const { sx, sy, zs, H, rearX } = Lo;
    const metal = mStd(0xb8bfca, { roughness: 0.3, metalness: 0.9 });

    if (!isAIO(p)) {
      /* ----- Tản khí tháp đôi (kiểu AK620) ----- */
      const z0 = zs + 1.3;
      const height = 14.7;
      g.add(bx(6.4, 6.4, 1.2, mStd(0x8a5a33, { roughness: 0.35, metalness: 0.9 }), sx, sy, z0 + 0.4));
      const finT = finTexture().clone(); finT.userData = {}; finT.needsUpdate = true;
      finT.wrapS = finT.wrapT = T.RepeatWrapping; finT.repeat.set(26, 1);
      const finMat = mStd(0xffffff, { map: finT, roughness: 0.35, metalness: 0.85 });
      const sideMat = mStd(0x9aa3b0, { roughness: 0.4, metalness: 0.85 });
      const stackMats = [sideMat, sideMat, finMat, finMat, finMat, finMat];
      const sA = new T.Mesh(new T.BoxGeometry(3.8, 13.8, height), stackMats);
      sA.position.set(sx - 6.45 + 2.5 + 1.9, sy, z0 + 1.0 + height / 2);
      const sB = new T.Mesh(new T.BoxGeometry(4.1, 13.8, height), stackMats);
      sB.position.set(sx + 6.45 - 2.05, sy, z0 + 1.0 + height / 2);
      g.add(sA); g.add(sB);
      // Ống đồng
      const cu = mStd(0xc2703a, { roughness: 0.25, metalness: 1.0 });
      for (let i = 0; i < 6; i++) {
        const c = cylZ(0.3, 1.4, cu, 10);
        c.position.set(sx - 2.5 + i * 1.0, sy - 0.6 + (i % 2) * 1.2, z0 + 0.9);
        g.add(c);
      }
      // Nắp trên + logo
      const capMat = mStd(0x0f1217, { roughness: 0.3, metalness: 0.8 });
      const capA = bx(3.8, 13.8, 0.35, capMat, sA.position.x, sy, z0 + 1.0 + height + 0.17);
      const capB = bx(4.1, 13.8, 0.35, capMat, sB.position.x, sy, z0 + 1.0 + height + 0.17);
      g.add(capA); g.add(capB);
      const tex = labelTexture("cool-" + p.id, 256, 256, {
        lines: [{ t: p.brand.toUpperCase(), size: 34, y: 100, color: "#e5e7eb" }, { t: p.name.replace(p.brand, "").trim().toUpperCase(), size: 44, y: 160, color: brandColor(p.brand) }]
      });
      const lp = labelPlane(3.6, 3.6, tex); lp.position.set(sB.position.x, sy, z0 + 1.0 + height + 0.37); g.add(lp);
      // 2 quạt
      const f1 = orientFan(makeFan(12, { frame: 0x0b0d10 }), "x"); f1.position.set(sx - 6.45 + 1.25, sy, z0 + 1.0 + 6.4); g.add(f1);
      const f2 = orientFan(makeFan(12, { frame: 0x0b0d10 }), "x"); f2.position.set(sx - 6.45 + 2.5 + 3.8 + 1.25, sy, z0 + 1.0 + 6.4); g.add(f2);
      f1.position.z = f2.position.z = z0 + 1.0 + 7.4;
      f1.scale.set(1, 1, 1);
    } else {
      /* ----- AIO 240mm: pump + radiator nóc + 2 quạt ARGB ----- */
      const pz = zs + 1.2 + 2.6;
      const pump = new T.Group();
      pump.add(cylZ(3.9, 5.2, mStd(0x0e1116, { roughness: 0.25, metalness: 0.7 }), 40));
      const mirror = new T.Mesh(new T.CircleGeometry(3.2, 40), rgbify(mBasic(0x000000), { offset: 0.2 }));
      mirror.position.z = 2.62; pump.add(mirror);
      const inner = new T.Mesh(new T.CircleGeometry(2.4, 40), mStd(0x07090c, { roughness: 0.1, metalness: 0.9 }));
      inner.position.z = 2.64; pump.add(inner);
      const ringP = new T.Mesh(new T.RingGeometry(2.4, 2.9, 48), rgbify(mBasic(0x000000), { offset: 0.35 }));
      ringP.position.z = 2.65; pump.add(ringP);
      const logoTex = labelTexture("aio-" + p.id, 256, 256, {
        lines: [{ t: p.brand.toUpperCase(), size: 38, y: 120, color: "#e5e7eb" }]
      });
      const lg = labelPlane(3.8, 3.8, logoTex, true); lg.position.z = 2.67; pump.add(lg);
      pump.position.set(sx, sy, pz);
      g.add(pump);

      const radL = 27.5, radW = 12, radT = 2.7;
      const radCx = rearX - 1.6 - radL / 2;
      const radY = H / 2 - 0.6 - radT / 2;
      const radZ = zs + 8.4;
      const radMat = mStd(0x12151a, { roughness: 0.45, metalness: 0.7 });
      g.add(bx(radL, radT, radW, radMat, radCx, radY, radZ));
      g.add(bx(radL + 0.2, 0.3, radW + 0.2, metal, radCx, radY - radT / 2 + 0.1, radZ));
      g.add(bx(radL + 0.2, 0.3, radW + 0.2, metal, radCx, radY + radT / 2 - 0.1, radZ));
      g.add(bx(2.0, radT * 0.95, radW * 0.9, mStd(0x0a0c10, { roughness: 0.5, metalness: 0.5 }), radCx - radL / 2 - 0.9, radY, radZ));
      for (let i = 0; i < 2; i++) {
        const f = orientFan(makeFan(12, { rgb: true, offset: 0.1 + i * 0.12 }), "y");
        f.position.set(radCx - 6.9 + i * 13.8, radY - radT / 2 - 1.25, radZ);
        g.add(f);
      }
      const sleeve = mStd(0x0a0b0e, { roughness: 0.85, metalness: 0.1 });
      const hx = radCx - radL / 2 - 1.7;
      const hose = (dz) => tube([
        new T.Vector3(sx - 1.4, sy + 3.6, pz + dz * 0.4),
        new T.Vector3(sx - 2.2, sy + 7.5, pz + 1.8 + dz),
        new T.Vector3(hx + 3.5, radY - 2.0, radZ + dz + 1.2),
        new T.Vector3(hx + 0.5, radY - 0.4, radZ + dz * 1.4)
      ], 0.62, sleeve, 56);
      g.add(hose(-1.9)); g.add(hose(1.9));
      g.userData.aioRadius = true;
    }
    return g;
  };
  GHOST.Cooler = (Lo) => ghostGroup("Cooler", [{ w: 12.9, h: 13.8, d: 15.5, x: Lo.sx, y: Lo.sy, z: Lo.zs + 1.3 + 7.8 }]);

  /* ---------- RAM ---------- */
  function ramCount(p) {
    const m = (p.description || "").match(/(\d)\s*x\s*\d+\s*GB/i) || p.name.match(/(\d)\s*x\s*\d+\s*GB/i);
    return m ? Math.min(4, +m[1]) : 1;
  }
  BUILD.RAM = (Lo, p) => {
    const g = new T.Group();
    const n = ramCount(p);
    const ddr5 = p.ramType === "DDR5";
    const hgt = p.brand === "Corsair" ? 4.4 : 3.6;
    const acc = brandColor(p.brand);
    const body = mStd(0x15171b, { roughness: 0.35, metalness: 0.8 });
    const top = mStd(0x0b0c0e, { roughness: 0.4, metalness: 0.7 });
    const accM = mBasic(hexNum(acc));
    const idx = [1, 3, 0, 2].slice(0, n);
    const tex = labelTexture("ram-" + p.id, 512, 128, {
      grad: ["#101216", "#181b21", "#101216"],
      lines: [
        { t: p.name.replace(/\s*(DDR\d)?\s*\d+GB/i, "").replace(/^(Corsair|Kingston)\s*/i, "").toUpperCase().slice(0, 20), size: 46, y: 46, color: "#f3f4f6" },
        { t: (p.ramType || "") + "  ·  " + ((p.name.match(/\d+GB/i) || [""])[0]), size: 30, y: 94, color: acc, weight: 700 }
      ]
    });
    idx.forEach((i) => {
      const x = Lo.sx - 7.0 - i * 0.75;
      const z = Lo.zs + 0.5 + hgt / 2;
      const stick = new T.Group();
      stick.add(bx(0.62, 13.3, hgt, body, x, Lo.sy, z));
      stick.add(bx(0.7, 13.1, 0.3, top, x, Lo.sy, z + hgt / 2 - 0.02));
      stick.add(bx(0.74, 12.0, 0.1, accM, x, Lo.sy, z + hgt / 2 + 0.1));
      stick.add(sideLabel(12.4, hgt * 0.72, tex, -1, x - 0.33, Lo.sy, z - 0.2));
      stick.add(sideLabel(12.4, hgt * 0.72, tex, 1, x + 0.33, Lo.sy, z - 0.2));
      // PCB lộ ra dưới tản
      stick.add(bx(0.5, 13.3, 0.5, mStd(ddr5 ? 0x0a3d2b : 0x0a2a3d, { roughness: 0.6 }), x, Lo.sy, Lo.zs + 0.3));
      g.add(stick);
    });
    return g;
  };
  GHOST.RAM = (Lo) => ghostGroup("RAM", [1, 3].map((i) => ({ w: 0.7, h: 13.3, d: 4.0, x: Lo.sx - 7.0 - i * 0.75, y: Lo.sy, z: Lo.zs + 2.5 })));

  /* ---------- GPU ---------- */
  const GPU_STYLE = {
    4: { thick: 5.0, h: 13.4, shroud: 0x15181d, accent: "#e5e7eb", led: false },
    5: { thick: 5.5, h: 13.7, shroud: 0x101216, accent: "#ef4444", led: true },
    6: { thick: 4.2, h: 12.2, shroud: 0x12151a, accent: "#38bdf8", led: false }
  };
  BUILD.GPU = (Lo, p) => {
    const st = Object.assign({ thick: 5.0, h: 13, shroud: 0x14171c, accent: brandColor(p.brand), led: false }, GPU_STYLE[p.id] || {});
    const len = (p.gpuLength || 300) / 10;
    const g = new T.Group();
    const rearX = Lo.xr + 0.5;
    const cx = rearX - len / 2;
    const cy = Lo.pcieY - 0.1 - st.thick / 2;
    const z0 = Lo.zs + 0.4;
    const cz = z0 + st.h / 2;

    const shroud = mStd(st.shroud, { roughness: 0.4, metalness: 0.65 });
    const plate = mStd(0x23272e, { roughness: 0.3, metalness: 0.9 });
    const sideTex = labelTexture("gpu-" + p.id, 1024, 170, {
      grad: ["#0d0f13", "#171a20", "#0d0f13"],
      lines: [
        { t: (p.brand + " · " + p.name.replace(/^NVIDIA\s*/i, "")).toUpperCase().slice(0, 34), size: 58, y: 62, color: "#f3f4f6", x: 520 },
        { t: "GEFORCE  ·  " + (p.description.match(/\d+GB\s*GDDR\d\w?/i) || ["GDDR"])[0].toUpperCase(), size: 34, y: 124, color: st.accent, weight: 700, x: 520 }
      ]
    });
    const sideMat = mStd(0xffffff, { map: sideTex, roughness: 0.4, metalness: 0.5 });
    const mats = [shroud, shroud, plate, shroud, sideMat, shroud];
    const body = new T.Mesh(new T.BoxGeometry(len, st.thick, st.h), mats);
    body.position.set(cx, cy, cz);
    g.add(body);

    // Khung chi tiết: gờ + khe thoát nhiệt phía backplate
    g.add(bx(len, 0.25, st.h * 0.98, mStd(0x0b0c0f, { roughness: 0.5, metalness: 0.8 }), cx, cy + st.thick / 2 + 0.02, cz));
    for (let i = 0; i < 9; i++) g.add(bx(len * 0.07, 0.06, st.h * 0.7, mStd(0x050608), cx - len * 0.35 + i * len * 0.09, cy + st.thick / 2 + 0.16, cz));
    // Đầu card phía trước
    g.add(bx(0.2, st.thick * 0.9, st.h * 0.9, mStd(0x090a0c, { roughness: 0.6 }), cx - len / 2 - 0.1, cy, cz));
    // Bracket phía sau
    g.add(bx(0.25, st.thick + 0.6, st.h * 0.95, mStd(0xc4c9d1, { roughness: 0.3, metalness: 0.95 }), rearX + 0.1, cy, z0 + st.h * 0.475));
    for (let i = 0; i < 3; i++) g.add(bx(0.28, 0.8, 1.3, mStd(0x07080a), rearX + 0.13, cy + 0.6 - i * 0.0, z0 + 2.2 + i * 1.7)).position.y += (i - 1) * 0.0;
    // Chân cắm PCIe
    g.add(bx(8.6, 0.3, 0.9, mStd(0xc9a24a, { roughness: 0.3, metalness: 1 }), rearX - 5.6, Lo.pcieY - 0.5, Lo.zs + 0.9));
    // Nguồn phụ 8-pin
    const plugX = cx - len / 2 + 5.2;
    g.add(bx(4.4, st.thick * 0.5, 1.2, mStd(0x0b0c0e, { roughness: 0.7 }), plugX, cy, z0 + st.h + 0.55));
    // Đường LED logo
    if (st.led) {
      const strip = bx(len * 0.5, 0.28, 0.12, rgbify(mBasic(0x000000), { offset: 0.6 }), cx + len * 0.12, cy + st.thick * 0.28, z0 + st.h + 0.07);
      g.add(strip);
    }
    g.userData.gpuInfo = { plugX, plugY: cy, plugZ: z0 + st.h + 0.55, frontX: cx - len / 2, top: cy + st.thick / 2 };
    return g;
  };
  GHOST.GPU = (Lo) => ghostGroup("GPU", [{ w: 31, h: 5, d: 13.4, x: Lo.xr + 0.5 - 15.5, y: Lo.pcieY - 0.1 - 2.5, z: Lo.zs + 0.4 + 6.7 }]);

  /* ---------- SSD M.2 ---------- */
  BUILD.SSD = (Lo, p) => {
    const g = new T.Group();
    const acc = brandColor(p.brand);
    const z = Lo.zs + 0.55;
    g.add(bx(8.0, 2.2, 0.16, mStd(0x0f1318, { roughness: 0.5, metalness: 0.3 }), Lo.sx, Lo.m2Y, z));
    g.add(bx(1.4, 1.5, 0.12, mStd(0x050607, { roughness: 0.4, metalness: 0.5 }), Lo.sx + 2.8, Lo.m2Y, z + 0.14));
    g.add(bx(1.0, 1.1, 0.1, mStd(0x050607, { roughness: 0.4, metalness: 0.5 }), Lo.sx + 1.2, Lo.m2Y, z + 0.13));
    const tex = labelTexture("ssd-" + p.id, 512, 128, {
      grad: ["#12151b", "#1a1e26"],
      border: acc,
      lines: [
        { t: p.brand.toUpperCase(), size: 48, y: 42, color: acc, x: 140 },
        { t: p.name.replace(new RegExp("^" + p.brand + "\\s*", "i"), "").toUpperCase().slice(0, 18), size: 40, y: 92, color: "#e5e7eb", x: 300, weight: 700 }
      ]
    });
    const lab = labelPlane(5.0, 1.8, tex); lab.position.set(Lo.sx - 1.3, Lo.m2Y, z + 0.09); g.add(lab);
    return g;
  };
  GHOST.SSD = (Lo) => ghostGroup("SSD", [{ w: 8.2, h: 2.4, d: 0.5, x: Lo.sx, y: Lo.m2Y, z: Lo.zs + 0.6 }]);

  /* ---------- HDD 3.5" ---------- */
  BUILD.HDD = (Lo, p) => {
    const g = new T.Group();
    const acc = brandColor(p.brand);
    const x = Lo.frontX + 3.8 + 7.35;
    const y = Lo.floorY + 0.6 + 5.1;
    const z = Lo.zs + 5.0;
    const metal = mStd(0xaeb4bd, { roughness: 0.35, metalness: 0.9 });
    g.add(bx(14.7, 10.2, 2.6, metal, x, y, z));
    g.add(bx(14.72, 2.0, 2.62, mStd(0x2a2e36, { roughness: 0.5, metalness: 0.7 }), x, y - 4.1, z));
    const tex = labelTexture("hdd-" + p.id, 512, 340, {
      bg: "#eef1f5", border: acc,
      lines: [
        { t: p.brand.toUpperCase(), size: 62, y: 80, color: "#111827" },
        { t: p.name.replace(new RegExp("^" + p.brand + "\\s*", "i"), "").toUpperCase().slice(0, 20), size: 42, y: 160, color: "#374151", weight: 700 },
        { t: (p.storageType || "HDD") + " · 7200 RPM", size: 28, y: 225, color: acc, weight: 800 }
      ]
    });
    const lab = labelPlane(11.5, 7.6, tex); lab.position.set(x, y + 0.6, z + 1.32); g.add(lab);
    for (let i = 0; i < 4; i++) g.add(cylZ(0.25, 0.1, mStd(0x333842, { metalness: 0.9, roughness: 0.4 }), 10)).position.set(x - 6.2 + (i % 2) * 12.4, y + (i < 2 ? 4.3 : -2.6), z + 1.35);
    return g;
  };
  GHOST.HDD = (Lo) => ghostGroup("HDD", [{ w: 14.9, h: 10.4, d: 2.8, x: Lo.frontX + 3.8 + 7.35, y: Lo.floorY + 5.7, z: Lo.zs + 5.0 }]);

  /* ---------- PSU ---------- */
  BUILD.PSU = (Lo, p) => {
    const g = new T.Group();
    const acc = p.brand === "Corsair" ? "#ffd21f" : brandColor(p.brand);
    const body = mStd(0x16181d, { roughness: 0.55, metalness: 0.55 });
    const cx = (Lo.psuX0 + Lo.psuX1) / 2, cy = Lo.floorY + 0.2 + 4.3;
    const lab = labelTexture("psu-" + p.id, 512, 275, {
      grad: ["#0f1115", "#171a20"],
      lines: [
        { t: p.brand.toUpperCase(), size: 64, y: 70, color: acc },
        { t: (p.wattage || 0) + "W", size: 110, y: 160, color: "#f3f4f6" },
        { t: ((p.description.match(/80\s*Plus\s*\w+/i) || ["80+"])[0]).toUpperCase(), size: 34, y: 235, color: "#9ca3af", weight: 700 }
      ]
    });
    const conn = canvasTexture("psuconn", 512, 294, (c, w, h) => {
      c.fillStyle = "#101216"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#050608";
      for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) c.fillRect(34 + q * 78, 40 + r * 78, 62, 56);
      c.fillStyle = "#facc15"; c.fillRect(0, h - 22, w, 22);
    });
    const faceMat = mStd(0xffffff, { map: lab, roughness: 0.45, metalness: 0.4 });
    const connMat = mStd(0xffffff, { map: conn, roughness: 0.5, metalness: 0.3 });
    const mats = [body, connMat, body, body, faceMat, body];
    const psu = new T.Mesh(new T.BoxGeometry(16, 8.6, 14.8), mats);
    psu.position.set(cx, cy, Lo.psuZ);
    g.add(psu);
    g.userData.psuInfo = { front: Lo.psuX0, top: cy + 4.3, z: Lo.psuZ };
    return g;
  };
  GHOST.PSU = (Lo) => ghostGroup("PSU", [{ w: 16, h: 8.6, d: 14.8, x: (Lo.psuX0 + Lo.psuX1) / 2, y: Lo.floorY + 4.5, z: Lo.psuZ }]);

  /* ---------- Dây cáp ---------- */
  function buildCables(Lo, build, parts) {
    const hasPsu = !!build.PSU;
    if (!hasPsu) return null;
    const g = new T.Group();
    g.userData.cat = "PSU";
    const sleeve = mStd(0x0b0c0f, { roughness: 0.85, metalness: 0.05 });
    const accent = mStd(0x1a1c22, { roughness: 0.85 });
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const zs = Lo.zs;
    const psu = parts.PSU && parts.PSU.group.userData.psuInfo;
    if (!psu) return null;
    const pz = Lo.psuZ;

    if (build.Mainboard) {
      // 24-pin
      const ex = Lo.xr - Lo.bw + 1.2, ey = Lo.ytop - 11;
      g.add(tube([V(psu.front - 0.2, psu.top - 2, pz + 2), V(psu.front - 2.5, Lo.shroudTop + 0.8, zs + 5), V(ex + 2.2, Lo.shroudTop + 4, zs + 3.2), V(ex + 3.2, ey - 7, zs + 2.4), V(ex + 1.2, ey - 2.8, zs + 1.9), V(ex, ey - 0.2, zs + 1.5)], 0.95, sleeve, 60));
      // CPU 8-pin (đi dọc mặt sau lên nóc)
      const cx = Lo.xr - 4.3, cy = Lo.ytop - 1.1;
      g.add(tube([V(Lo.psuX1 - 3, psu.top - 1.5, pz - 3), V(Lo.rearX - 1.2, Lo.shroudTop + 1.0, zs + 2.6), V(Lo.rearX - 1.4, Lo.ytop - 14, zs + 3.2), V(Lo.xr - 1.2, Lo.ytop - 3.2, zs + 3.0), V(cx + 0.4, cy - 0.6, zs + 1.9), V(cx, cy, zs + 1.4)], 0.52, sleeve, 60));
    }
    const gp = parts.GPU && parts.GPU.group.userData.gpuInfo;
    if (gp && build.GPU) {
      g.add(tube([V(psu.front + 3, psu.top - 1.5, pz + 5.5), V(gp.frontX - 1.5, Lo.shroudTop + 0.6, gp.plugZ + 2.6), V(gp.frontX + 0.5, gp.plugY - 1.5, gp.plugZ + 2.8), V(gp.plugX - 1.5, gp.plugY, gp.plugZ + 1.4), V(gp.plugX, gp.plugY, gp.plugZ + 0.4)], 0.5, accent, 50));
    }
    return g;
  }

  /* ---------- Ghost ---------- */
  function ghostGroup(cat, boxes) {
    const g = new T.Group();
    g.userData.cat = cat;
    g.userData.ghost = true;
    boxes.forEach((b) => {
      const geo = new T.BoxGeometry(b.w, b.h, b.d);
      const fm = new T.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.07, depthWrite: false });
      const face = new T.Mesh(geo, fm);
      face.position.set(b.x, b.y, b.z);
      g.add(face);
      const lm = new T.LineBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.8 });
      const line = new T.LineSegments(new T.EdgesGeometry(geo), lm);
      line.position.copy(face.position); line.raycast = noRay;
      g.add(line);
      (g.userData.gm = g.userData.gm || []).push(fm, lm);
    });
    return g;
  }

  function makeOutline(box, color) {
    const size = new T.Vector3(), ctr = new T.Vector3();
    box.getSize(size); box.getCenter(ctr);
    const geo = new T.BoxGeometry(size.x + 0.7, size.y + 0.7, size.z + 0.7);
    const m = new T.LineSegments(geo.clone(), new T.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
    m.geometry.dispose();
    m.geometry = new T.EdgesGeometry(geo);
    geo.dispose();
    m.position.copy(ctr);
    m.visible = false;
    m.renderOrder = 20;
    m.raycast = noRay;
    return m;
  }

  /* ------------------------------------------------------------------ */
  /*  Mô hình Chậu cây để bàn mini (Potted Desk Plant)                 */
  /* ------------------------------------------------------------------ */
  function buildPottedPlant() {
    const g = new T.Group();
    g.userData.cat = "Plant";

    // Đĩa lót gốm trắng (Saucer)
    const ceramicWhite = mStd(0xfafbfe, { roughness: 0.22, metalness: 0.08 });
    const saucer = cylY(4.8, 4.4, 0.65, ceramicWhite, 26);
    saucer.position.y = 0.32;
    g.add(saucer);

    // Thân chậu gốm sứ trắng tối giản (Pot)
    const pot = cylY(4.4, 3.2, 6.0, ceramicWhite, 30);
    pot.position.y = 3.65;
    g.add(pot);

    // Vành miệng chậu
    const rim = new T.Mesh(new T.TorusGeometry(4.4, 0.25, 10, 30), ceramicWhite);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 6.65;
    g.add(rim);

    // Vạch viền màu vàng đồng / terracotta trang trí quanh thân chậu
    const band = new T.Mesh(new T.TorusGeometry(4.1, 0.12, 8, 30), mStd(0xd97706, { roughness: 0.35, metalness: 0.4 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 4.5;
    g.add(band);

    // Lớp đất trồng sẫm màu
    const soilMat = mStd(0x2d1f16, { roughness: 0.95 });
    const soil = cylY(4.15, 4.15, 0.45, soilMat, 24);
    soil.position.y = 6.35;
    g.add(soil);

    // Rải sỏi trắng trang trí (White pebbles)
    const pebMat = mStd(0xf1f5f9, { roughness: 0.45 });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + (i % 4) * 0.2;
      const rad = 1.0 + ((i * 7) % 11) * 0.26;
      const peb = new T.Mesh(new T.DodecahedronGeometry(0.32, 0), pebMat);
      peb.position.set(Math.cos(angle) * rad, 6.55, Math.sin(angle) * rad);
      peb.scale.set(1.2, 0.6, 1.0);
      g.add(peb);
    }

    // Thân cây & các tầng lá sen đá (Succulent) xanh mướt
    const leafDark = mStd(0x166534, { roughness: 0.35, metalness: 0.05, side: T.DoubleSide });
    const leafMid = mStd(0x22c55e, { roughness: 0.35, metalness: 0.05, side: T.DoubleSide });
    const leafLight = mStd(0x4ade80, { roughness: 0.35, metalness: 0.05, side: T.DoubleSide });

    const stem = cylY(0.48, 0.7, 3.2, mStd(0x14532d, { roughness: 0.6 }), 12);
    stem.position.y = 7.2;
    g.add(stem);

    // 4 tầng lá sen đá xòe mọng nước
    const levels = [
      { n: 7, r: 4.8, y: 7.0, scale: 1.15, rx: 0.72, mat: leafDark },
      { n: 6, r: 3.8, y: 8.0, scale: 0.95, rx: 0.54, mat: leafMid },
      { n: 5, r: 2.7, y: 8.9, scale: 0.75, rx: 0.38, mat: leafMid },
      { n: 4, r: 1.6, y: 9.7, scale: 0.55, rx: 0.22, mat: leafLight }
    ];

    levels.forEach((lvl, lIdx) => {
      for (let i = 0; i < lvl.n; i++) {
        const ang = (i / lvl.n) * Math.PI * 2 + lIdx * 0.48;
        const grp = new T.Group();
        grp.position.set(0, lvl.y, 0);
        grp.rotation.y = ang;

        const leafG = new T.SphereGeometry(1.3 * lvl.scale, 10, 8);
        leafG.scale(0.85, 0.28, 2.0);
        const lf = new T.Mesh(leafG, lvl.mat);
        lf.position.set(0, 0, lvl.r * 0.52);
        lf.rotation.x = lvl.rx;
        grp.add(lf);
        g.add(grp);
      }
    });

    // Búp chồi non ở đọt cây
    const bud = new T.Mesh(new T.ConeGeometry(0.55, 1.3, 8), mStd(0x86efac, { roughness: 0.3 }));
    bud.position.y = 10.6;
    g.add(bud);

    // Bóng đổ mờ dưới đáy chậu lên bàn
    const shadow = new T.Mesh(
      new T.CircleGeometry(5.2, 24),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    g.add(shadow);

    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  Môi trường phản chiếu Studio Dark Gray (PMREM)                   */
  /* ------------------------------------------------------------------ */
  function makeEnvironment(renderer) {
    const s = new T.Scene();
    s.add(new T.Mesh(new T.BoxGeometry(90, 70, 90), new T.MeshBasicMaterial({ color: 0x1d232c, side: T.BackSide })));
    const panel = (c, k, w, h, x, y, z) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    panel(0xffffff, 4.2, 32, 18, -25, 25, 25);
    panel(0x94a3b8, 3.2, 26, 14, 30, 15, -15);
    panel(0xffffff, 3.8, 30, 14, 0, 32, -5);
    panel(0x64748b, 2.5, 20, 30, 38, 5, 20);
    const pm = new T.PMREMGenerator(renderer);
    const rt = pm.fromScene(s, 0.03);
    pm.dispose();
    s.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
    return rt.texture;
  }

  /* ------------------------------------------------------------------ */
  /*  Viewer chính                                                      */
  /* ------------------------------------------------------------------ */
  const ICON = {
    power: '<svg viewBox="0 0 24 24"><path d="M12 2v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/></svg>',
    glass: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 16 16 8M8 11l5-5"/></svg>',
    rgb: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/></svg>',
    rotate: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
  };

  PC3D.create = function (container, opts) {
    opts = opts || {};
    const get = opts.getProduct || (() => null);

    container.classList.add("v3d");
    container.innerHTML =
      '<div class="v3d-stage"></div>' +
      '<div class="v3d-hud"><div class="v3d-badge" data-role="status"><i></i><span>Đang khởi tạo…</span></div>' +
      '<div class="v3d-count" data-role="count">0/9</div></div>' +
      '<div class="v3d-toolbar">' +
      `<button type="button" data-act="power" class="on" title="Bật / tắt nguồn">${ICON.power}</button>` +
      `<button type="button" data-act="glass" class="on" title="Tháo / lắp kính cường lực">${ICON.glass}</button>` +
      `<button type="button" data-act="rgb" class="on" title="Bật / tắt đèn RGB">${ICON.rgb}</button>` +
      `<button type="button" data-act="rotate" title="Tự động xoay">${ICON.rotate}</button>` +
      `<button type="button" data-act="reset" title="Về góc nhìn ban đầu">${ICON.reset}</button>` +
      `<button type="button" data-act="full" title="Toàn màn hình">${ICON.full}</button>` +
      "</div>" +
      '<div class="v3d-tip" data-role="tip"></div>' +
      '<div class="v3d-hint">Kéo để xoay · Cuộn để phóng to · Nhấn vào linh kiện để chọn</div>';

    const stage = container.querySelector(".v3d-stage");
    const statusEl = container.querySelector('[data-role="status"]');
    const countEl = container.querySelector('[data-role="count"]');
    const tipEl = container.querySelector('[data-role="tip"]');

    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      stage.innerHTML = '<div class="v3d-fallback">Trình duyệt không hỗ trợ WebGL nên không thể hiển thị mô hình 3D.</div>';
      return { update() {}, setIssues() {}, highlight() {}, resize() {}, destroy() {} };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x222730, 1);
    stage.appendChild(renderer.domElement);
    renderer.domElement.className = "v3d-canvas";

    const scene = new T.Scene();
    scene.background = new T.Color(0x222730);
    scene.fog = new T.Fog(0x222730, 95, 275);
    scene.environment = makeEnvironment(renderer);

    const camera = new T.PerspectiveCamera(32, 1, 1, 600);
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 35;
    controls.maxDistance = 190;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.45;

    // Hệ thống ánh sáng Studio Dark Gray cao cấp, tôn tương phản linh kiện
    scene.add(new T.AmbientLight(0xffffff, 0.78));
    const key = new T.DirectionalLight(0xffffff, 1.4);
    key.position.set(-45, 65, 55);
    scene.add(key);
    const fill = new T.DirectionalLight(0xcfd8e3, 0.85);
    fill.position.set(55, 35, 45);
    scene.add(fill);
    // Đèn viền xanh cyan nhẹ giúp tách khối case trên nền xám đậm
    const rim = new T.DirectionalLight(0x7dd3fc, 0.95);
    rim.position.set(0, 45, -60);
    scene.add(rim);
    const topLight = new T.DirectionalLight(0xffffff, 0.65);
    topLight.position.set(0, 75, 10);
    scene.add(topLight);

    // Sân khấu Studio: Phông nền cong vô cực & Bàn làm việc
    const stageGrp = new T.Group();

    // 1. Phông nền tường studio cong xám đậm (Dark Gray Cyclorama)
    const wallGeo = new T.PlaneGeometry(320, 180);
    const wallMat = new T.MeshStandardMaterial({ color: 0x272e38, roughness: 0.88, metalness: 0.05 });
    const wall = new T.Mesh(wallGeo, wallMat);
    wall.position.set(0, 35, -80);
    stageGrp.add(wall);

    // Sàn studio xám đậm phía xa
    const floorGeo = new T.PlaneGeometry(320, 160);
    const floorMat = new T.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.8, metalness: 0.1 });
    const studioFloor = new T.Mesh(floorGeo, floorMat);
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.set(0, -32, 0);
    stageGrp.add(studioFloor);

    // 2. Bàn làm việc Studio (Studio Desk Tabletop xám đậm than củi)
    const deskGroup = new T.Group();
    const deskW = 140, deskD = 80, deskH = 3.2;
    const deskMat = mStd(0x2d3440, { roughness: 0.45, metalness: 0.15 });
    const deskEdgeMat = mStd(0x222832, { roughness: 0.5, metalness: 0.2 });
    const desk = new T.Mesh(new T.BoxGeometry(deskW, deskH, deskD), [deskEdgeMat, deskEdgeMat, deskMat, deskEdgeMat, deskEdgeMat, deskEdgeMat]);
    desk.position.set(0, -deskH / 2, 0);
    deskGroup.add(desk);

    // Thảm lót bàn làm việc (Desk Pad sang trọng màu xám đen da thuộc)
    const padMat = mStd(0x181c24, { roughness: 0.85, metalness: 0.08 });
    const pad = new T.Mesh(new T.BoxGeometry(88, 0.25, 46), padMat);
    pad.position.set(0, 0.13, 0);
    deskGroup.add(pad);

    // Viền chỉ may thanh lịch quanh thảm lót
    const padStitch = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(87.8, 0.26, 45.8)),
      new T.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 })
    );
    padStitch.position.copy(pad.position);
    deskGroup.add(padStitch);

    // Bóng đổ mờ của thùng PC lên mặt bàn
    const caseShadow = new T.Mesh(
      new T.PlaneGeometry(56, 32),
      new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false })
    );
    caseShadow.rotation.x = -Math.PI / 2;
    caseShadow.position.set(0, 0.28, 0);
    deskGroup.add(caseShadow);

    stageGrp.add(deskGroup);

    // 3. Chậu cây sen đá nhỏ xinh xắn trên bàn làm việc
    const plant = buildPottedPlant();
    stageGrp.add(plant);

    scene.add(stageGrp);

    const root = new T.Group();   // chứa case + linh kiện (để raycast)
    scene.add(root);

    /* ---- trạng thái ---- */
    const state = {
      layout: null, frame: null, frameOutline: null, parts: {}, cables: null,
      build: {}, issues: new Set(), powered: false,
      ui: { power: true, glass: true, rgb: true, rotate: false },
      glassT: 1, hoverCat: null, extHl: null, flash: {}, rgbMats: [], rotors: [],
      first: true, visible: true, userTimer: 0, dirty: true
    };

    /* ---- đồng bộ build -> scene ---- */
    function removePart(entry) {
      if (!entry) return;
      root.remove(entry.group);
      disposeTree(entry.group);
    }

    function attachOutlines(group) {
      const box = new T.Box3().setFromObject(group);
      if (box.isEmpty()) return;
      const hl = makeOutline(box, 0x67e8f9);
      const issue = makeOutline(box, 0xff4d4d);
      group.add(hl); group.add(issue);
      group.userData.hl = hl; group.userData.issue = issue;
    }

    function collectRegistries() {
      state.rgbMats = []; state.rotors = [];
      const seen = new Set();
      root.traverse((n) => {
        if (n.userData && n.userData.spin) state.rotors.push(n);
        if (n.material && !Array.isArray(n.material) && n.material.userData.rgb && !seen.has(n.material)) {
          seen.add(n.material); state.rgbMats.push(n.material);
        }
      });
    }

    const OFFSET = {
      CPU: [0, 0, 16], Cooler: [0, 4, 22], Mainboard: [0, 0, 18], RAM: [0, 6, 14],
      GPU: [0, 0, 20], SSD: [0, 0, 14], HDD: [0, 0, 18], PSU: [0, 0, 20]
    };

    function sync(build) {
      const lay = computeLayout(build, get);
      const full = !state.layout || state.layout.key !== lay.key;
      const prevIds = {};
      PART_CATS.forEach((c) => { prevIds[c] = state.parts[c] ? state.parts[c].id : null; });
      const now = performance.now();

      if (full) {
        if (state.frame) { root.remove(state.frame); disposeTree(state.frame); }
        PART_CATS.forEach((c) => { removePart(state.parts[c]); state.parts[c] = null; });
        if (state.cables) { root.remove(state.cables); disposeTree(state.cables); state.cables = null; }
        state.frame = buildCaseFrame(lay);
        root.add(state.frame);
        const sz = state.frame.userData.size;
        state.frameOutline = makeOutline(new T.Box3(new T.Vector3(-sz.L / 2, -sz.H / 2, -sz.W / 2), new T.Vector3(sz.L / 2, sz.H / 2, sz.W / 2)), 0x67e8f9);
        state.frame.add(state.frameOutline);
        state.frame.userData.hl = state.frameOutline;
        const issueO = makeOutline(new T.Box3(new T.Vector3(-sz.L / 2, -sz.H / 2, -sz.W / 2), new T.Vector3(sz.L / 2, sz.H / 2, sz.W / 2)), 0xff4d4d);
        state.frame.add(issueO); state.frame.userData.issue = issueO;
        // Cập nhật vị trí mặt bàn và chậu cây: đặt chậu cây ở phía trước bên cạnh vỏ case trên mặt thảm
        const deskTopY = -sz.H / 2 - 1.5;
        deskGroup.position.y = deskTopY;
        plant.position.set(-sz.L / 2 - 8.5, deskTopY, 6.5);
        controls.target.set(0, -1, 0);
      }
      state.layout = lay;

      let order = 0;
      PART_CATS.forEach((cat) => {
        const id = build[cat] || 0;
        const cur = state.parts[cat];
        if (!full && cur && cur.id === id) return;
        removePart(cur);
        const p = id ? get(id) : null;
        const group = p ? BUILD[cat](lay, p, build) : GHOST[cat](lay);
        group.userData.cat = cat;
        if (p) attachOutlines(group);
        root.add(group);
        state.parts[cat] = { id, group, ghost: !p };
        const changed = prevIds[cat] !== (id || null) || state.first;
        if (p && changed) {
          const o = OFFSET[cat] || [0, 0, 14];
          group.userData.anim = { t0: now + (state.first ? order * 140 : 0), dur: 750, from: new T.Vector3(o[0], o[1], o[2]) };
          group.position.set(o[0], o[1], o[2]);
          group.visible = false;
          state.flash[cat] = now + (state.first ? order * 140 : 0) + 1300;
          order++;
        }
      });

      // Cáp điện
      const cabKey = [build.PSU, build.Mainboard, build.GPU, build.CPU].join("|") + "|" + lay.key;
      if (state.cableKey !== cabKey || full) {
        if (state.cables) { root.remove(state.cables); disposeTree(state.cables); state.cables = null; }
        const cb = buildCables(lay, build, state.parts);
        if (cb) { root.add(cb); state.cables = cb; cb.userData.anim = { t0: now + 500, dur: 600, from: new T.Vector3(0, 0, 0), fade: true }; cb.visible = false; }
        state.cableKey = cabKey;
      }

      state.first = false;
      state.build = build;
      collectRegistries();
      updateStatus();
    }

    function missingForBoot() {
      const b = state.build, m = [];
      if (!b.CPU) m.push("CPU"); if (!b.Mainboard) m.push("Mainboard"); if (!b.PSU) m.push("PSU");
      return m;
    }
    function updateStatus() {
      const b = state.build;
      const n = ALL_CATS.filter((c) => b[c]).length;
      countEl.textContent = n + "/" + ALL_CATS.length;
      const miss = missingForBoot();
      let cls = "off", text;
      if (!n) text = "Chưa có linh kiện nào";
      else if (miss.length) text = "Chưa khởi động · thiếu " + miss.join(", ");
      else if (state.issues.size) { cls = "warn"; text = "Không khởi động · xung đột tương thích"; }
      else if (!state.ui.power) text = "Đã tắt nguồn";
      else { cls = "on"; text = "Đang hoạt động"; }
      state.powered = cls === "on";
      statusEl.className = "v3d-badge " + cls;
      statusEl.querySelector("span").textContent = text;
    }

    /* ---- UI ---- */
    container.querySelector(".v3d-toolbar").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "reset") { resetCamera(true); return; }
      if (act === "full") {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (container.requestFullscreen) container.requestFullscreen();
        return;
      }
      state.ui[act] = !state.ui[act];
      btn.classList.toggle("on", state.ui[act]);
      if (act === "rotate") controls.autoRotate = state.ui.rotate;
      if (act === "power") updateStatus();
    });

    function pauseAutoRotate() {
      controls.autoRotate = false;
      clearTimeout(state.userTimer);
      state.userTimer = setTimeout(() => { controls.autoRotate = state.ui.rotate; }, 5000);
    }
    controls.addEventListener("start", pauseAutoRotate);

    /* ---- Camera ---- */
    function resetCamera(animate) {
      const sz = state.frame ? state.frame.userData.size : { L: 44, H: 45, W: 22 };
      const aspect = camera.aspect || 1;
      const tanH = Math.tan((camera.fov * Math.PI) / 360);
      const halfH = sz.H / 2 + 3;
      const halfW = Math.max(sz.L * 0.58, sz.W) / 2 + 3;
      const dist = (Math.max(halfH / tanH, halfW / (tanH * aspect)) + sz.W * 0.5) * 1.02;
      const dir = new T.Vector3(-0.68, 0.20, 0.70).normalize();
      const target = new T.Vector3(-2, -1, 1);
      const pos = dir.multiplyScalar(dist).add(target);
      if (animate) state.camTween = { t0: performance.now(), dur: 900, from: camera.position.clone(), to: pos };
      else camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    }

    function resize() {
      const w = Math.max(stage.clientWidth, 2), h = Math.max(stage.clientHeight, 2);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      state.dirty = true;
    }
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { const wasFirst = !state.sized; resize(); if (wasFirst) { state.sized = true; resetCamera(false); } }); ro.observe(stage); }
    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", () => setTimeout(resize, 50));

    /* ---- Raycast hover / click ---- */
    const ray = new T.Raycaster();
    const ptr = new T.Vector2();
    let ptrInside = false, ptrMoved = false, downPos = null;

    function findCat(obj) {
      while (obj) { if (obj.userData && obj.userData.cat) return obj.userData.cat; obj = obj.parent; }
      return null;
    }
    function pick(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects([root, plant], true);
      for (const h of hits) {
        if (!h.object.visible) continue;
        const c = findCat(h.object);
        if (c) return c;
      }
      return null;
    }
    const cvs = renderer.domElement;
    cvs.addEventListener("pointermove", (e) => {
      if (e.buttons) { tipEl.classList.remove("show"); return; }
      const cat = pick(e);
      state.hoverCat = cat;
      cvs.style.cursor = cat ? "pointer" : "grab";
      if (cat === "Plant") {
        tipEl.innerHTML = `<b>SETUP DECOR 🌱</b><span>Chậu cây để bàn mini</span>`;
        const r = container.getBoundingClientRect();
        tipEl.style.left = Math.min(e.clientX - r.left + 14, r.width - 200) + "px";
        tipEl.style.top = (e.clientY - r.top + 14) + "px";
        tipEl.classList.add("show");
        return;
      }
      if (cat) {
        const id = state.build[cat];
        const p = id ? get(id) : null;
        tipEl.innerHTML = `<b>${cat}</b><span>${p ? p.name : "Chưa chọn · nhấn để chọn linh kiện"}</span>`;
        const r = container.getBoundingClientRect();
        tipEl.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + "px";
        tipEl.style.top = (e.clientY - r.top + 14) + "px";
        tipEl.classList.add("show");
      } else tipEl.classList.remove("show");
    });
    cvs.addEventListener("pointerleave", () => { state.hoverCat = null; tipEl.classList.remove("show"); });
    cvs.addEventListener("pointerdown", (e) => { downPos = { x: e.clientX, y: e.clientY }; });
    cvs.addEventListener("pointerup", (e) => {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (moved > 5) return;
      const cat = pick(e);
      if (cat === "Plant") {
        if (window.showToast) window.showToast("🌱 Chậu cây cảnh decor bàn làm việc!", "info");
        return;
      }
      if (cat && opts.onPick) opts.onPick(cat);
    });

    /* ---- Vòng lặp render ---- */
    const clock = new T.Clock();
    const tmp = new T.Color();
    let hue = 0, raf = 0, destroyed = false;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const easeBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

    function animateGroup(g, now) {
      const a = g.userData.anim;
      if (!a) return;
      const t = (now - a.t0) / a.dur;
      if (t < 0) { g.visible = false; return; }
      g.visible = true;
      if (t >= 1) { g.position.set(0, 0, 0); g.userData.anim = null; return; }
      const k = a.fade ? 1 : 1 - easeBack(Math.min(1, t));
      g.position.copy(a.from).multiplyScalar(k);
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (destroyed || !state.visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      const t = clock.elapsedTime;

      // camera tween
      if (state.camTween) {
        const k = Math.min(1, (now - state.camTween.t0) / state.camTween.dur);
        camera.position.lerpVectors(state.camTween.from, state.camTween.to, ease(k));
        if (k >= 1) state.camTween = null;
      }
      controls.update();

      // Animations vào/ra
      PART_CATS.forEach((c) => { const e = state.parts[c]; if (e) animateGroup(e.group, now); });
      if (state.cables) animateGroup(state.cables, now);

      // Fan + RGB
      const on = state.powered;
      hue = (hue + dt * 0.12) % 1;
      state.rotors.forEach((r) => { r.rotation.z += (on ? r.userData.spin : r.userData.spin * 0) * dt; });
      state.rgbMats.forEach((m) => {
        const u = m.userData.rgb;
        if (on && state.ui.rgb) tmp.setHSL((hue + u.offset) % 1, 1, 0.55).multiplyScalar(u.scale);
        else if (on) tmp.setRGB(0.08, 0.1, 0.12);
        else tmp.setRGB(0, 0, 0);
        m[u.target].copy(tmp);
      });
      if (state.frame) {
        const fl = state.frame.userData.light;
        const target = on && state.ui.rgb ? 0.9 : on ? 0.25 : 0;
        fl.intensity += (target - fl.intensity) * 0.08;
        fl.color.setHSL(hue, 0.9, 0.6);
        const led = state.frame.userData.powerLed;
        led.material.color.setHex(on ? 0x38bdf8 : 0x1f2937);

        // Kính
        const gl = state.frame.userData.glass;
        const tgt = state.ui.glass ? 1 : 0;
        state.glassT += (tgt - state.glassT) * 0.12;
        const k = state.glassT;
        gl.group.visible = k > 0.02;
        gl.group.position.z = (1 - k) * 26;
        gl.mat.opacity = 0.14 * k; gl.edge.opacity = 0.55 * k; gl.streak.opacity = 0.4 * k;
      }

      // Outline: hover / flash / lỗi
      const pulse = 0.55 + 0.4 * Math.sin(t * 5);
      const active = state.hoverCat || state.extHl;
      const allGroups = PART_CATS.map((c) => [c, state.parts[c]]).filter((x) => x[1]).map(([c, e]) => [c, e.group]);
      if (state.frame) allGroups.push(["Case", state.frame]);
      allGroups.forEach(([cat, g]) => {
        const ud = g.userData;
        if (ud.ghost) {
          const boost = active === cat ? 1 : 0;
          const p = 0.45 + 0.35 * Math.sin(t * 2.4 + PART_CATS.indexOf(cat));
          (ud.gm || []).forEach((m, i) => {
            if (m.isLineBasicMaterial) m.opacity = (0.35 + 0.4 * p) + boost * 0.3;
            else m.opacity = 0.04 + 0.05 * p + boost * 0.18;
          });
          return;
        }
        const flashing = (state.flash[cat] || 0) > now;
        if (ud.hl) { ud.hl.visible = (active === cat) || flashing; ud.hl.material.opacity = flashing && active !== cat ? 0.4 + 0.4 * Math.sin(t * 9) : 0.95; }
        if (ud.issue) { const bad = state.issues.has(cat); ud.issue.visible = bad; if (bad) ud.issue.material.opacity = pulse; }
      });

      renderer.render(scene, camera);
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver((en) => { state.visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(container);
    }

    resize();
    resetCamera(false);
    // Dựng khung mặc định ngay để người dùng thấy thùng PC
    sync({});
    resetCamera(false);
    frame();
    container.classList.add("ready");

    return {
      update(build, issues) {
        state.issues = new Set(issues || []);
        sync(Object.assign({}, build));
      },
      setIssues(list) { state.issues = new Set(list || []); updateStatus(); },
      highlight(cat) { state.extHl = cat || null; },
      resize,
      destroy() {
        destroyed = true; cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", resize);
        controls.dispose(); renderer.dispose();
      }
    };
  };
})();
