/* OFK Board Bios – image carousels + lightbox (no build tools) */
const ROOT_ID = 'positions-root';
const DATA_URL = 'data.json';

const root = document.getElementById(ROOT_ID);

// Lightbox elements
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbCaption = document.getElementById('lightbox-caption');
const lbClose = document.querySelector('.lightbox-close');

function openLightbox(src, caption = '') {
  lbImg.src = src;
  lbCaption.textContent = caption;
  lb.classList.add('open');
  document.body.classList.add('modal-open');
  lb.setAttribute('aria-hidden', 'false');
  lb.focus();
}
function closeLightbox() {
  lb.classList.remove('open');
  document.body.classList.remove('modal-open');
  lb.setAttribute('aria-hidden', 'true');
  lbImg.removeAttribute('src');
}
lb.addEventListener('click', (e) => {
  if (e.target === lb || e.target === lbClose) closeLightbox();
});
lb.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

async function loadData() {
  // Cache-bust so updates to data.json show immediately
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Invalid JSON in ${DATA_URL}: ${e.message}`);
  }
}

function el(q, ctx = document) { return ctx.querySelector(q); }
function els(q, ctx = document) { return [...ctx.querySelectorAll(q)]; }

function slugify(s) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

/** Build a position section with a horizontal carousel of images */
function buildPosition(position) {
  const posTpl = el('#position-template');
  const cardTpl = el('#card-template');
  const section = posTpl.content.firstElementChild.cloneNode(true);

  // Section label & title
  section.setAttribute('aria-label', `${position.title} candidates`);
  el('.position-title', section).textContent = position.title;
  section.id = position.slug || slugify(position.title);

  const track = el('.track', section);
  const dots = el('.dots', section);
  const viewport = el('.viewport', section);
  const prevBtn = el('.prev', section);
  const nextBtn = el('.next', section);

  // Build cards + dots
  (position.candidates || []).forEach((c, i) => {
    const card = cardTpl.content.firstElementChild.cloneNode(true);
    const img = el('.bio-image', card);
    const nameOverlay = el('.name-overlay', card);

    img.src = c.image;
    img.alt = `${c.name} biography`;
    if (nameOverlay) {
      nameOverlay.textContent = c.name;
      // nameOverlay.hidden = false; // uncomment if you want the overlay shown
    }

    // Lightbox on click / keyboard
    const fullSrc = c.image_large || c.image;
    img.tabIndex = 0;
    img.addEventListener('click', () => openLightbox(fullSrc, `${c.name} — ${position.title}`));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(fullSrc, `${c.name} — ${position.title}`); }
    });

    track.appendChild(card);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Show candidate ${i + 1}: ${c.name}`);
    dot.dataset.index = String(i);
    dots.appendChild(dot);
  });

  // Carousel state
  let index = 0;
  let cardWidth = 0;
  let gapPx = 0;
  let isPointerDown = false;
  let startX = 0;
  let currentDelta = 0;

  function computeSizes() {
    const firstCard = el('.card', track);
    if (!firstCard) return;
    const rect = firstCard.getBoundingClientRect();
    cardWidth = rect.width;
    const gap = getComputedStyle(track).getPropertyValue('gap') || '0px';
    gapPx = parseFloat(gap) || 0;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function setTransform(offsetPx) {
    track.style.transform = `translate3d(${offsetPx}px,0,0)`;
  }

  function update() {
    computeSizes();
    const offset = -(index * (cardWidth + gapPx));
    setTransform(offset);
    // Dots
    els('button', dots).forEach((d, i) => d.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    // Buttons
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= (position.candidates?.length || 1) - 1;
  }

  function go(i) {
    index = clamp(i, 0, (position.candidates?.length || 1) - 1);
    update();
  }

  // Buttons
  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));

  // Dots
  dots.addEventListener('click', (e) => {
    if (e.target instanceof HTMLButtonElement) go(Number(e.target.dataset.index));
  });

  // Keyboard arrows while viewport focused
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });

  // Basic swipe (pointer events)
  viewport.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    startX = e.clientX;
    currentDelta = 0;
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    currentDelta = e.clientX - startX;
    // show drag by offsetting from the base position
    const base = -(index * (cardWidth + gapPx));
    setTransform(base + currentDelta * 0.35);
  });
  viewport.addEventListener('pointerup', () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const threshold = 40; // px
    if (currentDelta > threshold) go(index - 1);
    else if (currentDelta < -threshold) go(index + 1);
    else update();
  });
  viewport.addEventListener('pointercancel', () => { isPointerDown = false; update(); });

  // Handle resize
  window.addEventListener('resize', update);

  // Initial render
  requestAnimationFrame(update);

  return section;
}

function renderPositions(positions) {
  root.innerHTML = '';
  positions.forEach(pos => root.appendChild(buildPosition(pos)));

  // Deep link (#treasurer)
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Boot
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
        Tip: check the filename <code>data.json</code>, JSON syntax, and image paths.
      </div>`;
  });
