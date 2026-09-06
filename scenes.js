/* ═══════════════════════════════════════════════════════════
   AURORA · FX — 六大场景定义（Three.js r149）
   01 星河 GALAXY      十八千星尘旋臂 + 星潮冲击环
   02 极光 AURORA      全屏域扭曲 fbm 着色器 + 3D 光尘
   03 星尘字 MORPH      九千粒子弹簧力学凝聚成文字
   04 烟火 FIREWORKS    六型弹道物理 + 水面倒影
   05 霓虹 SYNTHWAVE   顶点位移线框山脊 + 复古太阳
   06 等离子 PLASMA     三维单纯形噪声液态星球
   每个场景：{ key, title, en, sub, hint, create(env) → {update,dispose,onClick,onPointerMove,onResize} }
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ───────── 共享工具 ───────── */
window.FXH = (function () {
  let glow = null;
  function glowTex() {
    if (glow) return glow;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.22, "rgba(255,255,255,.85)");
    gr.addColorStop(0.55, "rgba(255,255,255,.25)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glow = new THREE.CanvasTexture(c);
    return glow;
  }
  /* 自定义点材质：逐粒子颜色/尺寸/透明度 + 加色发光（dim 为整体透明度，用于倒影） */
  function pointsMat(size, dim) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: glowTex() },
        uSize: { value: pointScale() * (size || 1) },
        uDim: { value: dim === undefined ? 1 : dim },
      },
      vertexShader: [
        "attribute float aSize; attribute vec3 aColor; attribute float aAlpha;",
        "varying vec3 vC; varying float vA;",
        "uniform float uSize;",
        "void main(){",
        "  vC=aColor; vA=aAlpha;",
        "  vec4 mv=modelViewMatrix*vec4(position,1.0);",
        "  gl_PointSize=aSize*uSize/max(0.1,-mv.z);",
        "  gl_Position=projectionMatrix*mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D uTex; uniform float uDim; varying vec3 vC; varying float vA;",
        "void main(){",
        "  float a=texture2D(uTex,gl_PointCoord).a;",
        "  gl_FragColor=vec4(vC,a*vA*uDim);",
        "}",
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  /* 像素换算（fov 55°） */
  function pointScale() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    return (window.innerHeight * dpr) / (2 * Math.tan((55 / 2) * Math.PI / 180));
  }
  const r = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  /* 三维单纯形噪声 GLSL（Ashima） */
  const SNOISE = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
    "  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;",
    "  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
    "  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;",
    "  i=mod289(i);",
    "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;",
    "  vec3 j=p-49.0*floor(p*ns.z*ns.z);",
    "  vec3 x_=floor(j*ns.z); vec3 y_=floor(j-7.0*x_);",
    "  vec3 x=x_*ns.x+ns.yyyy.y; vec3 y=y_*ns.x+ns.z; vec3 h=1.0-abs(x)-abs(y);",
    "  vec3 b0=vec3(x.xy,y.xy); vec3 b1=vec3(x.z,y.xy); vec3 b2=vec3(x.xy,y.z); vec3 b3=vec3(x.z,y.z);",
    "  vec4 w=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);",
    "  vec4 w2=w*w; vec4 w4=w2*w2; vec4 g_=1.7*vec4(",
    "    dot(b0,x0),dot(b1,x1),dot(b2,x2),dot(b3,x3));",
    "  vec4 l_=normalize(-g_); vec4 m=50.0*w4*l_;",
    "  return dot(m,vec4(1.0));",
    "}",
  ].join("\n");

  return { glowTex, pointsMat, pointScale, r, gauss, SNOISE, TAU: Math.PI * 2 };
})();

window.SCENES = [
  /* ═══════════ 01 · 星河 GALAXY ═══════════ */
  {
    key: "galaxy",
    title: "星河",
    en: "GALAXY",
    sub: "十八千星尘的四条旋臂，在引力中缓慢旋转",
    hint: "移动鼠标漫游星河 · 点击掀起星潮冲击波",
    create(env) {
      const { scene, camera } = env;
      const g = new THREE.Group();
      scene.add(g);
      g.rotation.x = 0.44;

      const N = 18000, arms = 4, R = 14;
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const siz = new Float32Array(N), alp = new Float32Array(N);
      const pal = [[0.35, 0.9, 1.0], [1.0, 0.4, 0.8], [0.55, 0.45, 1.0], [1.0, 0.82, 0.45]];
      const core = [1.0, 0.9, 0.72];
      for (let i = 0; i < N; i++) {
        const rad = Math.pow(Math.random(), 1.65) * R + 0.25;
        const arm = i % arms;
        const ang = (arm / arms) * FXH.TAU + rad * 0.3 + FXH.r(-0.14, 0.14) * (0.4 + rad / R);
        const spread = (R - rad) * 0.14 + 0.18;
        const gx = FXH.gauss(), gy = FXH.gauss();
        pos[i * 3] = Math.cos(ang) * rad + gx * spread;
        pos[i * 3 + 1] = gy * spread * 0.4 * (1.05 - rad / R);
        pos[i * 3 + 2] = Math.sin(ang) * rad + gx * spread;
        const t = rad / R, k = (1 - t) * (1 - t) * 0.75;
        const p = pal[arm], b = FXH.r(0.45, 1);
        col[i * 3] = (p[0] + (core[0] - p[0]) * k) * b;
        col[i * 3 + 1] = (p[1] + (core[1] - p[1]) * k) * b;
        col[i * 3 + 2] = (p[2] + (core[2] - p[2]) * k) * b;
        siz[i] = rad < 1.3 ? FXH.r(0.24, 0.4) : FXH.r(0.06, 0.15);
        alp[i] = rad < 1.3 ? 0.95 : FXH.r(0.35, 0.9);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
      const mat = FXH.pointsMat(1);
      g.add(new THREE.Points(geo, mat));

      /* 核心辉光 */
      const glowMat = (c, s, o) => {
        const m = new THREE.SpriteMaterial({
          map: FXH.glowTex(), color: c, transparent: true, opacity: o,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const sp = new THREE.Sprite(m);
        sp.scale.set(s, s, 1);
        return sp;
      };
      const core1 = glowMat(0xfff0d0, 7, 0.85);
      const core2 = glowMat(0x7ab8ff, 15, 0.22);
      g.add(core1, core2);

      /* 远景星幕 */
      const BN = 1500;
      const bp = new Float32Array(BN * 3), bc = new Float32Array(BN * 3);
      const bs = new Float32Array(BN), ba = new Float32Array(BN);
      for (let i = 0; i < BN; i++) {
        const rr = FXH.r(55, 95), th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1));
        bp[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        bp[i * 3 + 1] = rr * Math.cos(ph);
        bp[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
        const b = FXH.r(0.3, 0.85);
        bc[i * 3] = b; bc[i * 3 + 1] = b; bc[i * 3 + 2] = b * FXH.r(0.9, 1.15);
        bs[i] = FXH.r(0.12, 0.4);
        ba[i] = FXH.r(0.15, 0.6);
      }
      const bgeo = new THREE.BufferGeometry();
      bgeo.setAttribute("position", new THREE.BufferAttribute(bp, 3));
      bgeo.setAttribute("aColor", new THREE.BufferAttribute(bc, 3));
      bgeo.setAttribute("aSize", new THREE.BufferAttribute(bs, 1));
      bgeo.setAttribute("aAlpha", new THREE.BufferAttribute(ba, 1));
      const bmat = FXH.pointsMat(1);
      const bgStars = new THREE.Points(bgeo, bmat);
      scene.add(bgStars);

      /* 星潮冲击环池 */
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const rg = new THREE.RingGeometry(0.965, 1, 96);
        const rm = new THREE.MeshBasicMaterial({
          color: 0x9ef2ff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        });
        const mesh = new THREE.Mesh(rg, rm);
        mesh.rotation.x = Math.PI / 2;
        mesh.visible = false;
        g.add(mesh);
        rings.push({ mesh, t: 1 });
      }
      let ringIdx = 0;
      function pulseRing(x, z) {
        const r = rings[ringIdx++ % rings.length];
        r.mesh.position.set(x, 0, z);
        r.mesh.visible = true;
        r.t = 0;
        r.mesh.material.color.setHex(Math.random() < 0.5 ? 0x9ef2ff : 0xffa9ec);
      }

      camera.position.set(0, 7.5, 18);
      camera.lookAt(0, 0, 0);

      return {
        update(dt, t) {
          g.rotation.y += dt * 0.07;
          bgStars.rotation.y = -t * 0.004;
          camera.position.x += (env.mouse.x * 3.4 - camera.position.x) * 0.045;
          camera.position.y += (7.5 - env.mouse.y * 2.4 - camera.position.y) * 0.045;
          camera.lookAt(0, 0, 0);
          core1.material.opacity = 0.75 + 0.12 * Math.sin(t * 2.1);
          core2.scale.setScalar(15 + Math.sin(t * 1.3) * 1.6);
          for (const r of rings) {
            if (!r.mesh.visible) continue;
            r.t += dt / 0.95;
            if (r.t >= 1) { r.mesh.visible = false; continue; }
            const e = 1 - Math.pow(1 - r.t, 3);
            r.mesh.scale.setScalar(0.5 + e * 17);
            r.mesh.material.opacity = 0.62 * (1 - r.t);
          }
        },
        onClick() {
          pulseRing(FXH.r(-3, 3), FXH.r(-3, 3));
        },
        onResize() {
          mat.uniforms.uSize.value = FXH.pointScale();
          bmat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },

  /* ═══════════ 02 · 极光 AURORA ═══════════ */
  {
    key: "aurora",
    title: "极光",
    en: "AURORA",
    sub: "域扭曲 fbm 噪声织成的流动光幕，指针牵引其流向",
    hint: "左右移动鼠标 · 牵引极光帷幕",
    create(env) {
      const { scene } = env;
      /* 全屏着色器（屏幕空间，不随相机） */
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uMouse: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
        vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader: [
          "precision highp float;",
          "uniform float uTime; uniform float uMouse; uniform vec2 uRes;",
          "float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}",
          "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
          "  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
          "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}",
          "void main(){",
          "  vec2 uv=gl_FragCoord.xy/uRes;",
          "  vec2 asp=vec2(uRes.x/uRes.y,1.);",
          "  vec2 p=(uv*2.-1.)*asp;",
          "  float t=uTime*0.12;",
          "  vec3 col=vec3(0.012,0.016,0.05);",
          /* 星空 */
          "  vec2 sp=floor(gl_FragCoord.xy/3.0);",
          "  float star=step(0.9962,hash(sp))*(0.5+0.5*sin(uTime*2.2+hash(sp+7.0)*40.0));",
          "  col+=star*vec3(0.8,0.9,1.0)*smoothstep(0.0,0.45,uv.y)*0.9;",
          /* 极光帷幕 */
          "  float a=0.;",
          "  for(float i=1.;i<=4.;i++){",
          "    float x=uv.x*asp.x*1.35+uMouse*0.55*i;",
          "    float wave=fbm(vec2(x*1.15,t*0.65+i*3.7));",
          "    float y0=0.72+0.15*sin(uv.x*4.2+t*2.1+i*1.7)+wave*0.24;",
          "    float band=exp(-abs(uv.y-y0)*(15.-i*2.2));",
          "    float shimmer=pow(0.5+0.5*sin(x*26.+t*17.+i*9.),2.);",
          "    a+=band*(0.42+shimmer*0.85)/i;",
          "  }",
          "  vec3 ac=mix(vec3(0.1,1.0,0.62),vec3(0.42,0.34,1.0),uv.x+0.3*sin(t));",
          "  ac=mix(ac,vec3(1.0,0.42,0.85),pow(1.-uv.y,2.)*0.6);",
          "  col+=a*ac*1.15;",
          /* 地平线辉光与山影 */
          "  float horizon=exp(-abs(uv.y-0.05)*8.);",
          "  col+=horizon*vec3(0.22,0.5,0.62)*0.4;",
          "  float ridge=fbm(vec2(p.x*0.85+3.,1.))*0.5+fbm(vec2(p.x*2.4,7.))*0.24;",
          "  float h=0.025+ridge*0.135;",
          "  float mountain=1.0-smoothstep(h,h+0.004,uv.y);",
          "  col=mix(col,vec3(0.004,0.007,0.024),mountain*0.97);",
          /* 渐晕 */
          "  float vig=1.-dot(p*0.55,p*0.55);",
          "  col*=clamp(vig,0.,1.);",
          "  gl_FragColor=vec4(col,1.);",
          "}",
        ].join("\n"),
        depthWrite: false,
        depthTest: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      quad.frustumCulled = false;
      quad.renderOrder = -10;
      scene.add(quad);

      /* 3D 光尘（视差层） */
      const N = 420;
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const siz = new Float32Array(N), alp = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = FXH.r(-16, 16);
        pos[i * 3 + 1] = FXH.r(-6, 9);
        pos[i * 3 + 2] = FXH.r(-8, 4);
        const c = Math.random();
        if (c < 0.4) { col[i * 3] = 0.25; col[i * 3 + 1] = 1; col[i * 3 + 2] = 0.75; }
        else if (c < 0.8) { col[i * 3] = 0.55; col[i * 3 + 1] = 0.4; col[i * 3 + 2] = 1; }
        else { col[i * 3] = 0.9; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 1; }
        siz[i] = FXH.r(0.05, 0.18);
        alp[i] = FXH.r(0.25, 0.75);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
      const pmat = FXH.pointsMat(1);
      const motes = new THREE.Points(geo, pmat);
      scene.add(motes);

      /* 点击涟漪环 */
      const ripples = [];
      for (let i = 0; i < 4; i++) {
        const rm = new THREE.MeshBasicMaterial({
          color: 0x8affd0, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 72), rm);
        mesh.visible = false;
        scene.add(mesh);
        ripples.push({ mesh, t: 1 });
      }
      let rIdx = 0;

      env.camera.position.set(0, 0, 10);
      env.camera.lookAt(0, 0, 0);

      return {
        update(dt, t) {
          mat.uniforms.uTime.value = t;
          mat.uniforms.uMouse.value += (env.mouse.x - mat.uniforms.uMouse.value) * 0.03;
          motes.rotation.y = t * 0.014 + env.mouse.x * 0.1;
          motes.position.y = Math.sin(t * 0.22) * 0.5;
          for (const r of ripples) {
            if (!r.mesh.visible) continue;
            r.t += dt / 0.8;
            if (r.t >= 1) { r.mesh.visible = false; continue; }
            const e = 1 - Math.pow(1 - r.t, 3);
            r.mesh.scale.setScalar(0.3 + e * 7);
            r.mesh.material.opacity = 0.55 * (1 - r.t);
          }
        },
        onClick() {
          const r = ripples[rIdx++ % ripples.length];
          r.mesh.position.set(env.mouse.x * 9, env.mouse.y * 5, -2);
          r.mesh.visible = true;
          r.t = 0;
          r.mesh.material.color.setHex(Math.random() < 0.5 ? 0x8affd0 : 0xc59bff);
        },
        onResize(w, h) {
          mat.uniforms.uRes.value.set(w, h);
          pmat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },

  /* ═══════════ 03 · 星尘字 MORPH ═══════════ */
  {
    key: "morph",
    title: "星尘字",
    en: "MORPH",
    sub: "九千颗粒子以弹簧力学凝聚成文字，再散作星尘",
    hint: "点击 · 立即凝聚下一个词",
    create(env) {
      const { scene, camera } = env;
      const WORDS = ["你好 世界", "星辰 大海", "无限 可能", "AURORA", "宇宙 浪漫", "光 即 代码"];
      const N = 9000;
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const siz = new Float32Array(N), alp = new Float32Array(N);
      const vel = new Float32Array(N * 3);
      const tgt = new Float32Array(N * 3);
      const phase = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        /* 初始：随机球壳 */
        const rr = FXH.r(8, 22), th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1));
        pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = rr * Math.cos(ph);
        pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
        tgt[i * 3] = pos[i * 3]; tgt[i * 3 + 1] = pos[i * 3 + 1]; tgt[i * 3 + 2] = pos[i * 3 + 2];
        const c = Math.random();
        if (c < 0.5) { col[i * 3] = 0.3; col[i * 3 + 1] = 0.92; col[i * 3 + 2] = 1; }
        else if (c < 0.85) { col[i * 3] = 1; col[i * 3 + 1] = 0.4; col[i * 3 + 2] = 0.8; }
        else { col[i * 3] = 1; col[i * 3 + 1] = 0.83; col[i * 3 + 2] = 0.5; }
        siz[i] = FXH.r(0.05, 0.14);
        alp[i] = FXH.r(0.4, 0.95);
        phase[i] = FXH.r(0, FXH.TAU);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
      const mat = FXH.pointsMat(1);
      const group = new THREE.Group();
      group.add(new THREE.Points(geo, mat));
      scene.add(group);

      /* 采样文字 → 世界坐标目标点 */
      const sc = document.createElement("canvas");
      sc.width = 1000; sc.height = 280;
      const sctx = sc.getContext("2d");
      function sample(word) {
        sctx.clearRect(0, 0, 1000, 280);
        sctx.font = '900 175px "Noto Sans SC","Segoe UI",sans-serif';
        sctx.textAlign = "center";
        sctx.textBaseline = "middle";
        sctx.fillStyle = "#fff";
        sctx.fillText(word, 500, 148);
        const img = sctx.getImageData(0, 0, 1000, 280).data;
        const pts = [];
        const step = 3;
        for (let y = 0; y < 280; y += step) {
          for (let x = 0; x < 1000; x += step) {
            if (img[(y * 1000 + x) * 4 + 3] > 128) pts.push([x, y]);
          }
        }
        /* 归一化到世界宽度 ≤ 15 */
        const s = 15 / 1000;
        return pts.map(([x, y]) => [(x - 500) * s, (140 - y) * s]);
      }
      let wordIdx = 0;
      function retarget() {
        const word = WORDS[wordIdx++ % WORDS.length];
        let pts = sample(word);
        if (!pts.length) return word;
        /* 不足 N 时复制带抖动，超出时随机取样 */
        while (pts.length < N) {
          const base = pts[Math.floor(Math.random() * pts.length)];
          pts.push([base[0] + FXH.r(-0.03, 0.03), base[1] + FXH.r(-0.03, 0.03)]);
        }
        /* 洗牌，制造重组混沌 */
        for (let i = pts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = pts[i]; pts[i] = pts[j]; pts[j] = tmp;
        }
        for (let i = 0; i < N; i++) {
          tgt[i * 3] = pts[i][0];
          tgt[i * 3 + 1] = pts[i][1];
          tgt[i * 3 + 2] = FXH.r(-0.35, 0.35);
        }
        return word;
      }

      let wordTimer = 0;
      retarget(); /* 开场即凝聚第一个词 */
      camera.position.set(0, 0, 16.5);
      camera.lookAt(0, 0, 0);

      return {
        update(dt, t) {
          wordTimer += dt;
          if (wordTimer > 3.8) { wordTimer = 0; retarget(); }
          const ks = 30, kd = 5.2;
          for (let i = 0; i < N; i++) {
            const i3 = i * 3;
            const jx = Math.sin(t * 1.7 + phase[i]) * 0.028;
            const jy = Math.cos(t * 1.3 + phase[i] * 1.7) * 0.028;
            vel[i3] += (tgt[i3] + jx - pos[i3]) * ks * dt;
            vel[i3 + 1] += (tgt[i3 + 1] + jy - pos[i3 + 1]) * ks * dt;
            vel[i3 + 2] += (tgt[i3 + 2] - pos[i3 + 2]) * ks * dt;
            const damp = Math.exp(-kd * dt);
            vel[i3] *= damp; vel[i3 + 1] *= damp; vel[i3 + 2] *= damp;
            pos[i3] += vel[i3] * dt;
            pos[i3 + 1] += vel[i3 + 1] * dt;
            pos[i3 + 2] += vel[i3 + 2] * dt;
          }
          geo.attributes.position.needsUpdate = true;
          group.rotation.y += (env.mouse.x * 0.32 - group.rotation.y) * 0.05;
          group.rotation.x += (-env.mouse.y * 0.2 - group.rotation.x) * 0.05;
        },
        onClick() {
          wordTimer = 0;
          retarget();
        },
        onResize() {
          mat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },

  /* ═══════════ 04 · 烟火 FIREWORKS ═══════════ */
  {
    key: "fireworks",
    title: "烟火",
    en: "FIREWORKS",
    sub: "六型弹道 · 重力 / 拖曳 / 余烬闪烁物理，水面留有倒影",
    hint: "点击夜空 · 在指尖处绽放",
    create(env) {
      const { scene, camera } = env;
      const MAX = 7000;
      const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
      const siz = new Float32Array(MAX), alp = new Float32Array(MAX);
      const vel = new Float32Array(MAX * 3);
      const life = new Float32Array(MAX), age = new Float32Array(MAX);
      const baseS = new Float32Array(MAX), flick = new Float32Array(MAX);
      const grav = new Float32Array(MAX), drag = new Float32Array(MAX);
      const alive = new Uint8Array(MAX);
      let cursor = 0;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
      /* 高频重传提示 */
      geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
      geo.attributes.aColor.setUsage(THREE.DynamicDrawUsage);
      geo.attributes.aSize.setUsage(THREE.DynamicDrawUsage);
      geo.attributes.aAlpha.setUsage(THREE.DynamicDrawUsage);
      const mat = FXH.pointsMat(1);
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      /* 水面倒影（镜像 + 减淡） */
      const mat2 = FXH.pointsMat(1, 0.24);
      const refl = new THREE.Points(geo, mat2);
      refl.scale.y = -1;
      refl.position.y = -13.6;
      scene.add(refl);

      function spawn(x, y, vx, vy, vz, c, size, lf, gv, dg) {
        const i = cursor++ % MAX;
        alive[i] = 1;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0;
        vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        life[i] = lf; age[i] = 0;
        baseS[i] = size; siz[i] = size;
        alp[i] = 1;
        grav[i] = gv; drag[i] = dg;
        flick[i] = Math.random() < 0.5 ? FXH.r(6, 14) : 0;
        return i; /* 返回槽位，便于调用方覆写参数 */
      }

      const PAL = [
        [1, 0.72, 0.35], [0.35, 0.95, 1], [1, 0.35, 0.75],
        [0.6, 0.45, 1], [0.5, 1, 0.6], [1, 1, 0.85],
      ];
      const TYPES = ["peony", "willow", "ring", "heart", "rainbow", "crackle"];
      function explode(x, y, type, palIdx) {
        const typeUse = type || TYPES[Math.floor(Math.random() * TYPES.length)];
        const cBase = palIdx === undefined ? Math.floor(Math.random() * PAL.length) : palIdx;
        const n = typeUse === "willow" ? 95 : 170;
        for (let i = 0; i < n; i++) {
          let vx, vy, vz, c = PAL[cBase], gv = -3.4, dg = 0.9, lf = FXH.r(1.1, 1.7), sz = FXH.r(0.09, 0.16);
          if (typeUse === "peony") {
            const th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1)), sp = FXH.r(4, 10.5);
            vx = sp * Math.sin(ph) * Math.cos(th); vy = sp * Math.cos(ph); vz = sp * Math.sin(ph) * Math.sin(th);
          } else if (typeUse === "willow") {
            const th = FXH.r(0, FXH.TAU), sp = FXH.r(2.5, 6.5);
            vx = Math.cos(th) * sp; vy = Math.sin(th) * sp * 0.8 + 1.2; vz = FXH.r(-2, 2);
            c = [1, 0.72, 0.35]; gv = -5.2; dg = 0.25; lf = FXH.r(2.4, 3.4); sz = FXH.r(0.07, 0.12);
          } else if (typeUse === "ring") {
            const th = (i / n) * FXH.TAU, tilt = FXH.r(0.3, 1.2), sp = 8.6;
            const x0 = Math.cos(th), y0 = Math.sin(th);
            vx = x0 * sp; vy = y0 * sp * Math.cos(tilt) + 0.6; vz = y0 * sp * Math.sin(tilt);
          } else if (typeUse === "heart") {
            const tt = (i / n) * FXH.TAU;
            const hx = 16 * Math.pow(Math.sin(tt), 3);
            const hy = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt);
            const sp = 0.42;
            vx = hx * sp; vy = hy * sp + 1.5; vz = FXH.r(-0.6, 0.6);
            c = [1, 0.3, 0.55];
          } else if (typeUse === "rainbow") {
            const th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1)), sp = FXH.r(4, 9);
            vx = sp * Math.sin(ph) * Math.cos(th); vy = sp * Math.cos(ph); vz = sp * Math.sin(ph) * Math.sin(th);
            const hue = th / FXH.TAU;
            c = [0.5 + 0.5 * Math.sin(hue * 6.28), 0.5 + 0.5 * Math.sin(hue * 6.28 + 2.1), 0.5 + 0.5 * Math.sin(hue * 6.28 + 4.2)];
          } else { /* crackle */
            const th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1)), sp = FXH.r(5, 12);
            vx = sp * Math.sin(ph) * Math.cos(th); vy = sp * Math.cos(ph); vz = sp * Math.sin(ph) * Math.sin(th);
            lf = FXH.r(0.5, 1.1); dg = 1.6;
          }
          const slot = spawn(x, y, vx, vy, vz, c, sz, lf, gv, dg);
          if (typeUse === "crackle") flick[slot] = FXH.r(18, 40);
        }
        /* 主色爆闪 + 冲击波环 */
        const fc = typeUse === "heart" ? [1, 0.45, 0.65] : (typeUse === "rainbow" ? [0.9, 0.9, 1] : PAL[cBase]);
        flashes.push({ x, y, t: 0, c: fc });
        shockwave(x, y, fc);
      }

      /* 爆闪辉光 */
      const flashes = [];
      const flashMats = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.SpriteMaterial({
          map: FXH.glowTex(), color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const sp = new THREE.Sprite(m);
        scene.add(sp);
        flashMats.push({ sp, m });
      }

      /* 爆炸冲击波环 */
      const waves = [];
      for (let i = 0; i < 5; i++) {
        const wm = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), wm);
        mesh.visible = false;
        scene.add(mesh);
        waves.push({ mesh, t: 1 });
      }
      let waveIdx = 0;
      function shockwave(x, y, c) {
        const w = waves[waveIdx++ % waves.length];
        w.mesh.position.set(x, y, 0.2);
        w.mesh.visible = true;
        w.t = 0;
        w.mesh.material.color.setRGB(c[0], c[1], c[2]);
      }

      /* 上升的火箭 */
      const rockets = [];
      function launch(x, yTarget, type) {
        rockets.push({ x, y: -6.8, vy: FXH.r(9, 12), yTarget, type });
      }

      /* 月亮与星幕 */
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: FXH.glowTex(), color: 0xcfe4ff, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      moon.position.set(9.5, 6.5, -12);
      moon.scale.set(7, 7, 1);
      scene.add(moon);

      const SN = 900;
      const spos = new Float32Array(SN * 3), scol = new Float32Array(SN * 3);
      const ssz = new Float32Array(SN), sal = new Float32Array(SN);
      for (let i = 0; i < SN; i++) {
        spos[i * 3] = FXH.r(-30, 30); spos[i * 3 + 1] = FXH.r(-4, 16); spos[i * 3 + 2] = FXH.r(-25, -6);
        const b = FXH.r(0.25, 0.8);
        scol[i * 3] = b; scol[i * 3 + 1] = b; scol[i * 3 + 2] = b;
        ssz[i] = FXH.r(0.08, 0.25); sal[i] = FXH.r(0.2, 0.7);
      }
      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
      sgeo.setAttribute("aColor", new THREE.BufferAttribute(scol, 3));
      sgeo.setAttribute("aSize", new THREE.BufferAttribute(ssz, 1));
      sgeo.setAttribute("aAlpha", new THREE.BufferAttribute(sal, 1));
      const smat = FXH.pointsMat(1);
      scene.add(new THREE.Points(sgeo, smat));

      /* 水面（先于倒影绘制，不写深度以露出倒影） */
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 18),
        new THREE.MeshBasicMaterial({ color: 0x030714, transparent: true, opacity: 0.85, depthWrite: false })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -6.85;
      water.renderOrder = -5;
      scene.add(water);

      camera.position.set(0, 0.5, 23);
      camera.lookAt(0, 1, 0);

      let autoT = 0.4;

      return {
        update(dt, t) {
          autoT -= dt;
          if (autoT <= 0) {
            autoT = FXH.r(0.55, 1.25);
            launch(FXH.r(-9, 9), FXH.r(2.5, 7.5));
          }
          /* 火箭 */
          for (let i = rockets.length - 1; i >= 0; i--) {
            const rk = rockets[i];
            rk.y += rk.vy * dt;
            rk.vy -= 1.2 * dt;
            spawn(rk.x + FXH.r(-0.05, 0.05), rk.y - 0.3, FXH.r(-0.3, 0.3), FXH.r(-0.5, 0.2), FXH.r(-0.3, 0.3), [1, 0.85, 0.6], 0.08, FXH.r(0.3, 0.5), -0.5, 1);
            if (rk.y >= rk.yTarget || rk.vy < 2.5) {
              explode(rk.x, rk.y, rk.type);
              rockets.splice(i, 1);
            }
          }
          /* 火花 */
          for (let i = 0; i < MAX; i++) {
            if (!alive[i]) continue;
            age[i] += dt;
            if (age[i] >= life[i]) { alive[i] = 0; alp[i] = 0; continue; }
            const dr = Math.exp(-drag[i] * dt);
            vel[i * 3] *= dr;
            vel[i * 3 + 1] *= dr;
            vel[i * 3 + 2] *= dr;
            vel[i * 3 + 1] += grav[i] * dt;
            pos[i * 3] += vel[i * 3] * dt;
            pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
            pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            const k = 1 - age[i] / life[i];
            siz[i] = baseS[i] * (0.4 + 0.6 * k);
            alp[i] = flick[i] ? k * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * flick[i]))) : k;
          }
          geo.attributes.position.needsUpdate = true;
          geo.attributes.aColor.needsUpdate = true;
          geo.attributes.aSize.needsUpdate = true;
          geo.attributes.aAlpha.needsUpdate = true;
          /* 冲击波环 */
          for (const w of waves) {
            if (!w.mesh.visible) continue;
            w.t += dt / 0.55;
            if (w.t >= 1) { w.mesh.visible = false; continue; }
            const e = 1 - Math.pow(1 - w.t, 3);
            w.mesh.scale.setScalar(0.4 + e * 6.5);
            w.mesh.material.opacity = 0.5 * (1 - w.t);
          }
          /* 爆闪 */
          for (let i = flashes.length - 1; i >= 0; i--) {
            const f = flashes[i];
            f.t += dt / 0.4;
            if (f.t >= 1) { flashes.splice(i, 1); continue; }
            const slot = flashMats[i % flashMats.length];
            slot.sp.position.set(f.x, f.y, 0);
            slot.sp.scale.setScalar(2 + f.t * 5);
            slot.m.opacity = 0.85 * (1 - f.t);
            slot.m.color.setRGB(f.c[0], f.c[1], f.c[2]);
          }
          for (let i = flashes.length; i < flashMats.length; i++) flashMats[i].m.opacity = 0;
          moon.material.opacity = 0.68 + 0.08 * Math.sin(t * 0.7);
          camera.position.x += (env.mouse.x * 1.6 - camera.position.x) * 0.04;
          camera.lookAt(0, 1, 0);
        },
        onClick() {
          /* NDC → z=0 平面世界坐标 */
          const v = new THREE.Vector3(env.mouse.x, env.mouse.y, 0.5).unproject(camera);
          const dir = v.sub(camera.position).normalize();
          const dist = -camera.position.z / dir.z;
          const p = camera.position.clone().add(dir.multiplyScalar(dist));
          launch(p.x, Math.max(-2, Math.min(8, p.y)), TYPES[Math.floor(Math.random() * TYPES.length)]);
        },
        onResize() {
          mat.uniforms.uSize.value = FXH.pointScale();
          smat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },

  /* ═══════════ 05 · 霓虹 SYNTHWAVE ═══════════ */
  {
    key: "synthwave",
    title: "霓虹大地",
    en: "SYNTHWAVE",
    sub: "顶点位移的线框山脊，向着复古太阳无限狂飙",
    hint: "点击 · 涡轮加速",
    create(env) {
      const { scene, camera } = env;
      scene.background = new THREE.Color(0x070312);

      /* 山脊地形（线框 + 高度渐变 + 距离雾） */
      const tg = new THREE.PlaneGeometry(240, 240, 170, 100);
      tg.rotateX(-Math.PI / 2);
      const tMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: [
          "uniform float uTime;",
          "varying float vH; varying float vD;",
          "float h(vec2 q){",
          "  return pow(abs(sin(q.x*0.12)),1.5)*2.6",
          "       + pow(abs(sin(q.y*0.05+q.x*0.021)),2.0)*5.4",
          "       + sin(q.y*0.31+q.x*0.04)*0.35;",
          "}",
          "void main(){",
          "  vec3 p=position;",
          "  float s=-p.z+uTime*10.0;", /* local z 是平面法向轴；位移用 y */
          "  vec3 pp=vec3(p.x, p.y, p.z);",
          "  float mask=smoothstep(3.2,11.0,abs(p.x));",
          "  float hh=h(vec2(s,p.x))*mask;",
          "  pp.y+=hh;",
          "  vH=hh;",
          "  vec4 mv=modelViewMatrix*vec4(pp,1.0);",
          "  vD=-mv.z;",
          "  gl_Position=projectionMatrix*mv;",
          "}",
        ].join("\n"),
        fragmentShader: [
          "varying float vH; varying float vD;",
          "void main(){",
          "  vec3 c=mix(vec3(0.10,0.03,0.34),vec3(1.0,0.18,0.62),clamp(vH/6.5,0.,1.));",
          "  c+=vec3(0.12,0.55,1.0)*smoothstep(4.6,6.4,vH)*0.65;",
          "  float f=smoothstep(16.,85.,vD);",
          "  c=mix(c,vec3(0.028,0.012,0.088),f);",
          "  gl_FragColor=vec4(c,0.94);",
          "}",
        ].join("\n"),
        wireframe: true,
        transparent: true,
      });
      const terrain = new THREE.Mesh(tg, tMat);
      scene.add(terrain);

      /* 复古太阳（横纹切割 + 渐变） */
      const sunMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
        fragmentShader: [
          "uniform float uTime; varying vec2 vUv;",
          "void main(){",
          "  vec3 c=mix(vec3(1.0,0.86,0.35),vec3(1.0,0.18,0.55),smoothstep(0.12,0.92,vUv.y));",
          "  float stripes=step(0.42+0.5*(1.0-vUv.y),fract(vUv.y*22.0-uTime*0.55));",
          "  c*=mix(1.0,stripes,smoothstep(0.55,0.1,vUv.y));",
          "  float edge=smoothstep(0.5,0.47,length(vUv-0.5));",
          "  gl_FragColor=vec4(c,edge);",
          "}",
        ].join("\n"),
        transparent: true,
      });
      const sun = new THREE.Mesh(new THREE.CircleGeometry(11, 72), sunMat);
      sun.position.set(0, 8.5, -78);
      scene.add(sun);
      const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: FXH.glowTex(), color: 0xff3d8e, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sunGlow.position.copy(sun.position);
      sunGlow.scale.set(44, 44, 1);
      scene.add(sunGlow);

      /* 路灯流 */
      const LN = 90;
      const lpos = new Float32Array(LN * 3), lcol = new Float32Array(LN * 3);
      const lsz = new Float32Array(LN), lal = new Float32Array(LN);
      for (let i = 0; i < LN; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        lpos[i * 3] = side * 4.6;
        lpos[i * 3 + 1] = 1.1;
        lpos[i * 3 + 2] = -((i / 2) * 6 + (i % 2) * 3) - 4;
        if (side < 0) { lcol[i * 3] = 1; lcol[i * 3 + 1] = 0.25; lcol[i * 3 + 2] = 0.62; }
        else { lcol[i * 3] = 0.25; lcol[i * 3 + 1] = 0.9; lcol[i * 3 + 2] = 1; }
        lsz[i] = 0.35; lal[i] = 0.9;
      }
      const lgeo = new THREE.BufferGeometry();
      lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
      lgeo.setAttribute("aColor", new THREE.BufferAttribute(lcol, 3));
      lgeo.setAttribute("aSize", new THREE.BufferAttribute(lsz, 1));
      lgeo.setAttribute("aAlpha", new THREE.BufferAttribute(lal, 1));
      const lmat = FXH.pointsMat(1);
      scene.add(new THREE.Points(lgeo, lmat));

      /* 星幕 */
      const SN = 1100;
      const spos = new Float32Array(SN * 3), scol = new Float32Array(SN * 3);
      const ssz = new Float32Array(SN), sal = new Float32Array(SN);
      for (let i = 0; i < SN; i++) {
        spos[i * 3] = FXH.r(-120, 120); spos[i * 3 + 1] = FXH.r(4, 70); spos[i * 3 + 2] = FXH.r(-140, -60);
        const b = FXH.r(0.2, 0.75);
        scol[i * 3] = b; scol[i * 3 + 1] = b * 0.9; scol[i * 3 + 2] = b;
        ssz[i] = FXH.r(0.1, 0.35); sal[i] = FXH.r(0.15, 0.6);
      }
      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
      sgeo.setAttribute("aColor", new THREE.BufferAttribute(scol, 3));
      sgeo.setAttribute("aSize", new THREE.BufferAttribute(ssz, 1));
      sgeo.setAttribute("aAlpha", new THREE.BufferAttribute(sal, 1));
      const smat = FXH.pointsMat(1);
      scene.add(new THREE.Points(sgeo, smat));

      camera.position.set(0, 5.6, 24);
      camera.lookAt(0, 5, -40);

      let speed = 1, tt = 0;

      return {
        update(dt, t) {
          speed += (1 - speed) * dt * 0.7;
          tt += dt * speed;
          tMat.uniforms.uTime.value = tt;
          sunMat.uniforms.uTime.value = t;
          /* 路灯向后飞 */
          const pa = lgeo.attributes.position;
          for (let i = 0; i < LN; i++) {
            let z = pa.array[i * 3 + 2] + dt * speed * 42;
            if (z > 26) z -= 6 * Math.ceil(LN / 2);
            pa.array[i * 3 + 2] = z;
          }
          pa.needsUpdate = true;
          camera.position.x += (env.mouse.x * 2.2 - camera.position.x) * 0.05;
          camera.lookAt(0, 5, -40);
          camera.rotation.z += -env.mouse.x * 0.045;
          sunGlow.material.opacity = 0.42 + 0.1 * Math.sin(t * 1.4);
        },
        onClick() {
          speed = 4.2;
        },
        onResize() {
          lmat.uniforms.uSize.value = FXH.pointScale();
          smat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },

  /* ═══════════ 06 · 等离子 PLASMA ═══════════ */
  {
    key: "plasma",
    title: "等离子核心",
    en: "PLASMA",
    sub: "三维单纯形噪声驱动的液态星球，菲涅尔边缘发亮",
    hint: "拖拽旋转 · 点击引发能量脉冲",
    create(env) {
      const { scene, camera } = env;
      const group = new THREE.Group();
      scene.add(group);

      /* 液态星球 */
      const oMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAmp: { value: 0.45 } },
        vertexShader: FXH.SNOISE + [
          "uniform float uTime; uniform float uAmp;",
          "varying float vN; varying vec3 vNor; varying vec3 vView;",
          "void main(){",
          "  float n=snoise(position*1.55+vec3(0.,uTime*0.18,0.));",
          "  float n2=snoise(position*4.2-vec3(uTime*0.12,0.,uTime*0.1));",
          "  float d=(n*0.72+n2*0.28)*uAmp;",
          "  vec3 p=position+normal*d;",
          "  vN=n*0.5+0.5;",
          "  vNor=normalize(normalMatrix*normal);",
          "  vec4 mv=modelViewMatrix*vec4(p,1.);",
          "  vView=normalize(-mv.xyz);",
          "  gl_Position=projectionMatrix*mv;",
          "}",
        ].join("\n"),
        fragmentShader: [
          "varying float vN; varying vec3 vNor; varying vec3 vView;",
          "void main(){",
          "  float fr=pow(1.0-abs(dot(normalize(vNor),normalize(vView))),2.2);",
          "  vec3 a=mix(vec3(0.05,0.01,0.16),vec3(0.46,0.15,1.0),smoothstep(0.12,0.85,vN));",
          "  a=mix(a,vec3(0.16,0.92,1.0),smoothstep(0.55,1.0,vN)*0.85);",
          "  vec3 c=a+fr*vec3(0.55,0.85,1.0)*1.25;",
          "  gl_FragColor=vec4(c,1.0);",
          "}",
        ].join("\n"),
      });
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 5), oMat);
      group.add(orb);

      /* 光环 */
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: 0x53e9ff, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const ringMat2 = ringMat1.clone();
      ringMat2.color.setHex(0xff5ec8);
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.016, 8, 128), ringMat1);
      ring1.rotation.x = Math.PI / 2.4;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.012, 8, 128), ringMat2);
      ring2.rotation.x = Math.PI / 1.9;
      ring2.rotation.y = 0.6;
      group.add(ring1, ring2);

      /* 卫星 */
      const moons = [];
      const moonOrbits = [
        { r: 3.6, spd: 0.7, incl: 0.4, c: 0x53e9ff },
        { r: 4.3, spd: -0.45, incl: 1.1, c: 0xff5ec8 },
        { r: 3.0, spd: 1.0, incl: 2.0, c: 0xffcf7a },
      ];
      for (const o of moonOrbits) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 16, 16),
          new THREE.MeshBasicMaterial({ color: o.c })
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: FXH.glowTex(), color: o.c, transparent: true, opacity: 0.65,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.scale.set(1.1, 1.1, 1);
        m.add(glow);
        scene.add(m);
        moons.push({ mesh: m, ...o, a: FXH.r(0, FXH.TAU) });
      }

      /* 晕层粒子壳 */
      const HN = 900;
      const hpos = new Float32Array(HN * 3), hcol = new Float32Array(HN * 3);
      const hsz = new Float32Array(HN), hal = new Float32Array(HN);
      for (let i = 0; i < HN; i++) {
        const rr = FXH.r(2.2, 3.6), th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1));
        hpos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        hpos[i * 3 + 1] = rr * Math.cos(ph) * 0.8;
        hpos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
        const c = Math.random();
        if (c < 0.45) { hcol[i * 3] = 0.32; hcol[i * 3 + 1] = 0.91; hcol[i * 3 + 2] = 1; }
        else if (c < 0.8) { hcol[i * 3] = 1; hcol[i * 3 + 1] = 0.37; hcol[i * 3 + 2] = 0.78; }
        else { hcol[i * 3] = 1; hcol[i * 3 + 1] = 0.8; hcol[i * 3 + 2] = 0.48; }
        hsz[i] = FXH.r(0.04, 0.1);
        hal[i] = FXH.r(0.3, 0.8);
      }
      const hgeo = new THREE.BufferGeometry();
      hgeo.setAttribute("position", new THREE.BufferAttribute(hpos, 3));
      hgeo.setAttribute("aColor", new THREE.BufferAttribute(hcol, 3));
      hgeo.setAttribute("aSize", new THREE.BufferAttribute(hsz, 1));
      hgeo.setAttribute("aAlpha", new THREE.BufferAttribute(hal, 1));
      const hmat = FXH.pointsMat(1);
      const halo = new THREE.Points(hgeo, hmat);
      scene.add(halo);

      /* 星云底幕 */
      const nebulas = [];
      const nebColors = [0x3a1f7a, 0x0e4a6e, 0x5a1650, 0x143a5a];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.SpriteMaterial({
          map: FXH.glowTex(), color: nebColors[i % nebColors.length],
          transparent: true, opacity: FXH.r(0.1, 0.2),
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const sp = new THREE.Sprite(m);
        sp.position.set(FXH.r(-18, 18), FXH.r(-8, 10), FXH.r(-42, -24));
        sp.scale.setScalar(FXH.r(14, 30));
        scene.add(sp);
        nebulas.push({ sp, spd: FXH.r(0.02, 0.06) });
      }

      /* 远星 */
      const SN = 800;
      const spos = new Float32Array(SN * 3), scol = new Float32Array(SN * 3);
      const ssz = new Float32Array(SN), sal = new Float32Array(SN);
      for (let i = 0; i < SN; i++) {
        const rr = FXH.r(40, 80), th = FXH.r(0, FXH.TAU), ph = Math.acos(FXH.r(-1, 1));
        spos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        spos[i * 3 + 1] = rr * Math.cos(ph);
        spos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
        const b = FXH.r(0.2, 0.7);
        scol[i * 3] = b; scol[i * 3 + 1] = b; scol[i * 3 + 2] = b * 1.1;
        ssz[i] = FXH.r(0.1, 0.3); sal[i] = FXH.r(0.15, 0.55);
      }
      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
      sgeo.setAttribute("aColor", new THREE.BufferAttribute(scol, 3));
      sgeo.setAttribute("aSize", new THREE.BufferAttribute(ssz, 1));
      sgeo.setAttribute("aAlpha", new THREE.BufferAttribute(sal, 1));
      const smat = FXH.pointsMat(1);
      scene.add(new THREE.Points(sgeo, smat));

      camera.position.set(0, 0.6, 8.4);
      camera.lookAt(0, 0, 0);

      /* 拖拽旋转 */
      let spinV = 0.0035, dragging = false, lastX = 0, lastY = 0, rotX = 0;
      const onMove = (e) => {
        if (!dragging) return;
        spinV += (e.clientX - lastX) * 0.00018;
        rotX += (e.clientY - lastY) * 0.004;
        lastX = e.clientX; lastY = e.clientY;
      };
      const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onUp = () => { dragging = false; };
      window.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);

      let amp = 1;

      return {
        update(dt, t) {
          oMat.uniforms.uTime.value = t;
          amp += (1 - amp) * dt * 2.2;
          oMat.uniforms.uAmp.value = 0.45 * amp;
          group.rotation.y += spinV;
          spinV += (0.0035 - spinV) * dt * 0.5;
          rotX += (0 - rotX) * dt * 2;
          group.rotation.x = Math.max(-0.7, Math.min(0.7, rotX));
          ring1.rotation.z += dt * 0.5;
          ring2.rotation.z -= dt * 0.38;
          halo.rotation.y -= dt * 0.06;
          halo.rotation.x = Math.sin(t * 0.14) * 0.1;
          for (const mn of moons) {
            mn.a += dt * mn.spd;
            mn.mesh.position.set(
              Math.cos(mn.a) * mn.r,
              Math.sin(mn.a) * mn.r * Math.sin(mn.incl) * 0.5,
              Math.sin(mn.a) * mn.r * Math.cos(mn.incl) * 0.8
            );
          }
          for (const nb of nebulas) {
            nb.sp.material.rotation += nb.spd * dt;
          }
          camera.position.x += (env.mouse.x * 1.4 - camera.position.x) * 0.05;
          camera.position.y += (0.6 - env.mouse.y * 0.9 - camera.position.y) * 0.05;
          camera.lookAt(0, 0, 0);
        },
        onClick() {
          amp = 2.1;
          spinV += 0.05;
        },
        dispose() {
          window.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        },
        onResize() {
          hmat.uniforms.uSize.value = FXH.pointScale();
          smat.uniforms.uSize.value = FXH.pointScale();
        },
      };
    },
  },
];
