/* OFK Board Bios – one-at-a-time slides + swipe + lightbox (buttons below) */
const ROOT_ID = 'positions-root';
const DATA_URL = 'data.json';

const root = document.getElementById(ROOT_ID);

// --- Lightbox elements & state ---
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbCaption = document.getElementById('lightbox-caption');
const lbClose = document.querySelector('.lightbox-close');
const lbPrev = document.querySelector('.lightbox-prev');
const lbNext = document.querySelector('.lightbox-next');

const lbState = { items: [], index: 0 };

function lbClamp(i) { return Math.max(0, Math.min(i, lbState.items.length - 1)); }
function lbUpdate() {
  if (!lbState.items.length) return;
  lbImg.src = lbState.items[lbState.index].src;
  lbCaption.textContent = lbState.items[lbState.index].caption || '';
  lbPrev.disabled = lbState.index <= 0;
  lbNext.disabled = lbState.index >= lbState.items.length - 1;
}
function openLightboxWith(items, startIndex = 0) {
  lbState.items = items || [];
  lbState.index = lbClamp(startIndex);
  lb.classList.add('open');
  document.body.classList.add('modal-open');
  lb.setAttribute('aria-hidden', 'false');
  lbUpdate();
  lb.focus();
}
function closeLightbox() {
  lb.classList.remove('open');
  document.body.classList.remove('modal-open');
  lb.setAttribute('aria-hidden', 'true');
  lbImg.removeAttribute('src');
  lbState.items = [];
  lbState.index = 0;
}

// Lightbox events
lb.addEventListener('click', (e) => { if (e.target === lb || e.target === lbClose) closeLightbox(); });
lb.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeLightbox();
  if (e.key === 'ArrowLeft') { lbState.index = lbClamp(lbState.index - 1); lbUpdate(); }
  if (e.key === 'ArrowRight') { lbState.index = lbClamp(lbState.index + 1); lbUpdate(); }
});
lbPrev.addEventListener('click', () => { lbState.index = lbClamp(lbState.index - 1); lbUpdate(); });
lbNext.addEventListener('click', () => { lbState.index = lbClamp(lbState.index + 1); lbUpdate(); });

// Lightbox swipe on the zoomed image
let lbPointerDown = false, lbStartX = 0, lbDeltaX = 0;
lbImg.addEventListener('pointerdown', (e) => {
  lbPointerDown = true; lbStartX = e.clientX; lbDeltaX = 0;
  lbImg.setPointerCapture(e.pointerId);
});
lbImg.addEventListener('pointermove', (e) => {
  if (!lbPointerDown) return;
  lbDeltaX = e.clientX - lbStartX;
  lbImg.style.transform = `translateX(${lbDeltaX * 0.05}px)`;
});
function lbEndSwipe() {
  if (!lbPointerDown) return;
  lbPointerDown = false;
  lbImg.style.transform = '';
  const threshold = 40;
  if (lbDeltaX > threshold) { lbState.index = lbClamp(lbState.index - 1); lbUpdate(); }
  else if (lbDeltaX < -threshold) { lbState.index = lbClamp(lbState.index + 1); lbUpdate(); }
  lbDeltaX = 0;
}
lbImg.addEventListener('pointerup', lbEndSwipe);
lbImg.addEventListener('pointercancel', lbEndSwipe);

// --- Data loading ---
async function loadData() {
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
  try { return await res.json(); }
  catch (e) { throw new Error(`Invalid JSON in ${DATA_URL}: ${e.message}`); }
}

// --- Helpers ---
function el(q, ctx = document) { return ctx.querySelector(q); }
function els(q, ctx = document) { return [...ctx.querySelectorAll(q)]; }
function slugify(s) { return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''); }

// --- Build one position section ---
function buildPosition(position) {
  const posTpl = el('#position-template');
  const cardTpl = el('#card-template');
  const section = posTpl.content.firstElementChild.cloneNode(true);

  section.setAttribute('aria-label', `${position.title} candidates`);
  el('.position-title', section).textContent = position.title;
  section.id = position.slug || slugify(position.title);

  const track = el('.track', section);
  const dots = el('.dots', section);
  const viewport = el('.viewport', section);
  const prevBtn = el('.prev', section);
  const nextBtn = el('.next', section);

  // Build candidate cards + lightbox item list for THIS position
  const items = (position.candidates || []).map(c => ({
    src: c.image_large || c.image,
    caption: `${c.name} — ${position.title}`
  }));

  (position.candidates || []).forEach((c, i) => {
    const card = cardTpl.content.firstElementChild.cloneNode(true);
    const img = el('.bio-image', card);
    img.src = c.image;
    img.alt = `${c.name} biography`;

    // Click/keyboard to open lightbox with this position's sequence @ index i
    img.tabIndex = 0;
    img.addEventListener('click', () => openLightboxWith(items, i));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightboxWith(items, i); }
    });

    track.appendChild(card);

    // Dots
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Show candidate ${i + 1}: ${c.name}`);
    dot.dataset.index = String(i);
    dots.appendChild(dot);
  });

  // --- One-at-a-time carousel in page ---
  let index = 0;
  let isPointerDown = false, startX = 0, currentDelta = 0;

  const maxIndex = () => Math.max(0, (position.candidates?.length || 1) - 1);

  function setTransform(px) { track.style.transform = `translate3d(${px}px,0,0)`; }
  function update() {
    const slideWidth = viewport.clientWidth;
    const offset = -(index * slideWidth);
    setTransform(offset);
    els('button', dots).forEach((d, i) => d.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= maxIndex();
  }
  function go(i) { index = Math.max(0, Math.min(i, maxIndex())); update(); }

  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));
  dots.addEventListener('click', (e) => { if (e.target instanceof HTMLButtonElement) go(Number(e.target.dataset.index)); });

  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });

  viewport.addEventListener('pointerdown', (e) => {
    isPointerDown = true; startX = e.clientX; currentDelta = 0; viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    const slideWidth = viewport.clientWidth;
    currentDelta = e.clientX - startX;
    const base = -(index * slideWidth);
    setTransform(base + currentDelta * 0.35);
  });
  function endSwipe() {
    if (!isPointerDown) return;
    isPointerDown = false;
    const slideWidth = viewport.clientWidth;
    const threshold = Math.max(40, slideWidth * 0.15);
    if (currentDelta > threshold) go(index - 1);
    else if (currentDelta < -threshold) go(index + 1);
    else update();
  }
  viewport.addEventListener('pointerup', endSwipe);
  viewport.addEventListener('pointercancel', endSwipe);

  window.addEventListener('resize', update, { passive: true });
  requestAnimationFrame(update);

  return section;
}

// --- Render all positions ---
function renderPositions(positions) {
  root.innerHTML = '';
  positions.forEach(pos => root.appendChild(buildPosition(pos)));
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// --- Boot ---
loadData()
  .then(data => {
    document.title = data.title || 'OFK Board Election Bios';
    renderPositions(data.positions || []);
  })
  .catch(err => {
    console.error(err);
    root.innerHTML = `
      <div style="padding:1rem;background:#fee;border:1px solid #fbb;color:#900;border-radius:10px;">
        <strong>Couldn’t load bios:</strong> ${err.message}<br>
        Tip: check <code>data.json</code> name/location, JSON syntax, and image paths.
      </div>`;
  });
