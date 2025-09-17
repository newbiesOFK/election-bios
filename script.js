const root = document.getElementById("positions-root");
const dataUrl = "data.json";

async function loadData() {
  const res = await fetch(dataUrl);
  return res.json();
}

function buildPosition(position) {
  const posTpl = document.getElementById("position-template");
  const cardTpl = document.getElementById("card-template");
  const node = posTpl.content.firstElementChild.cloneNode(true);

  node.querySelector(".position-title").textContent = position.title;

  const track = node.querySelector(".track");
  const dots = node.querySelector(".dots");

  position.candidates.forEach((c, i) => {
    const card = cardTpl.content.firstElementChild.cloneNode(true);
    const img = card.querySelector(".bio-image");
    img.src = c.image;
    img.alt = `${c.name} biography`;
    track.appendChild(card);

    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Show candidate ${i + 1}`);
    dot.dataset.index = i;
    dots.appendChild(dot);
  });

  let index = 0;
  const prev = node.querySelector(".prev");
  const next = node.querySelector(".next");

  function update() {
    const width = track.querySelector(".card").getBoundingClientRect().width + 16;
    track.style.transform = `translateX(${-index * width}px)`;
    dots.querySelectorAll("button").forEach((d, i) =>
      d.setAttribute("aria-selected", i === index ? "true" : "false")
    );
    prev.disabled = index === 0;
    next.disabled = index === position.candidates.length - 1;
  }

  prev.addEventListener("click", () => { index--; update(); });
  next.addEventListener("click", () => { index++; update(); });
  dots.addEventListener("click", e => {
    if (e.target.matches("button")) {
      index = parseInt(e.target.dataset.index, 10);
      update();
    }
  });

  update();
  return node;
}

loadData().then(data => {
  data.positions.forEach(pos => root.appendChild(buildPosition(pos)));
});
