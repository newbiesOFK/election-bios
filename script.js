/* OFK Board Bios – one-at-a-time slides + swipe + lightbox */
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
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
  return res.json();
}

function el(q, ctx = document) { return ctx.querySelector(q); }
function els(q, ctx = document) { return [...ctx.querySelectorAll(q)]; }
function slugify(s) { return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''); }

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

  (position.candidates || []).forEach((c, i) => {
    const card = cardTpl.content.firstElementChild.cloneNode(true);
    const img = el('.bio-image', card);
    img.src = c.image;
    img.alt = `${c.name} biography`;

    // Lightbox
    const fullSrc = c.image_large || c.image;
    img.tabIndex = 0;
    img.addEventListener('click', () => openLightbox(fullSrc, `${c.name} — ${position.title}`));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(fullSrc, `${c.name} — ${position.title}`); }
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

  // Carousel state (one slide = viewport width)
  let index = 0;
  let isPointerDown = false;
  let startX = 0;
  let currentDelta = 0;

  function maxIndex() {
    return Math.max(0, (position.candidates?.length || 1) - 1);
  }

  function setTransform(px) {
    track.style.transform = `translate3d(${px}px,0,0)`;
  }

  function update() {
    const slideWidth = viewport.clientWidth; // one-at-a-time
    const offset = -(index * slideWidth);
    setTransform(offset);

    // Dots + buttons
    els('button', dots).forEach((d, i) => d.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= maxIndex();
  }

  function go(i) {
    index = Math.max(0, Math.min(i, maxIndex()));
    update();
  }

  // Buttons
  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));

  // Dots
  dots.addEventListener('click', (e) => {
    if (e.target instanceof HTMLButtonElement) go(Number(e.target.dataset.index));
  });

  // Keyboard arrows
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });

  // Swipe
  viewport.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    startX = e.clientX;
    currentDelta = 0;
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    const slideWidth = viewport.clientWidth;
    currentDelta = e.clientX - startX;
    const base = -(index * slideWidth);
    setTransform(base + currentDelta * 0.35); // small drag visual
  });
  viewport.addEventListener('pointerup', () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const slideWidth = viewport.clientWidth;
    const threshold = Math.max(40, slideWidth * 0.15); // 15% of width or 40px
    if (currentDelta > threshold) go(index - 1);
    else if (currentDelta < -threshold) go(index + 1);
    else update();
  });
  viewport.addEventListener('pointercancel', () => { isPointerDown = false; update(); });

  // Resize: keep current slide aligned
  window.addEventListener('resize', update, { passive: true });

  // Initial
  requestAnimationFrame(update);

  return section;
}

function renderPositions(positions) {
  root.innerHTML = '';
  positions.forEach(pos => root.appendChild(buildPosition(pos)));

  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

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
