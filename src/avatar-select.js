export const AVATARS = [
  { color: 0xE63946, hex: '#E63946', name: 'Red'    },
  { color: 0x457B9D, hex: '#457B9D', name: 'Blue'   },
  { color: 0xE9C46A, hex: '#E9C46A', name: 'Gold'   },
  { color: 0x2A9D8F, hex: '#2A9D8F', name: 'Teal'   },
  { color: 0xF4A261, hex: '#F4A261', name: 'Orange' },
  { color: 0x6A4C93, hex: '#6A4C93', name: 'Purple' },
  { color: 0x43AA8B, hex: '#43AA8B', name: 'Green'  },
  { color: 0xF8961E, hex: '#F8961E', name: 'Amber'  },
];

const CSS = `
  #av-title {
    font-size: clamp(1.2rem, 3vw, 1.6rem);
    font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
    margin-bottom: .25em;
  }
  #av-sub { font-size: .85rem; opacity: .5; margin-bottom: 1.5em; }
  #av-grid {
    display: grid;
    grid-template-columns: repeat(4, 72px);
    gap: 10px;
    margin-bottom: 1.4em;
  }
  #av-name-input {
    background: rgba(255,255,255,.08);
    border: 1.5px solid rgba(255,255,255,.2);
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: .85rem;
    letter-spacing: .05em;
    padding: 9px 14px;
    width: 200px;
    text-align: center;
    outline: none;
    margin-bottom: 1.4em;
    transition: border-color .15s;
  }
  #av-name-input::placeholder { opacity: .35; }
  #av-name-input:focus { border-color: rgba(255,255,255,.5); }
  .av-card {
    width: 72px; padding: 12px 0 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.07);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 7px;
    transition: border-color .12s, transform .12s, background .12s;
    user-select: none;
  }
  .av-card:hover { transform: translateY(-3px); background: rgba(255,255,255,.12); }
  .av-card.av-sel { border-color: rgba(255,255,255,.85); background: rgba(255,255,255,.16); }
  .av-fig { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .av-head { width: 18px; height: 18px; border-radius: 50%; background: #D4956A; }
  .av-body { width: 30px; height: 22px; border-radius: 6px 6px 3px 3px; }
  .av-legs { display: flex; gap: 5px; }
  .av-legs span { width: 12px; height: 10px; border-radius: 3px; opacity: .7; display: block; }
  .av-name {
    font-size: 10px; color: rgba(255,255,255,.6);
    text-transform: uppercase; letter-spacing: .07em;
  }
  #av-enter {
    padding: 10px 36px;
    border: 1.5px solid rgba(255,255,255,.3);
    border-radius: 8px;
    background: transparent; color: #fff;
    font-family: inherit;
    font-size: .85rem; letter-spacing: .1em; text-transform: uppercase;
    opacity: .35; cursor: default;
    transition: opacity .15s, border-color .15s, background .15s;
  }
  #av-enter.av-ready {
    opacity: 1; cursor: pointer; border-color: rgba(255,255,255,.75);
  }
  #av-enter.av-ready:hover { background: rgba(255,255,255,.1); }
  @media (max-width: 380px) {
    #av-grid { grid-template-columns: repeat(4, 58px); gap: 8px; }
    .av-card { width: 58px; }
  }
`;

export function showAvatarPicker(overlay, onConfirm) {
  // Inject styles once
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // Save the existing EXPLORE content to restore on pause/resume
  const exploreHTML = overlay.innerHTML;

  // Build the picker
  const cardsHTML = AVATARS.map(a => `
    <div class="av-card" data-color="${a.color}">
      <div class="av-fig">
        <div class="av-head"></div>
        <div class="av-body"  style="background:${a.hex}"></div>
        <div class="av-legs">
          <span style="background:${a.hex}"></span>
          <span style="background:${a.hex}"></span>
        </div>
      </div>
      <span class="av-name">${a.name}</span>
    </div>`).join('');

  overlay.innerHTML = `
    <p id="av-title">Choose Your Look</p>
    <p id="av-sub">Pick a colour, then enter the world</p>
    <div id="av-grid">${cardsHTML}</div>
    <input id="av-name-input" type="text" maxlength="16"
           placeholder="Your name (optional)"
           autocomplete="off" spellcheck="false">
    <button id="av-enter">Enter World</button>
  `;

  let selectedColor = null;
  const enterBtn   = overlay.querySelector('#av-enter');
  const nameInput  = overlay.querySelector('#av-name-input');

  // Prevent in-game keys from firing while typing
  nameInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && selectedColor) confirm();
  });
  nameInput.addEventListener('click', e => e.stopPropagation());

  overlay.querySelectorAll('.av-card').forEach(card => {
    card.addEventListener('click', e => {
      e.stopPropagation();
      overlay.querySelectorAll('.av-card').forEach(c => c.classList.remove('av-sel'));
      card.classList.add('av-sel');
      selectedColor = parseInt(card.dataset.color);
      enterBtn.classList.add('av-ready');
    });
  });

  function confirm() {
    overlay.innerHTML = exploreHTML;
    onConfirm(selectedColor, nameInput.value.trim());
  }

  enterBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!selectedColor) return;
    confirm();
  });
}
