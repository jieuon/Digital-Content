import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY, LAYOUT } from './config/settings.js';
import { loadProductAssets } from './core/assets.js';
import { CityScene } from './scenes/CityScene.js';
import { StudioScene } from './scenes/StudioScene.js';
import { ViewerScene } from './scenes/ViewerScene.js';
import { IntroVortex } from './fx/IntroVortex.js';
import { FlowStreams } from './fx/FlowStreams.js';
import { LightTrails } from './fx/LightTrails.js';
import { GradeShader, RadialBlurShader } from './fx/GradePass.js';
import { CAMERA, sampleCamera } from './animations/cameraPaths.js';
import { scenarioState, stageIndex } from './animations/scenario.js';
import { ramp, smooth } from './components/materials.js';
import { setLineResolution } from './components/ProductRig.js';
import { initRectLights } from './components/StudioKit.js';
import { initUI, runIntro, smoothScrollTo } from './ui/ui.js';

const $ = s => document.querySelector(s);
const clamp01 = v => Math.min(1, Math.max(0, v));
const CONCEPT_CUT = 0.34;   // concept: abstract streams → studio product reveal

// ------------------------------------------------------------ renderer + post
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(QUALITY.dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
initRectLights();

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 600);
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 0 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(QUALITY.dpr);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const radial = new ShaderPass(RadialBlurShader);  // radial motion blur + perspective stretch (intro suction)
const afterimage = new AfterimagePass(0.8);       // light afterimages while the vortex spins
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.78);
const grade = new ShaderPass(GradeShader);
composer.addPass(renderPass);
composer.addPass(radial);
composer.addPass(afterimage);
composer.addPass(bloom);
composer.addPass(grade);
composer.addPass(new OutputPass());

const trails = new LightTrails($('#trails'));
const veil = $('#veil');

// ------------------------------------------------------------ sections
const SECTIONS = [...document.querySelectorAll('.sec')].map(el => ({ el, id: el.id, mode: el.dataset.mode, top: 0, h: 0, q: 0, sq: 0 }));
const byId = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
function measure() {
  const y = scrollY;
  SECTIONS.forEach(s => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height; });
}

// ------------------------------------------------------------ boot
let city, studio, viewer, vortex, streams;
const state = { ready: false, introVeil: 1, mouse: new THREE.Vector2(), smouse: new THREE.Vector2(), lastY: scrollY, mode: null, active: null };

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 40px "Noto Sans KR"'), document.fonts.load('700 40px "Pretendard Variable"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fallback fonts are fine */ }
}

async function boot() {
  const bar = $('#loaderBar'), pct = $('#loaderPct');
  const setP = v => { bar.style.width = (v * 100).toFixed(0) + '%'; pct.textContent = (v * 100).toFixed(0) + '%'; };
  vortex = new IntroVortex();
  streams = new FlowStreams();
  let assets;
  try {
    [assets] = await Promise.all([loadProductAssets(v => setP(v * 0.85)), fontsReady()]);
  } catch (err) {
    console.error(err);
    pct.textContent = 'MODEL LOAD FAILED — 인터넷 연결을 확인한 뒤 새로고침해 주세요.';
    return;
  }
  setP(0.9);
  await new Promise(r => setTimeout(r, 30));
  city = new CityScene(renderer, assets);
  studio = new StudioScene(renderer, assets);
  viewer = new ViewerScene($('#viewerCanvas'), assets);
  $('#unitCount').textContent = `${LAYOUT.unitsPerRow * 2} UNITS · 독립 제품`;
  [city.scene, studio.scene, vortex.scene, streams.scene].forEach(s => renderer.compile(s, camera));
  setLineResolution(innerWidth, innerHeight);
  viewer.resize();
  setP(1);
  measure();
  state.ready = true;
  $('#loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  initUI({ viewer, measure });
  runIntro({ trails, setVeil: v => (state.introVeil = v), setIgnite: v => (vortex.ignite = v) });
}

// ------------------------------------------------------------ input
addEventListener('pointermove', e => { state.mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  setLineResolution(innerWidth, innerHeight);
  viewer && viewer.resize();
  measure();
});

// ------------------------------------------------------------ typography (scroll-linked light/mask reveals, reversible)
const ranged = [...document.querySelectorAll('[data-range]')].map(el => {
  const [a, b] = el.dataset.range.split(',').map(Number);
  return { el, a, b, sec: el.closest('.sec').id };
});
const steps = [...document.querySelectorAll('.step')];
const stepLis = [...document.querySelectorAll('#progressSteps li')];
const detailDots = [...document.querySelectorAll('.detailnav span')];
const navLinks = [...document.querySelectorAll('.nav__links a')];
const navMap = { hero: null, problem: 'overview', concept: 'concept', product: 'product', details: 'product', installation: 'interaction', interaction: 'interaction', closing: null };

function updateDOM() {
  for (const r of ranged) {
    const s = byId[r.sec];
    const q = s.sq;
    const fin = smooth(ramp(q, r.a, r.a + 0.09));
    const fout = r.b >= 0.97 ? 1 : 1 - smooth(ramp(q, r.b - 0.08, r.b));
    r.el.style.setProperty('--in', fin.toFixed(4));
    r.el.style.setProperty('--out', fout.toFixed(4));
    r.el.style.visibility = fin * fout < 0.002 ? 'hidden' : 'visible';
  }
  const hq = byId.hero.sq;
  const ht = $('#heroTitle');
  const hout = 1 - smooth(ramp(hq, 0.2, 0.34));
  ht.style.setProperty('--out', hout.toFixed(4));
  ht.style.transform = `translateY(${(-hq * 120).toFixed(1)}px)`;
  $('#scrollHint').style.opacity = state.introDone ? String(1 - ramp(hq, 0.02, 0.1)) : '';
  // phase captions in the vortex
  document.querySelectorAll('.phase').forEach(el => {
    const [a, b] = el.dataset.p.split(',').map(Number);
    const v = smooth(ramp(hq, a, a + 0.05)) * (1 - smooth(ramp(hq, b - 0.05, b)));
    el.style.setProperty('--in', v.toFixed(3));
  });
  const p = byId.interaction.sq;
  const si = stageIndex(p);
  steps.forEach((s, i) => s.classList.toggle('on', i === si && byId.interaction === state.active));
  stepLis.forEach((s, i) => s.classList.toggle('on', i === si));
  $('#progressFill').style.height = (p * 100).toFixed(2) + '%';
  const dq = byId.details.sq;
  const di = dq < 0.35 ? 0 : dq < 0.67 ? 1 : 2;
  detailDots.forEach((d, i) => d.classList.toggle('on', i === di));
  const key = state.active ? navMap[state.active.id] : null;
  navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.key === key));
  $('#nav').classList.toggle('is-scrolled', scrollY > 40);
}

// ------------------------------------------------------------ world direction
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
const curPos = new THREE.Vector3(0, 12, 27), curLook = new THREE.Vector3(0, -1.5, 0);
let curFov = 40;

// which world a section shows (concept is split in two)
function worldOf(sec) {
  if (!sec) return 'none';
  if (sec.id === 'concept') return sec.sq < CONCEPT_CUT ? 'streams' : 'studio';
  return { vortex: 'vortex', city: 'city', streams: 'streams', studio: 'studio', concept: 'studio', viewer: 'viewer', closing: 'vortex' }[sec.mode] || 'none';
}

function direct(dt) {
  const y = scrollY, vh = innerHeight;
  for (const s of SECTIONS) {
    const len = Math.max(1, s.h - vh);
    s.q = clamp01((y - s.top) / len);
    s.sq += (s.q - s.sq) * (1 - Math.exp(-dt * 7.5));
    if (Math.abs(s.q - s.sq) < 0.0004) s.sq = s.q;
  }
  const mid = y + vh * 0.5;
  const active = SECTIONS.find(s => mid >= s.top && mid < s.top + s.h) || SECTIONS[SECTIONS.length - 1];
  const idx = SECTIONS.indexOf(active);

  // what to render: the viewer section shows its own canvas; behind it keep the previous world if still visible
  let src = active;
  if (active.mode === 'viewer') {
    const prev = SECTIONS[idx - 1];
    src = prev && prev.top + prev.h > y ? prev : null;
  }
  const world = worldOf(src);

  // light-based transitions: a sweep across the screen when the world changes
  if (state.mode && world !== state.mode && world !== 'none' && state.mode !== 'none') {
    trails.sweep(0.5, idx >= SECTIONS.indexOf(state.active) ? 1 : -1, 7, 0.35);
  }
  state.active = active;

  // ---- veil (cinematic darkness between worlds)
  let v = 0;
  for (let i = 1; i < SECTIONS.length; i++) {
    const a = SECTIONS[i - 1], b = SECTIONS[i];
    if (a.mode !== b.mode && !(a.id === 'hero')) v = Math.max(v, 1 - Math.min(1, Math.abs(y - b.top) / (vh * 0.38)));
  }
  const hq = byId.hero.sq, pq = byId.problem.sq, cq = byId.concept.sq;
  if (active.id === 'hero') v = Math.max(v, ramp(hq, 0.955, 0.995));                     // PHASE 04 end: black space
  if (active.id === 'problem') v = Math.max(v, 1 - smooth(ramp(pq, 0.03, 0.13)));          // problem appears after the slit
  if (active.id === 'concept') v = Math.max(v, 1 - Math.min(1, Math.abs(cq - CONCEPT_CUT) / 0.035));
  v = Math.max(v, state.introVeil);
  veil.style.opacity = v.toFixed(3);
  // thin purple light crossing the centre → next section
  trails.slit = active.id === 'problem' && pq > 0 ? Math.sin(Math.PI * ramp(pq, 0.0, 0.12)) : 0;

  state.smouse.lerp(state.mouse, 1 - Math.exp(-dt * 2.5));
  const m = state.smouse;
  let fov = 40, snap = false;
  afterimage.enabled = false;
  radial.enabled = false;
  camUp.set(0, 1, 0);

  if (world === 'vortex') {
    const mode = src.id === 'closing' ? 'closing' : 'hero';
    vortex.update(dt, src.sq, mode, m);
    const cam = vortex.camera(src.sq, mode, camPos, camLook, camUp);
    fov = cam.fov;
    renderPass.scene = vortex.scene;
    afterimage.enabled = mode === 'hero';
    afterimage.uniforms.damp.value = 0.6 + 0.3 * ramp(src.sq, 0.25, 0.7) - 0.25 * ramp(src.sq, 0.85, 1);
    radial.enabled = cam.blur > 0.001 || cam.distort > 0.001;
    radial.uniforms.uStrength.value = cam.blur;
    radial.uniforms.uDistort.value = cam.distort;
    Object.assign(bloom, { strength: 1.05 + 0.4 * ramp(src.sq, 0.5, 0.9), radius: 0.85, threshold: 0.05 });
    grade.uniforms.uSat.value = 1.0; grade.uniforms.uVignette.value = 1.0;
  } else if (world === 'streams') {
    const isConcept = src.id === 'concept';
    const q = isConcept ? clamp01(src.sq / CONCEPT_CUT) : src.sq;
    streams.update(dt, isConcept
      ? { converge: 1, jam: 1 - ramp(q, 0.55, 1) * 0.6, beam: 1, open: smooth(ramp(q, 0.12, 0.7)), gain: 1 }
      : { converge: smooth(ramp(q, 0.06, 0.5)), jam: smooth(ramp(q, 0.3, 0.68)), beam: smooth(ramp(q, 0.7, 0.86)), open: 0, gain: 0.9 + 0.1 * ramp(q, 0, 0.2) });
    sampleCamera(isConcept ? CAMERA.conceptStreams : CAMERA.problem, q, camPos, camLook);
    renderPass.scene = streams.scene;
    fov = 46;
    Object.assign(bloom, { strength: 1.0, radius: 0.75, threshold: 0.05 });
    grade.uniforms.uSat.value = 1.0; grade.uniforms.uVignette.value = 1.0;
  } else if (world === 'city') {
    const id = src.id;
    const q = src.sq;
    const cs = id === 'interaction' ? scenarioState(q) : {
      units: { show: id === 'installation', fn: () => ({ m: 0, r: 0, led: 0, edge: 0 }) },
      amb: { show: false, a: 0, b: 0 }, detect: 0, alert: 0, data: 0, evac: () => 0,
    };
    cs.camPos = camera.position;
    city.update(dt, cs);
    sampleCamera(CAMERA[id], q, camPos, camLook);
    renderPass.scene = city.scene;
    fov = 38;
    Object.assign(bloom, { strength: 0.8, radius: 0.55, threshold: 0.72 });
    grade.uniforms.uSat.value = 0.86; grade.uniforms.uVignette.value = 0.9;
  } else if (world === 'studio') {
    const isConcept = src.id === 'concept';
    const q = isConcept ? clamp01((src.sq - CONCEPT_CUT) / (1 - CONCEPT_CUT)) : src.sq;
    studio.update(dt, isConcept ? 'concept' : 'details', q);
    sampleCamera(isConcept ? CAMERA.conceptReveal : CAMERA.details, q, camPos, camLook);
    renderPass.scene = studio.scene;
    fov = 30;
    Object.assign(bloom, { strength: 0.6, radius: 0.5, threshold: 0.85 });
    grade.uniforms.uSat.value = 0.95; grade.uniforms.uVignette.value = 0.95;
  }

  if (world !== 'none' && world !== 'viewer') {
    const par = world === 'vortex' ? 0.6 : world === 'studio' ? 0.05 : 0.18;
    camPos.x += m.x * 0.35 * par; camPos.y += m.y * 0.18 * par;
    snap = state.mode !== world || !state.camInit;
    const k = snap ? 1 : 1 - Math.exp(-dt * 9);
    curPos.lerp(camPos, k); curLook.lerp(camLook, k);
    curFov += (fov - curFov) * (snap ? 1 : k);
    camera.up.copy(camUp);
    camera.position.copy(curPos); camera.lookAt(curLook);
    camera.fov = curFov; camera.updateProjectionMatrix();
    grade.uniforms.uTime.value += dt;
    if (v < 0.999) composer.render(dt);
    state.camInit = true;
  }
  state.mode = world;

  const pr = byId.product;
  viewer.active = y + vh > pr.top && y < pr.top + pr.h;
  viewer.update(dt);
}

// ------------------------------------------------------------ adaptive quality
let ftAcc = 0, ftN = 0, dpr = QUALITY.dpr;
function adapt(dt) {
  ftAcc += dt; ftN++;
  if (ftN >= 60) {
    const avg = ftAcc / ftN;
    const floor = QUALITY.mobile ? 0.7 : 0.8;
    if (avg > 0.024 && dpr > floor) { dpr = Math.max(floor, dpr - 0.15); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); }
    ftAcc = 0; ftN = 0;
  }
}

// ------------------------------------------------------------ loop
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  const y = scrollY;
  const vel = (y - state.lastY) / Math.max(dt, 1e-3);
  state.lastY = y;
  trails.update(dt, state.ready ? vel : 0);
  if (!state.ready) return;
  state.introDone = document.body.classList.contains('intro-done');
  direct(dt);
  updateDOM();
  adapt(dt);
}
loop();
boot();

window.__epcs = { smoothScrollTo };
