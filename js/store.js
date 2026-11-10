/* =========================================================
   BULLE — local collection store (localStorage, 100% on-device)
   ========================================================= */
(function () {
  'use strict';

  const KEY = 'bulle.store.v1';
  const SNAPSHOT_FIELDS = [
    'id', 'source', 'kind', 'subtype', 'title', 'altTitle', 'seriesTitle', 'author', 'publisher',
    'cover', 'banner', 'description', 'genres', 'year', 'volumes', 'chapters', 'score',
    'siteUrl', 'frUrl', 'accent', 'volumeCovers', 'releaseDate', 'releaseLabel'
  ];

  const DEFAULTS = {
    owned: false,
    wishlist: false,
    readStatus: 'unread', // unread | reading | read | dropped
    rating: 0,            // 0 .. 5, half stars
    volumesOwned: null,
    ownedVolumes: [],
    condition: '',
    notes: '',
    favorite: false
  };

  const CONDITIONS = ['Neuf', 'Très bon état', 'Bon état', 'Correct', 'Usé'];

  const defaultSettings = {
    name: '',
    theme: 'dark',
    librarySort: 'recent',
    libraryView: 'grid',
    demo: false,
    onboarded: false,
    createdAt: Date.now()
  };

  function makeId() {
    return 'local:' + Math.random().toString(36).slice(2, 10);
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }

  function cleanText(value) {
    if (!value) return '';
    return String(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /* ------------------------- French edition overrides ------------------------- */
  function applyFrCover(base) {
    if (!base || !base.id) return base;
    const table = window.FR_COVERS;
    const fr = table && table[base.id];
    if (!fr) return base;

    const out = { ...base };
    const frTitle = cleanText(fr.title);
    if (frTitle && frTitle !== cleanText(base.title)) {
      if (!out.altTitle) out.altTitle = cleanText(base.title);
      out.title = frTitle;
    }
    if (fr.altTitle) out.altTitle = cleanText(fr.altTitle);
    if (fr.cover) out.cover = fr.cover;
    if (fr.publisher) out.publisher = cleanText(fr.publisher);
    if (fr.url) out.frUrl = fr.url;
    if (fr.description) out.description = cleanText(fr.description);
    if (Array.isArray(fr.genres) && fr.genres.length) out.genres = fr.genres.map(cleanText).filter(Boolean).slice(0, 8);
    if (fr.year) out.year = num(fr.year);
    if (fr.volumes && typeof fr.volumes === 'object') out.volumeCovers = { ...fr.volumes };
    return out;
  }

  function snapshot(base) {
    const source = applyFrCover(base);
    const item = {};
    SNAPSHOT_FIELDS.forEach((field) => {
      if (source[field] !== undefined) item[field] = source[field];
    });
    item.id = String(source.id || makeId());
    item.source = source.source || 'local';
    item.kind = source.kind === 'bd' ? 'bd' : 'manga';
    item.subtype = source.subtype || (item.kind === 'bd' ? 'BD' : 'Manga');
    item.title = cleanText(source.title) || 'Sans titre';
    item.altTitle = cleanText(source.altTitle);
    item.seriesTitle = cleanText(source.seriesTitle);
    item.author = cleanText(source.author);
    item.publisher = cleanText(source.publisher);
    item.cover = source.cover || '';
    item.banner = source.banner || '';
    item.description = cleanText(source.description);
    item.genres = toArray(source.genres).map(cleanText).filter(Boolean).slice(0, 8);
    item.year = num(source.year);
    item.volumes = num(source.volumes);
    item.chapters = num(source.chapters);
    item.score = num(source.score);
    item.siteUrl = source.siteUrl || '';
    item.frUrl = source.frUrl || '';
    item.accent = source.accent || '';
    item.volumeCovers = source.volumeCovers && typeof source.volumeCovers === 'object' ? { ...source.volumeCovers } : {};
    item.releaseDate = source.releaseDate || '';
    item.releaseLabel = cleanText(source.releaseLabel);
    return item;
  }

  /* ------------------------- owned volumes ------------------------- */
  function normalizeOwnedVolumes(value, legacyCount) {
    let raw = [];
    if (Array.isArray(value)) raw = value;
    else if (typeof value === 'string' && value.trim()) raw = value.split(',');

    const numbers = raw
      .map((entry) => parseInt(entry, 10))
      .filter((number) => Number.isFinite(number) && number > 0)
      .map((number) => Math.min(9999, Math.round(number)));

    if (numbers.length) {
      return [...new Set(numbers)].sort((a, b) => a - b);
    }

    const count = num(legacyCount);
    if (count && count > 0) {
      const max = Math.min(500, Math.round(count));
      return Array.from({ length: max }, (_, index) => index + 1);
    }
    return [];
  }

  function ownedVolumeCount(item) {
    if (!item) return 0;
    return normalizeOwnedVolumes(item.ownedVolumes, item.volumesOwned).length;
  }

  function normalizeUserFields(item) {
    const statuses = ['unread', 'reading', 'read', 'dropped'];
    const ownedVolumes = normalizeOwnedVolumes(item.ownedVolumes, item.volumesOwned);
    return {
      owned: Boolean(item.owned),
      wishlist: Boolean(item.wishlist),
      readStatus: statuses.includes(item.readStatus) ? item.readStatus : 'unread',
      rating: Math.max(0, Math.min(5, Math.round((num(item.rating) || 0) * 2) / 2)),
      volumesOwned: ownedVolumes.length,
      ownedVolumes,
      condition: CONDITIONS.includes(item.condition) ? item.condition : '',
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 4000) : '',
      favorite: Boolean(item.favorite)
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        return { version: 1, items: {}, settings: { ...defaultSettings } };
      }
      const parsed = JSON.parse(raw);
      const items = {};
      if (parsed && parsed.items && typeof parsed.items === 'object') {
        Object.entries(parsed.items).forEach(([id, value]) => {
          if (!value || !value.title) return;
          const base = snapshot({ ...value, id: value.id || id });
          items[base.id] = {
            ...base,
            ...normalizeUserFields(value),
            addedAt: Number(value.addedAt) || Date.now(),
            updatedAt: Number(value.updatedAt) || Date.now()
          };
        });
      }
      return {
        version: 1,
        items,
        settings: { ...defaultSettings, ...(parsed.settings || {}) }
      };
    } catch (err) {
      console.warn('[Bulle] Impossible de lire la collection locale.', err);
      return { version: 1, items: {}, settings: { ...defaultSettings } };
    }
  }

  let state = load();
  let saveTimer = null;

  function persist(immediate) {
    clearTimeout(saveTimer);
    const write = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (err) {
        console.error('[Bulle] Sauvegarde impossible.', err);
        if (window.Bulle && window.Bulle.toast) {
          window.Bulle.toast('Stockage plein : exporte ta collection pour la sécuriser.', 'error');
        }
      }
    };
    if (immediate) write();
    else saveTimer = setTimeout(write, 120);
    window.dispatchEvent(new CustomEvent('bulle:store'));
  }

  function all() {
    return Object.values(state.items).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function get(id) {
    return state.items[id] || null;
  }

  function has(id) {
    return Boolean(state.items[id]);
  }

  function track(base, patch) {
    const existing = state.items[base.id];
    if (existing) {
      const mergedPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(mergedPatch, 'ownedVolumes')) mergedPatch.volumesOwned = 0;
      const updated = { ...existing, ...normalizeUserFields({ ...existing, ...mergedPatch }), updatedAt: Date.now() };
      state.items[existing.id] = updated;
      persist();
      return updated;
    }
    const item = snapshot(base);
    const user = normalizeUserFields({ ...DEFAULTS, ...patch });
    if (user.owned && !user.ownedVolumes.length) {
      user.ownedVolumes = [1];
      user.volumesOwned = 1;
    }
    const tracked = { ...item, ...user, addedAt: Date.now(), updatedAt: Date.now() };
    state.items[tracked.id] = tracked;
    persist();
    return tracked;
  }

  function update(id, patch) {
    const existing = state.items[id];
    if (!existing) return null;
    const mergedPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(mergedPatch, 'ownedVolumes')) mergedPatch.volumesOwned = 0;
    const next = { ...existing, ...mergedPatch, updatedAt: Date.now() };
    Object.assign(next, normalizeUserFields(next));
    state.items[id] = next;
    persist();
    return next;
  }

  function remove(id) {
    if (!state.items[id]) return false;
    delete state.items[id];
    persist(true);
    return true;
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    persist();
  }

  function stats() {
    const items = all();
    const owned = items.filter((i) => i.owned);
    const wishlist = items.filter((i) => i.wishlist);
    const reading = items.filter((i) => i.readStatus === 'reading');
    const read = items.filter((i) => i.readStatus === 'read');
    const dropped = items.filter((i) => i.readStatus === 'dropped');

    const volumes = owned.reduce((sum, i) => sum + ownedVolumeCount(i), 0);

    const rated = items.filter((i) => i.rating > 0);
    const averageRating = rated.length
      ? rated.reduce((sum, i) => sum + i.rating, 0) / rated.length
      : 0;

    const genreMap = new Map();
    owned.forEach((i) => {
      (i.genres || []).forEach((g) => {
        const key = g.trim();
        if (!key) return;
        genreMap.set(key, (genreMap.get(key) || 0) + 1);
      });
    });
    const genres = [...genreMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const kindSplit = {
      manga: owned.filter((i) => i.kind === 'manga').length,
      bd: owned.filter((i) => i.kind === 'bd').length
    };

    const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: items.filter((i) => Math.ceil(i.rating) === star).length
    }));

    const topRated = owned
      .filter((i) => i.rating > 0)
      .sort((a, b) => b.rating - a.rating || (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 5);

    const ownedUnread = owned.filter((i) => i.readStatus === 'unread').length;
    const ownedRead = owned.filter((i) => i.readStatus === 'read').length;

    return {
      series: items.length,
      ownedCount: owned.length,
      wishlistCount: wishlist.length,
      readingCount: reading.length,
      readCount: read.length,
      droppedCount: dropped.length,
      ownedUnread,
      ownedRead,
      volumes,
      averageRating,
      ratedCount: rated.length,
      genres,
      kindSplit,
      ratingDist,
      topRated,
      items
    };
  }

  function exportData() {
    return {
      app: 'Bulle',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...state.settings },
      items: state.items
    };
  }

  function importData(raw) {
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      throw new Error('Le fichier n’est pas un JSON valide.');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Fichier invalide.');

    const incoming = Array.isArray(parsed.items)
      ? Object.fromEntries(parsed.items.map((i) => [i.id, i]))
      : parsed.items;

    if (!incoming || typeof incoming !== 'object') {
      throw new Error('Aucune collection trouvée dans ce fichier.');
    }

    let added = 0;
    let updated = 0;
    Object.entries(incoming).forEach(([id, value]) => {
      if (!value || !value.title) return;
      const base = snapshot({ ...value, id: value.id || id });
      const user = normalizeUserFields(value);
      const existed = Boolean(state.items[base.id]);
      state.items[base.id] = {
        ...(existed ? state.items[base.id] : {}),
        ...base,
        ...user,
        addedAt: Number(value.addedAt) || (existed ? state.items[base.id].addedAt : Date.now()),
        updatedAt: Number(value.updatedAt) || Date.now()
      };
      if (existed) updated += 1;
      else added += 1;
    });

    if (parsed.settings && typeof parsed.settings === 'object') {
      const name = typeof parsed.settings.name === 'string' ? parsed.settings.name : state.settings.name;
      const theme = parsed.settings.theme === 'light' ? 'light' : 'dark';
      state.settings = { ...state.settings, name, theme };
    }

    persist(true);
    return { added, updated };
  }

  function clear() {
    state.items = {};
    state.settings = { ...defaultSettings };
    persist(true);
  }

  function pickDemoSource() {
    const rows = (window.SEED && window.SEED.rows) || [];
    const seen = new Set();
    const pool = [];
    rows.forEach((row) => {
      (row.items || []).forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          pool.push(item);
        }
      });
    });
    return pool;
  }

  function loadDemo() {
    const pool = pickDemoSource();
    if (!pool.length) return 0;

    const picks = [];
    const rows = (window.SEED && window.SEED.rows) || [];
    const offsets = [0, 3, 7, 11];
    rows.forEach((row, rowIndex) => {
      const items = row.items || [];
      if (!items.length) return;
      const count = rowIndex < 3 ? 3 : 2;
      for (let k = 0; k < count; k += 1) {
        const item = items[(offsets[rowIndex % offsets.length] + k * 2) % items.length];
        if (item && !picks.some((p) => p.id === item.id)) picks.push(item);
      }
    });

    const owned = picks.slice(0, 9);
    const wish = picks.slice(9, 14);
    const reading = picks.slice(14, 17);

    const ratings = [5, 4.5, 4, 3.5, 5, 4, 3, 4.5, 4];

    owned.forEach((item, index) => {
      track(item, {
        owned: true,
        wishlist: false,
        readStatus: index < 5 ? 'read' : index < 7 ? 'reading' : 'unread',
        rating: ratings[index % ratings.length],
        volumesOwned: item.volumes ? Math.min(item.volumes, 1 + (index % 4)) : 1,
        condition: index % 3 === 0 ? 'Très bon état' : 'Bon état',
        notes: index === 0 ? 'Souvenir d’une convention, dédicace à l’intérieur.' : ''
      });
    });

    wish.forEach((item) => {
      track(item, { owned: false, wishlist: true, readStatus: 'unread' });
    });

    reading.forEach((item) => {
      track(item, { owned: true, readStatus: 'reading', volumesOwned: 2, rating: 0 });
    });

    state.settings.demo = true;
    state.settings.onboarded = true;
    persist(true);
    return owned.length + wish.length + reading.length;
  }

  window.Store = {
    KEY,
    CONDITIONS,
    DEFAULTS,
    get state() { return state; },
    get settings() { return state.settings; },
    all,
    get,
    has,
    track,
    update,
    remove,
    setSetting,
    stats,
    exportData,
    importData,
    clear,
    loadDemo,
    toArray,
    cleanText,
    num,
    applyFrCover,
    normalizeOwnedVolumes,
    ownedVolumeCount,
    normalizeUserFields
  };
})();
