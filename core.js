"use strict";
(function () {
  const $ = (s) => document.querySelector(s);
  const SCENES = window.SCENES || [];
  const DWELL = 26; /* 每章停留秒数 */

  /* ═══════════ 启动序列 ═══════════ */
  const boot = $("#boot");
  const bootFill = $("#bootFill");
  const bootStatus = $("#bootStatus");
  const bootLines = ["初始化渲染管线…", "编译着色器…", "点亮星尘…", "校准光轴…", "就绪"];
  let bootP = 0, bootLi = 0;
  const bootTimer = setInterval(() => {
    bootP = Math.min(100, bootP + Math.random() * 16 + 6);
    bootFill.style.width = bootP + "%";
    const li = Math.min(bootLines.length - 1, Math.floor(bootP / 22));
    if (li !== bootLi) { bootLi = li; bootStatus.textContent = bootLines[li]; }
    if (bootP >= 100) {
      clearInterval(bootTimer);
      setTimeout(() => {
        boot.classList.add("hide");
        document.body.classList.add("ready");
      }, 260);
    }
  }, 120);

  /* ═══════════ Three.js 可用性 ═══════════ */
  if (typeof THREE === "undefined") {
    clearInterval(bootTimer);
    boot.classList.add("error");
    bootStatus.innerHTML =
      "Three.js 未能加载（需要联网获取 CDN 资源）<br>请联网后刷新，或告知我改用内置零依赖渲染器";
    console.warn("[AURORA·FX] THREE 未定义，特效舞台无法启动");
    return;
  }

  /* ═══════════ 渲染器 ═══════════ */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    clearInterval(bootTimer);
    boot.classList.add("error");
    bootStatus.textContent = "WebGL 初始化失败：" + e.message;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  $("#stage").appendChild(renderer.domElement);

  /* ═══════════ 状态 ═══════════ */
  const mouse = { x: 0, y: 0 };
  const env = {
    renderer,
    mouse,
    get scene() { return Engine.scene; },
    get camera() { return Engine.camera; },
  };
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
  const Engine = { scene: null, camera, current: null, idx: -1, auto: true, autoT: 0 };

  /* ═══════════ HUD ═══════════ */
  const chipIdx = $("#chipIdx");
  const chipFps = $("#chipFps");
  const titleWrap = $("#titleWrap");
  const tGhost = $("#tGhost"), tMain = $("#tMain"), tSub = $("#tSub");
  const hint = $("#hint");
  const dock = $("#dock");

  SCENES.forEach((sc, i) => {
    const item = document.createElement("button");
    item.className = "dock-item";
    item.innerHTML =
      '<span class="num">0' + (i + 1) + " · " + sc.en + "</span>" +
      '<span class="name">' + sc.title + "</span>" +
      '<span class="bar"><i></i></span>';
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      go(i);
    });
    dock.appendChild(item);
  });
  const dockItems = [...dock.children];

  function updateHUD(i) {
    const sc = SCENES[i];
    chipIdx.textContent = "0" + (i + 1) + " / 0" + SCENES.length;
    tGhost.textContent = "0" + (i + 1);
    tMain.textContent = sc.title;
    tSub.textContent = sc.sub;
    hint.textContent = sc.hint;
    dockItems.forEach((el, k) => el.classList.toggle("active", k === i));
  }

  /* ═══════════ 章节切换 ═══════════ */
  function disposeScene() {
    if (!Engine.current) return;
    try { Engine.current.dispose && Engine.current.dispose(); } catch (e) { /* 忽略 */ }
    Engine.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map && m.map !== window.FXH.glowTex()) m.map.dispose();
          m.dispose();
        });
      }
    });
    Engine.scene = null;
    Engine.current = null;
  }

  function buildScene(i) {
    Engine.scene = new THREE.Scene();
    Engine.idx = i;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    Engine.current = SCENES[i].create(env);
    if (Engine.current.onResize) Engine.current.onResize(innerWidth, innerHeight);
    Engine.autoT = 0;
    updateHUD(i);
  }

  let switching = false;
  function go(i, silent) {
    if (switching) return;
    i = (i + SCENES.length) % SCENES.length;
    if (i === Engine.idx) return;
    switching = true;
    /* 转场闪光 */
    const flash = $("#flash");
    if (!silent) {
      flash.classList.remove("on");
      void flash.offsetWidth;
      flash.classList.add("on");
    }
    titleWrap.classList.remove("in");
    titleWrap.classList.add("out");
    setTimeout(() => {
      disposeScene();
      buildScene(i);
      titleWrap.classList.remove("out");
      titleWrap.classList.add("in");
      switching = false;
    }, 340);
  }

  /* ═══════════ 主循环 ═══════════ */
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0, fpsLast = 0;
  const clock = { t: 0 };

  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt <= 0 || dt > 0.1) return;
    clock.t += dt;

    if (Engine.current) {
      try {
        Engine.current.update(dt, clock.t);
      } catch (e) {
        console.error("[场景更新异常]", e);
        Engine.current.update = () => {};
      }
      renderer.render(Engine.scene, camera);
    }

    /* 自轮播进度 */
    if (Engine.auto && Engine.current) {
      Engine.autoT += dt;
      const bar = dockItems[Engine.idx].querySelector(".bar i");
      if (bar) bar.style.width = Math.min(100, (Engine.autoT / DWELL) * 100) + "%";
      if (Engine.autoT >= DWELL) go(Engine.idx + 1);
    }

    /* FPS */
    fpsAcc += dt; fpsN++;
    if (now - fpsLast > 500) {
      chipFps.textContent = "FPS " + Math.round(fpsN / fpsAcc);
      chipFps.classList.add("ok");
      fpsAcc = 0; fpsN = 0; fpsLast = now;
    }

    /* 自定义光标跟随 */
    cursorTick(dt);
  }

  /* ═══════════ 输入 ═══════════ */
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    curTgt.x = e.clientX;
    curTgt.y = e.clientY;
  });

  window.addEventListener("click", (e) => {
    if (e.target.closest("#dock") || e.target.closest("#hud-top")) return;
    /* DOM 点击火花 */
    const sp = document.createElement("span");
    sp.className = "click-spark";
    sp.style.left = e.clientX + "px";
    sp.style.top = e.clientY + "px";
    document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 520);
    if (Engine.current && Engine.current.onClick) Engine.current.onClick();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") go(Engine.idx + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(Engine.idx - 1);
    else if (e.key === " ") {
      e.preventDefault();
      Engine.auto = !Engine.auto;
      document.body.classList.toggle("auto-off", !Engine.auto);
    } else if (/^[1-9]$/.test(e.key)) {
      const i = parseInt(e.key, 10) - 1;
      if (i < SCENES.length) go(i);
    }
  });

  /* 滚轮切换（节流） */
  let wheelLock = 0;
  window.addEventListener("wheel", (e) => {
    const now = performance.now();
    if (now - wheelLock < 1100) return;
    if (Math.abs(e.deltaY) < 24) return;
    wheelLock = now;
    go(Engine.idx + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  /* 触摸滑动 */
  let tX = 0, tY = 0;
  window.addEventListener("touchstart", (e) => {
    tX = e.touches[0].clientX; tY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tX;
    const dy = e.changedTouches[0].clientY - tY;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy)) go(Engine.idx + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (Engine.current && Engine.current.onResize) Engine.current.onResize(innerWidth, innerHeight);
  });

  /* ═══════════ 自定义光标 ═══════════ */
  const cDot = $("#cDot"), cRing = $("#cRing"), cursorEl = $("#cursor");
  const curTgt = { x: innerWidth / 2, y: innerHeight / 2 };
  const curDot = { ...curTgt }, curRing = { ...curTgt };
  window.addEventListener("pointerdown", () => cursorEl.classList.add("down"));
  window.addEventListener("pointerup", () => cursorEl.classList.remove("down"));
  function cursorTick(dt) {
    curDot.x += (curTgt.x - curDot.x) * Math.min(1, dt * 30);
    curDot.y += (curTgt.y - curDot.y) * Math.min(1, dt * 30);
    curRing.x += (curTgt.x - curRing.x) * Math.min(1, dt * 12);
    curRing.y += (curTgt.y - curRing.y) * Math.min(1, dt * 12);
    cDot.style.transform = "translate(" + (curDot.x - 3.5) + "px," + (curDot.y - 3.5) + "px)";
    cRing.style.setProperty("--rt", "translate(" + (curRing.x - 19) + "px," + (curRing.y - 19) + "px)");
  }

  /* ═══════════ 启动 ═══════════ */
  buildScene(0);
  titleWrap.classList.add("in");
  requestAnimationFrame(loop);
  console.info("[AURORA·FX] 观星台启动 · 共 " + SCENES.length + " 章");
})();
