// UI: 내비게이션, 부드러운 이동, 뷰어 컨트롤, 텍스트 라이트 스윕, 시네마틱 인트로
const $ = s => document.querySelector(s);

let scrollAnim = null;
export function smoothScrollTo(targetY, duration) {
  const startY = scrollY, dist = targetY - startY;
  const d = duration ?? Math.min(2.6, 0.7 + Math.abs(dist) / 5000);
  const t0 = performance.now();
  cancelAnimationFrame(scrollAnim);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = now => {
    const t = Math.min(1, (now - t0) / (d * 1000));
    scrollTo(0, startY + dist * ease(t));
    if (t < 1) scrollAnim = requestAnimationFrame(step);
  };
  scrollAnim = requestAnimationFrame(step);
  const stop = () => cancelAnimationFrame(scrollAnim);
  addEventListener('wheel', stop, { passive: true, once: true });
  addEventListener('touchstart', stop, { passive: true, once: true });
}

export function initUI({ viewer, measure }) {
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      measure();
      const top = el.getBoundingClientRect().top + scrollY;
      smoothScrollTo(id === 'hero' ? 0 : top + (el.classList.contains('sec--sticky') ? innerHeight * 0.02 : 0));
    });
  });
  const btns = [...document.querySelectorAll('.toggle__btn')];
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.toggle('is-active', x === b));
    viewer.setState(b.dataset.state === '1');
  }));
  $('#viewerReset').addEventListener('click', () => viewer.reset());

  // closing words — revealed by a passing light when they enter the screen
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting && !en.target.classList.contains('is-lit')) {
        const delay = en.target.classList.contains('closing__b') ? 1100 : 200;
        setTimeout(() => {
          en.target.classList.add('is-lit');
          const r = en.target.getBoundingClientRect();
          window.__trails && window.__trails.sweep((r.top + r.height / 2) / innerHeight, 1, 4, 0.05);
        }, delay);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('#closing [data-sweep]').forEach(el => io.observe(el));
  setTimeout(measure, 500);
  addEventListener('load', measure);
}

// INTRO — the light vortex ignites around the circle, then the title is revealed by passing light
export function runIntro({ trails, setVeil, setIgnite }) {
  window.__trails = trails;
  const words = [...document.querySelectorAll('#hero [data-sweep]')];
  const hint = $('#scrollHint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap;
  const finish = () => {
    words.forEach(w => w.classList.add('is-lit'));
    document.body.classList.add('intro-done');
    hint.style.opacity = 1;
    setVeil(0); setIgnite(1);
  };
  if (reduce || !G) { finish(); return; }
  const o = { veil: 1, ign: 0 };
  const tl = G.timeline();
  tl.to(o, { veil: 0, duration: 1.2, ease: 'power1.inOut', onUpdate: () => setVeil(o.veil) }, 0.1)
    .to(o, { ign: 1, duration: 3.2, ease: 'power2.inOut', onUpdate: () => setIgnite(o.ign) }, 0.2)
    .call(() => { words[0].classList.add('is-lit'); trails.sweep(0.16, 1, 3, 0.03); }, null, 1.6)
    .call(() => { words[1] && words[1].classList.add('is-lit'); }, null, 1.95)
    .call(() => { words[2] && words[2].classList.add('is-lit'); trails.sweep(0.26, 1, 2, 0.02); }, null, 2.5)
    .call(() => document.body.classList.add('intro-done'), null, 3.0)
    .to(hint, { opacity: 1, duration: 1 }, 3.3);
  const skip = () => { if (scrollY > 30) { tl.progress(1); finish(); removeEventListener('scroll', skip); } };
  addEventListener('scroll', skip, { passive: true });
}
