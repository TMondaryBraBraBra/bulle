/* =========================================================
   BULLE — online catalog search
   Sources : AniList (mangas) · Open Library (BD) · Google Books (BD)
   Aucune clé API, aucun compte, tout est gratuit.
   ========================================================= */
(function () {
  'use strict';

  const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
  const CACHE_PREFIX = 'bulle.search.v12:';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const CACHE_MAX = 80;

  const ANILIST_QUERY = `
    query ($search: String) {
      Page(page: 1, perPage: 50) {
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
          externalLinks { site url type language }
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

  /* ------------------------- détection des éditions françaises ------------------------- */

  const FRENCH_PUBLISHERS = [
    'le lombard', 'casterman', 'dupuis', 'dargaud', 'glenat', 'kana', 'pika', 'ki-oon',
    'kurokawa', 'kaze', 'panini', 'soleil', 'akata', 'delcourt', 'bamboo', 'fluide glacial',
    'les humanoides', 'urban comics', 'tonkam', 'taifu', 'ototo', 'noeve', 'na ban',
    'mangetsu', 'chatto', 'sarbacane', 'futuropolis', 'cornelius', 'steinkis', 'ca et la',
    'glenat manga', 'pika edition', 'kurokawa manga'
  ];

  const NON_BOOK = /(?:coloriage|coloring|agenda|calendrier|calendar|quiz|quizz|carnet|journal|poster|artbook|fanbook|guide|encyclop|illustration|recipe|cuisine|stickers?|cahier|bloc|puzzle)/i;
  const NON_VOLUME = /^(?:box|coffret|pack|lot)\b/i;
  const FOREIGN_TITLE = /\b(?:de|het|een)\s+[a-zà-ÿ'’-]+\s+van\b|\b(?:swiat|specjalny|ksiega|opowiesci)\b/i;

  function isFrenchPublisher(doc) {
    const publishers = normalize(toArray(doc.publisher).join(' '));
    return FRENCH_PUBLISHERS.some((name) => publishers.includes(name));
  }

  function isFrenchDoc(doc) {
    const langs = toArray(doc.language).map((lang) => String(lang).toLowerCase());
    if (langs.includes('fre') || langs.includes('fr')) return true;
    if (langs.length) return false;
    const title = String(doc.title || '');
    if (FOREIGN_TITLE.test(title)) return false;
    if (isFrenchPublisher(doc)) return true;
    return /(?:tome|tomes|int[ée]grale|integrale|[ée]dition|edition|coffret)\b/i.test(title) ||
      /[àâäçéèêëîïôöùûüÿœæ]/i.test(title);
  }

  function volumeNumber(title) {
    const value = normalize(title);
    let match = value.match(/\b(?:tome|tomes|volume|vol)\b\.?\s*0*(\d{1,3})\b/);
    if (!match) match = value.match(/\bt\.?\s*0*(\d{1,3})\b/);
    if (!match) match = value.match(/\bt0*(\d{1,3})\b/);
    if (match) return parseInt(match[1], 10);
    match = value.match(/\s0*(\d{1,3})$/);
    if (match) {
      const volume = parseInt(match[1], 10);
      if (volume >= 1 && volume <= 200) return volume;
    }
    return null;
  }

  function seriesKeyFromTitle(title) {
    let value = normalize(title);
    value = value.replace(/\b(?:tome|tomes|volume|vol)\b\.?\s*0*\d{1,3}.*$/, '');
    value = value.replace(/\bt\.?\s*0*\d{1,3}.*$/, '');
    value = value.replace(/\bt0*\d{1,3}.*$/, '');
    value = value.replace(/\s0*\d{1,3}$/, '');
    return value.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function openLibraryKey(doc) {
    const volume = volumeNumber(doc.title);
    if (volume !== null) {
      const series = seriesKeyFromTitle(doc.title);
      if (series) return 'v:' + series + ':' + volume;
    }
    return 't:' + normalize(doc.title).replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function docScore(doc) {
    const langs = toArray(doc.language).map((lang) => String(lang).toLowerCase());
    let score = 0;
    if (langs.includes('fre') || langs.includes('fr')) score += 4;
    if (isFrenchPublisher(doc)) score += 3;
    if (doc.cover_i) score += 2;
    if (/(?:tome|tomes|int[ée]grale|integrale)/i.test(String(doc.title || ''))) score += 1;
    if (toArray(doc.author_name).some((name) => latinTitle(name))) score += 1;
    return score;
  }

  function latinTitle(title) {
    return (String(title || '').match(/[a-z]/gi) || []).length >= 3;
  }

  function titleCase(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/(^|[\s'’/-])([a-zà-ÿ])/g, (match, separator, letter) => separator + letter.toUpperCase());
  }

  function frenchVolumeTitle(title) {
    const raw = String(title || '').trim();
    if (/\b(?:tome|tomes|volume|vol)\b/i.test(raw)) return raw;
    const match = raw.match(/^(.*?)\s*[-–—]?\s*0*(\d{1,3})$/);
    if (!match) return raw;
    const series = match[1].replace(/[\s,;:–—-]+$/, '').trim();
    const volume = parseInt(match[2], 10);
    if (!series || volume < 1 || volume > 200) return raw;
    return titleCase(series) + ', tome ' + volume;
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

      // On ne garde que les titres réellement édités en français.
      const frenchLinks = toArray(m.externalLinks).filter((link) => link && link.language === 'French');
      if (!frenchLinks.length) return;
      const frenchUrl = frenchLinks.map((link) => link.url).find(Boolean) || '';

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
        frUrl: frenchUrl,
        accent: (m.coverImage && m.coverImage.color) || ''
      });
    });

    return output;
  }

  /* ---------------- Open Library ---------------- */
  const COMIC_HINT = /comic|graphic novel|bande dessin|bandes dessin|manga|roman graphique|bd\b/i;

  async function searchOpenLibrary(query, mode) {
    const fields = 'key,title,author_name,cover_i,first_publish_year,subject,first_sentence,language,publisher';
    const pageUrls = [1, 2].map((page) =>
      'https://openlibrary.org/search.json?q=' + encodeURIComponent(query) +
      '&limit=100&page=' + page +
      (mode === 'manga' ? '&language=fre' : '') +
      '&fields=' + fields
    );

    const pages = await Promise.allSettled(pageUrls.map((url) => fetchJson(url, {}, 16000)));
    const fulfilled = pages.filter((result) => result.status === 'fulfilled');
    if (!fulfilled.length) throw pages[0].reason || new Error('Open Library indisponible');

    const docs = fulfilled.flatMap((result) =>
      Array.isArray(result.value.docs) ? result.value.docs : []
    );

    const qNorm = normalize(query);
    const tokens = qNorm.split(' ').filter((token) => token.length >= 3);
    const output = [];
    const seen = new Set();
    const candidates = [];

    docs.forEach((doc) => {
      if (!doc || !doc.title || !doc.key) return;
      if (!latinTitle(doc.title) || NON_BOOK.test(String(doc.title)) || NON_VOLUME.test(String(doc.title))) return;
      if (!isFrenchDoc(doc)) return;

      const subjects = toArray(doc.subject);
      const subjectText = subjects.join(' ');
      const titleNorm = normalize(doc.title);
      const authorText = normalize(toArray(doc.author_name).join(' '));
      const comicish = COMIC_HINT.test(doc.title + ' ' + subjectText);
      const titleMatch = Boolean(qNorm) && (
        titleNorm.includes(qNorm) ||
        (tokens.length > 0 && tokens.every((token) => titleNorm.includes(token)))
      );
      const authorMatch = tokens.length > 0 && tokens.every((token) => authorText.includes(token));
      const isManga = /manga/i.test(subjectText);

      if (mode === 'manga') {
        if (!isManga) return;
      } else if (mode === 'bd') {
        if (isManga) return;
        if (!comicish && !titleMatch && !authorMatch) return;
      } else {
        if (!comicish && !titleMatch && !authorMatch) return;
      }

      candidates.push({
        doc,
        kind: isManga ? 'manga' : 'bd',
        score: docScore(doc)
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    candidates.forEach(({ doc, kind }) => {
      const key = openLibraryKey(doc);
      if (!key || seen.has(key)) return;
      seen.add(key);

      const workKey = String(doc.key || '').replace('/works/', '');
      if (!workKey) return;

      const subjects = toArray(doc.subject);
      const displayTitle = frenchVolumeTitle(doc.title);
      output.push({
        id: 'ol:' + workKey,
        source: 'openlibrary',
        kind,
        subtype: kind === 'manga' ? 'Manga' : 'BD',
        title: displayTitle,
        altTitle: displayTitle !== doc.title ? doc.title : '',
        author: toArray(doc.author_name).filter((name) => latinTitle(name)).slice(0, 2).join(', '),
        cover: doc.cover_i ? 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg' : '',
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
  async function searchGoogleBooks(query, mode) {
    const urls = [0, 40].map((startIndex) =>
      'https://www.googleapis.com/books/v1/volumes?q=' +
      encodeURIComponent(query) +
      '&maxResults=40&startIndex=' + startIndex +
      '&printType=books&orderBy=relevance&langRestrict=fr'
    );

    const pages = await Promise.allSettled(urls.map((url) => fetchJson(url, {}, 12000)));
    const fulfilled = pages.filter((result) => result.status === 'fulfilled');
    if (!fulfilled.length) return [];

    const volumes = fulfilled.flatMap((result) =>
      Array.isArray(result.value.items) ? result.value.items : []
    );
    const output = [];
    const seen = new Set();

    volumes.forEach((entry) => {
      const info = entry && entry.volumeInfo;
      if (!info || !info.title || !entry.id) return;
      if (info.language && String(info.language).toLowerCase() !== 'fr') return;

      const categories = toArray(info.categories);
      const text = info.title + ' ' + (info.subtitle || '') + ' ' + (info.description || '').slice(0, 200);
      const isManga = categories.some((c) => /manga/i.test(c)) || /\bmanga\b/i.test(text);
      const isComic = categories.some((c) => COMIC_HINT.test(c)) || COMIC_HINT.test(text);
      if (!isComic) return;
      if (mode === 'manga' && !isManga) return;
      if (mode === 'bd' && isManga) return;

      const key = normalize(info.title).replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);

      const links = info.imageLinks || {};
      let cover = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '';
      if (!cover) return;
      cover = cover.replace(/^http:/, 'https:').replace(/&zoom=\d/, '&zoom=2');

      output.push({
        id: 'gb:' + entry.id,
        source: 'googlebooks',
        kind: isManga ? 'manga' : 'bd',
        subtype: isManga ? 'Manga' : 'BD / Comics',
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
      const volume = volumeNumber(item.title);
      const key = volume !== null
        ? 'v:' + seriesKeyFromTitle(item.title) + ':' + volume + '|' + item.kind
        : 't:' + normalize(item.title).replace(/[^a-z0-9]+/g, ' ').trim() + '|' + item.kind;
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
    jobs.push({ name: 'Open Library', run: searchOpenLibrary(q, mode) });

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

    let googleTried = false;
    if (mode !== 'manga') {
      const bdCount = items.filter((i) => i.kind === 'bd').length;
      if (bdCount < 20) {
        const extra = await searchGoogleBooks(q, mode);
        items.push(...extra);
        googleTried = true;
      }
    }
    if (mode !== 'bd' && !googleTried) {
      const mangaCount = items.filter((i) => i.kind === 'manga').length;
      if (mangaCount < 20) {
        const extra = await searchGoogleBooks(q, mode);
        items.push(...extra);
      }
    }

    const merged = dedupe(items)
      .slice(0, 160)
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
