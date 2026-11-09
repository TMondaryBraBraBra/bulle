/* =========================================================
   BULLE — online catalog search
   Sources : AniList (mangas) · Open Library (BD) · Google Books (BD)
   Aucune clé API, aucun compte, tout est gratuit.
   ========================================================= */
(function () {
  'use strict';

  const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
  const CACHE_PREFIX = 'bulle.search.v3:';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const CACHE_MAX = 80;

  const ANILIST_QUERY = `
    query ($search: String) {
      Page(page: 1, perPage: 24) {
        media(search: $search, type: MANGA, isAdult: false, sort: SEARCH_MATCH,
              format_in: [MANGA, ONE_SHOT]) {
          id
          title { romaji english native }
          coverImage { extraLarge large color }
          bannerImage
          description(asHtml: false)
          genres
          format
          status
          volumes
          chapters
          averageScore
          startDate { year }
          siteUrl
          staff(perPage: 3) { edges { role node { name { full } } } }
        }
      }
    }
  `;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fetchJson(url, options, timeoutMs) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.reject(new Error('Tu es hors-ligne.'));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 14000);
    return fetch(url, { ...(options || {}), signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          const error = new Error('HTTP ' + response.status);
          error.status = response.status;
          throw error;
        }
        return response.json();
      })
      .finally(() => clearTimeout(timer));
  }

  function cacheKey(query, kind) {
    return CACHE_PREFIX + kind + ':' + normalize(query);
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || !entry.at || Date.now() - entry.at > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.items;
    } catch (err) {
      return null;
    }
  }

  function cacheSet(key, items) {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
      if (keys.length >= CACHE_MAX) {
        keys
          .map((k) => {
            try { return { k, at: JSON.parse(localStorage.getItem(k)).at || 0 }; }
            catch (e) { return { k, at: 0 }; }
          })
          .sort((a, b) => a.at - b.at)
          .slice(0, Math.ceil(keys.length / 3))
          .forEach((entry) => localStorage.removeItem(entry.k));
      }
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), items }));
    } catch (err) {
      /* quota : on ignore, le cache n'est pas vital */
    }
  }

  /* ---------------- AniList ---------------- */
  async function searchAniList(query) {
    const payload = await fetchJson(
      ANILIST_ENDPOINT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: query } })
      },
      16000
    );

    if (payload.errors) {
      throw new Error(payload.errors[0] && payload.errors[0].message
        ? payload.errors[0].message
        : 'AniList a refusé la requête.');
    }

    const media = payload.data && payload.data.Page && payload.data.Page.media;
    if (!Array.isArray(media)) return [];

    const output = [];
    const seen = new Set();

    media.forEach((m) => {
      if (!m || !m.id) return;
      const title = (m.title && (m.title.english || m.title.romaji || m.title.native)) || '';
      if (!title) return;

      const authors = [];
      const staff = m.staff && m.staff.edges ? m.staff.edges : [];
      staff.forEach((edge) => {
        const name = edge && edge.node && edge.node.name && edge.node.name.full;
        if (name && !authors.includes(name)) authors.push(name);
      });

      const cover = m.coverImage && (m.coverImage.extraLarge || m.coverImage.large);
      if (!cover) return;

      const dedupe = normalize(title);
      if (seen.has(dedupe)) return;
      seen.add(dedupe);

      output.push({
        id: 'anilist:' + m.id,
        source: 'anilist',
        kind: 'manga',
        subtype: m.format === 'ONE_SHOT' ? 'One-shot' : 'Manga',
        title,
        author: authors.slice(0, 2).join(', '),
        cover,
        banner: m.bannerImage || '',
        description: cleanText(m.description),
        genres: toArray(m.genres).slice(0, 6),
        year: m.startDate && m.startDate.year ? m.startDate.year : null,
        volumes: m.volumes || null,
        chapters: m.chapters || null,
        score: m.averageScore || null,
        siteUrl: m.siteUrl || '',
        accent: (m.coverImage && m.coverImage.color) || ''
      });
    });

    return output;
  }

  /* ---------------- Open Library ---------------- */
  const COMIC_HINT = /comic|graphic novel|bande dessin|bandes dessin|manga|roman graphique|bd\b/i;

  async function searchOpenLibrary(query, mode) {
    const fields = 'key,title,author_name,cover_i,first_publish_year,subject,first_sentence';
    const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(query) +
      '&limit=30&fields=' + fields;
    const payload = await fetchJson(url, {}, 16000);
    const docs = Array.isArray(payload.docs) ? payload.docs : [];

    const strict = mode !== 'bd';
    const qNorm = normalize(query);
    const tokens = qNorm.split(' ').filter((token) => token.length >= 3);

    const output = [];
    const seen = new Set();

    docs.forEach((doc) => {
      if (!doc || !doc.cover_i || !doc.title) return;
      const subjects = toArray(doc.subject);
      const comicish = COMIC_HINT.test(doc.title + ' ' + subjects.join(' '));
      const titleNorm = normalize(doc.title);
      const titleMatch = Boolean(qNorm) && (
        titleNorm.includes(qNorm) ||
        (tokens.length > 0 && tokens.every((token) => titleNorm.includes(token)))
      );
      const seriesish = subjects.some((subject) => /^series:/i.test(String(subject)));

      if (strict && !comicish && !(titleMatch && seriesish)) return;
      if (!strict && !comicish && !titleMatch) return;

      const dedupe = titleNorm;
      if (!dedupe || seen.has(dedupe)) return;
      seen.add(dedupe);

      const key = String(doc.key || '').replace('/works/', '');
      if (!key) return;

      output.push({
        id: 'ol:' + key,
        source: 'openlibrary',
        kind: 'bd',
        subtype: /manga/i.test(subjects.join(' ')) ? 'Manga' : 'BD',
        title: doc.title,
        author: toArray(doc.author_name).slice(0, 2).join(', '),
        cover: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg',
        banner: '',
        description: cleanText(toArray(doc.first_sentence).join(' ')),
        genres: subjects.slice(0, 4).map((s) => cleanText(s).slice(0, 32)),
        year: doc.first_publish_year || null,
        volumes: null,
        chapters: null,
        score: null,
        siteUrl: 'https://openlibrary.org' + (doc.key || ''),
        accent: ''
      });
    });

    return output;
  }

  /* ---------------- Google Books ---------------- */
  async function searchGoogleBooks(query) {
    const url = 'https://www.googleapis.com/books/v1/volumes?q=' +
      encodeURIComponent(query) +
      '&maxResults=24&printType=books&orderBy=relevance&langRestrict=fr';

    let payload;
    try {
      payload = await fetchJson(url, {}, 12000);
    } catch (err) {
      return [];
    }

    const volumes = Array.isArray(payload.items) ? payload.items : [];
    const output = [];

    volumes.forEach((entry) => {
      const info = entry && entry.volumeInfo;
      if (!info || !info.title) return;

      const categories = toArray(info.categories);
      const isComic = categories.some((c) => COMIC_HINT.test(c)) ||
        COMIC_HINT.test(info.title + ' ' + (info.subtitle || '') + ' ' + (info.description || '').slice(0, 200));
      if (!isComic) return;

      const links = info.imageLinks || {};
      let cover = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '';
      if (!cover) return;
      cover = cover.replace(/^http:/, 'https:').replace(/&zoom=\d/, '&zoom=2');

      output.push({
        id: 'gb:' + entry.id,
        source: 'googlebooks',
        kind: 'bd',
        subtype: categories.some((c) => /manga/i.test(c)) ? 'Manga' : 'BD / Comics',
        title: info.title + (info.subtitle ? ' — ' + info.subtitle : ''),
        author: toArray(info.authors).slice(0, 2).join(', '),
        cover,
        banner: '',
        description: cleanText(info.description),
        genres: categories.slice(0, 3).map((c) => cleanText(c).slice(0, 32)),
        year: info.publishedDate ? parseInt(String(info.publishedDate).slice(0, 4), 10) : null,
        volumes: null,
        chapters: null,
        score: null,
        siteUrl: info.infoLink || ('https://books.google.com/books?id=' + entry.id),
        accent: ''
      });
    });

    return output;
  }

  /* ---------------- fusion ---------------- */
  function dedupe(items) {
    const seen = new Set();
    const out = [];
    items.forEach((item) => {
      if (!item || !item.title) return;
      const key = normalize(item.title).slice(0, 110) + '|' + item.kind;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  async function search(query, kind) {
    const q = String(query || '').trim();
    const mode = kind === 'manga' || kind === 'bd' ? kind : 'all';
    if (q.length < 2) return { items: [], errors: [] };

    const key = cacheKey(q, mode);
    const cached = cacheGet(key);
    if (cached) return { items: cached, errors: [], cached: true };

    const jobs = [];
    if (mode !== 'bd') jobs.push({ name: 'AniList', run: searchAniList(q) });
    if (mode !== 'manga') {
      jobs.push({ name: 'Open Library', run: searchOpenLibrary(q, mode) });
    }

    const settled = await Promise.allSettled(jobs.map((j) => j.run));
    const items = [];
    const errors = [];

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') items.push(...result.value);
      else {
        errors.push({
          source: jobs[index].name,
          message: result.reason && result.reason.name === 'AbortError'
            ? 'Délai dépassé'
            : (result.reason && result.reason.message) || 'Erreur inconnue'
        });
      }
    });

    if (mode !== 'manga') {
      const bdCount = items.filter((i) => i.kind === 'bd').length;
      if (bdCount < 6) {
        const extra = await searchGoogleBooks(q);
        items.push(...extra);
      }
    }

    const merged = dedupe(items)
      .slice(0, 42)
      .map((item) => (window.Store && window.Store.applyFrCover ? window.Store.applyFrCover(item) : item));
    if (merged.length) cacheSet(key, merged);

    return { items: merged, errors };
  }

  window.Api = {
    search,
    searchAniList,
    searchOpenLibrary,
    searchGoogleBooks,
    normalize,
    cleanText,
    toArray
  };
})();
