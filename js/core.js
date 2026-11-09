/* =========================================================
   BULLE — core : helpers, catalogue, composants
   ========================================================= */
(function () {
  'use strict';

  const APP_VERSION = '1.0.0';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value === null || value === undefined ? '' : value)
    .replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  const norm = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const toArr = (value) => Store.toArray(value);
  const icon = (name, cls) => `<svg class="${cls || 'icon'}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  const euro = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  function fmtEUR(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return euro.format(n);
  }

  function fmtRating(value) {
    const n = Number(value) || 0;
    return n.toFixed(1).replace('.0', '').replace('.', ',');
  }

  function fmtInt(value) {
    return new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
  }

  function fmtDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (err) {
      return '';
    }
  }

  function plural(count, singular, pluralForm) {
    return Number(count) > 1 ? (pluralForm || singular + 's') : singular;
  }

  function hueFor(text) {
    let hash = 0;
    const str = String(text || 'bulle');
    for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) % 360;
    return 250 + (hash % 150);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'B';
    return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  /* ------------------------- catalogue ------------------------- */
  const seedRows = (window.SEED && Array.isArray(window.SEED.rows)) ? window.SEED.rows : [];
  const CATALOG_BY_ID = new Map();

  seedRows.forEach((row) => {
    (row.items || []).forEach((item) => {
      if (!item || !item.id) return;
      const enriched = Store.applyFrCover(item);
      CATALOG_BY_ID.set(item.id, {
        ...enriched,
        kind: enriched.kind === 'bd' ? 'bd' : 'manga',
        genres: toArr(enriched.genres),
        description: Store.cleanText(enriched.description)
      });
    });
  });

  const CATALOG = Array.from(CATALOG_BY_ID.values());
  const ROWS = seedRows.map((row) => ({
    ...row,
    items: (row.items || []).map((item) => CATALOG_BY_ID.get(item.id)).filter(Boolean)
  }));

  /* ------------------------- ui state ------------------------- */
  const ui = {
    screen: 'home',
    explore: {
      q: '',
      kind: 'all',
      genre: '',
      sort: 'relevance',
      limit: 28,
      items: [],
      errors: [],
      loading: false,
      searchedFor: '',
      focusSearch: false
    },
    library: {
      status: 'all',
      kind: 'all',
      sort: Store.settings.librarySort || 'recent',
      view: Store.settings.libraryView || 'grid'
    },
    installPrompt: null,
    swReg: null
  };

  /* ------------------------- theme ------------------------- */
  function applyTheme(theme, persist) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f4f1ea' : '#12121b');
    $$('.icon-theme use').forEach((use) => {
      use.setAttribute('href', next === 'light' ? '#i-sun' : '#i-moon');
    });
    if (persist !== false) Store.setSetting('theme', next);
  }

  /* ------------------------- chrome ------------------------- */
  function setActiveNav(screen) {
    $$('[data-nav]').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.nav === screen);
    });
  }

  function refreshChrome() {
    const items = Store.all();
    const owned = items.filter((i) => i.owned).length;
    const total = items.length;

    ['#nav-library-count', '#tab-library-count'].forEach((selector) => {
      const el = $(selector);
      if (!el) return;
      el.textContent = total > 99 ? '99+' : String(total);
      el.hidden = total === 0;
    });

    const version = $('#sidebar-version');
    if (version) version.textContent = 'Bulle v' + APP_VERSION;

    const navCount = $('#nav-library-count');
    if (navCount) navCount.title = owned + ' possédés · ' + total + ' titres suivis';

    const label = $('.net-status__label');
    const status = $('#net-status');
    if (label && status) {
      const online = navigator.onLine !== false;
      status.classList.toggle('is-offline', !online);
      label.textContent = online ? 'En ligne' : 'Hors-ligne';
    }

    setActiveNav(ui.screen);
    applyTheme(Store.settings.theme, false);
  }

  /* ------------------------- toast ------------------------- */
  function toast(message, type, timeout) {
    const root = $('#toast-root');
    if (!root) return;
    const kind = type || 'success';
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    const iconName = kind === 'error' ? 'x' : kind === 'info' ? 'info' : 'check';
    el.innerHTML = icon(iconName) + '<span>' + esc(message) + '</span>';
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();

    const life = timeout || (kind === 'error' ? 4600 : 3000);
    setTimeout(() => el.classList.add('is-out'), Math.max(500, life - 260));
    setTimeout(() => el.remove(), life + 60);
  }

  window.Bulle = { toast: toast, version: APP_VERSION };

  /* ------------------------- confirm dialog ------------------------- */
  function confirmDialog(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      const overlay = $('#overlay-root');
      const wrap = document.createElement('div');
      wrap.className = 'dialog-backdrop';
      wrap.innerHTML = `
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h3 id="dialog-title">${esc(opts.title || 'Confirmer')}</h3>
          <p>${esc(opts.text || '')}</p>
          <div class="dialog__actions">
            <button class="btn btn--small" data-dialog="cancel" type="button">${esc(opts.cancelLabel || 'Annuler')}</button>
            <button class="btn btn--small ${opts.danger ? 'btn--danger' : 'btn--accent'}" data-dialog="ok" type="button">${esc(opts.confirmLabel || 'Confirmer')}</button>
          </div>
        </div>`;
      overlay.appendChild(wrap);

      const onKey = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          done(false);
        }
      };

      function done(value) {
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        resolve(value);
      }

      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', (event) => {
        if (event.target === wrap) return done(false);
        const button = event.target.closest('[data-dialog]');
        if (!button) return;
        done(button.dataset.dialog === 'ok');
      });
      setTimeout(() => {
        const button = wrap.querySelector('[data-dialog="ok"]');
        if (button) button.focus();
      }, 40);
    });
  }

  /* ------------------------- labels ------------------------- */
  function kindLabel(item) {
    if (!item) return 'Titre';
    return item.kind === 'bd' ? (item.subtype || 'BD') : 'Manga';
  }

  function sourceLabel(item) {
    const source = item && item.source;
    if (source === 'anilist') return 'AniList';
    if (source === 'openlibrary') return 'Open Library';
    if (source === 'googlebooks') return 'Google Books';
    return 'Bulle';
  }

  function subtitleFor(item) {
    const bits = [];
    if (item.author) bits.push(item.author);
    else bits.push(kindLabel(item));
    if (item.year) bits.push(String(item.year));
    return bits.join(' · ');
  }

  function statusLabel(status) {
    return { unread: 'À lire', reading: 'En cours', read: 'Lu', dropped: 'Abandonné' }[status] || 'À lire';
  }

  function ownedVolumeList(item) {
    if (!item) return [];
    return Store.normalizeOwnedVolumes(item.ownedVolumes, item.volumesOwned);
  }

  function volumeTotal(item) {
    const declared = Number(item && item.volumes);
    if (declared > 0) return Math.round(declared);
    const covers = item && item.volumeCovers;
    if (covers && typeof covers === 'object') {
      const keys = Object.keys(covers).map((key) => parseInt(key, 10)).filter((number) => number > 0);
      if (keys.length) return Math.max(...keys);
    }
    return 0;
  }

  function volumeCover(item, number) {
    const covers = item && item.volumeCovers;
    if (!covers || typeof covers !== 'object') return '';
    return covers[String(number)] || covers[number] || '';
  }

  function volumeProgress(item) {
    const owned = ownedVolumeList(item).length;
    const total = volumeTotal(item);
    if (owned > 0 && total > 0) return owned + ' / ' + total + ' ' + plural(total, 'tome');
    if (total > 0) return total + ' ' + plural(total, 'tome');
    if (owned > 0) return owned + ' ' + plural(owned, 'tome');
    return '';
  }

  /* ------------------------- covers ------------------------- */
  function coverHTML(item, options) {
    const opts = options || {};
    const hue = hueFor(item.title);
    const fallback = `<span class="poster__fallback" style="--hue:${hue}" aria-hidden="true">
      <span class="poster__fallback-title">${esc(item.title || 'Sans titre')}</span>
      <span class="poster__fallback-mark">Bulle</span>
    </span>`;
    if (!item.cover) return fallback;
    return fallback + `<img class="poster__img" src="${esc(item.cover)}" alt="" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">`;
  }

  /* ------------------------- poster card ------------------------- */
  function posterCard(item, options) {
    const opts = options || {};
    const tracked = Store.get(item.id) || {};
    const owned = Boolean(tracked.owned);
    const wish = Boolean(tracked.wishlist);
    const reading = tracked.readStatus === 'reading';
    const rating = Number(tracked.rating) || 0;

    const badges = [];
    if (owned) badges.push(`<span class="poster__badge" title="Possédé">${icon('check')}</span>`);
    if (wish) badges.push(`<span class="poster__badge poster__badge--wish" title="Dans la wishlist">${icon('heart')}</span>`);
    if (reading) badges.push(`<span class="poster__badge poster__badge--reading" title="En cours de lecture">${icon('book')}</span>`);

    const quick = opts.quick === false ? '' : `
      <button class="poster__quick ${wish ? 'is-added' : ''}" data-action="quick-add" data-id="${esc(item.id)}"
        type="button" aria-label="${wish ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}"
        title="${wish ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}">${icon(wish ? 'check' : 'plus')}</button>`;

    return `<article class="poster">
      <div class="poster__art">
        ${coverHTML(item)}
        <button class="poster__open" data-action="open-item" data-id="${esc(item.id)}" type="button" aria-label="Ouvrir ${esc(item.title)}"></button>
        ${badges.length ? `<div class="poster__badges">${badges.join('')}</div>` : ''}
        ${rating > 0 ? `<span class="poster__rate">${icon('star')}${fmtRating(rating)}</span>` : ''}
        ${quick}
      </div>
      <button class="poster__body" data-action="open-item" data-id="${esc(item.id)}" type="button">
        <span class="poster__title">${esc(item.title)}</span>
        <span class="poster__sub">${esc(subtitleFor(item))}</span>
      </button>
    </article>`;
  }

  /* ------------------------- row ------------------------- */
  function rowHTML(row) {
    if (!row || !row.items || !row.items.length) return '';
    const see = row.see
      ? `<button class="btn-link" data-action="${row.see.action}" ${row.see.kind ? `data-kind="${row.see.kind}"` : ''} ${row.see.filter ? `data-filter="${row.see.filter}"` : ''} type="button">
          Tout voir ${icon('arrow-right')}
        </button>`
      : '';

    return `<section class="row">
      <div class="section-head">
        <div>
          <h2 class="section-title">${esc(row.title)}</h2>
          ${row.subtitle ? `<p class="section-sub">${esc(row.subtitle)}</p>` : ''}
        </div>
        ${see}
      </div>
      <div class="rail-wrap">
        <button class="rail__arrow rail__arrow--prev" data-action="rail" data-dir="-1" type="button" aria-label="Faire défiler vers la gauche">${icon('arrow-left')}</button>
        <div class="rail">${row.items.map((item) => posterCard(item)).join('')}</div>
        <button class="rail__arrow rail__arrow--next" data-action="rail" data-dir="1" type="button" aria-label="Faire défiler vers la droite">${icon('arrow-right')}</button>
      </div>
    </section>`;
  }

  /* ------------------------- stars ------------------------- */
  function starsHTML(value, options) {
    const opts = options || {};
    const rating = Number(value) || 0;
    return `<div class="stars" ${opts.interactive ? 'role="group" aria-label="Ta note sur 5"' : 'aria-hidden="true"'}>
      ${[0, 1, 2, 3, 4].map((index) => {
        const pct = Math.max(0, Math.min(100, (rating - index) * 100));
        const content = `${icon('star', 'star__base')}<span class="star__fill" style="width:${pct}%">${icon('star')}</span>`;
        if (!opts.interactive) return `<span class="star">${content}</span>`;
        return `<button class="star" type="button" data-action="rate" data-index="${index}"
          aria-label="Noter ${index + 1} sur 5 (clique à gauche pour ${index + 0.5})">${content}</button>`;
      }).join('')}
    </div>`;
  }

  /* ------------------------- data helpers ------------------------- */
  function findItem(id) {
    if (!id) return null;
    return Store.get(id) ||
      CATALOG_BY_ID.get(id) ||
      (ui.explore.items || []).find((item) => item.id === id) ||
      null;
  }

  function searchLocal(query) {
    const tokens = norm(query).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    const map = new Map();
    CATALOG.forEach((item) => map.set(item.id, item));
    Store.all().forEach((item) => {
      if (!map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values())
      .filter((item) => {
        const hay = norm([
          item.title,
          item.altTitle,
          item.author,
          item.publisher,
          item.subtype,
          (item.genres || []).join(' ')
        ].join(' '));
        return tokens.every((token) => hay.includes(token));
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.title).localeCompare(String(b.title), 'fr'));
  }

  function mergeResults(remote, local) {
    const out = [];
    const ids = new Set();
    const keys = new Set();

    const keyFor = (item) => norm(item.title).slice(0, 110) + '|' + item.kind;

    (remote || []).forEach((item) => {
      if (!item || !item.id || ids.has(item.id)) return;
      ids.add(item.id);
      keys.add(keyFor(item));
      out.push(item);
    });

    (local || []).forEach((item) => {
      if (!item || !item.id || ids.has(item.id)) return;
      const key = keyFor(item);
      if (keys.has(key)) return;
      ids.add(item.id);
      keys.add(key);
      out.push(item);
    });

    return out;
  }

  function sortItems(items, sort) {
    const list = [...items];
    if (sort === 'title') return list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'fr'));
    if (sort === 'score') return list.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    if (sort === 'year') return list.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    if (sort === 'rating') return list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    if (sort === 'price') return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    return list;
  }

  function galleryGenres() {
    const map = new Map();
    CATALOG.forEach((item) => {
      (item.genres || []).forEach((genre) => {
        const key = String(genre).trim();
        if (key) map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);
  }

  function galleryCatalog() {
    return CATALOG.filter((item) => {
      if (ui.explore.kind !== 'all' && item.kind !== ui.explore.kind) return false;
      if (ui.explore.genre && !(item.genres || []).includes(ui.explore.genre)) return false;
      return true;
    });
  }

  window.B = {
    APP_VERSION,
    $,
    $$,
    esc,
    norm,
    icon,
    fmtEUR,
    fmtRating,
    fmtInt,
    fmtDate,
    plural,
    initials,
    hueFor,
    CATALOG,
    ROWS,
    CATALOG_BY_ID,
    ui,
    applyTheme,
    refreshChrome,
    setActiveNav,
    toast,
    confirmDialog,
    kindLabel,
    sourceLabel,
    subtitleFor,
    statusLabel,
    volumeProgress,
    ownedVolumeList,
    volumeTotal,
    volumeCover,
    coverHTML,
    posterCard,
    rowHTML,
    starsHTML,
    findItem,
    searchLocal,
    mergeResults,
    sortItems,
    galleryGenres,
    galleryCatalog
  };
})();
