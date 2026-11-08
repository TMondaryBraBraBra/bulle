/* =========================================================
   BULLE — écrans : accueil + explorer
   ========================================================= */
(function () {
  'use strict';
  const S = window.Screens = window.Screens || {};

  function emptyState(options) {
    const B = window.B;
    const opts = options || {};
    return `<div class="empty">
      <div class="empty__art">${B.icon(opts.icon || 'book')}</div>
      <h3>${B.esc(opts.title || 'Rien par ici')}</h3>
      <p>${B.esc(opts.text || '')}</p>
      ${opts.actions ? `<div class="empty__actions">${opts.actions}</div>` : ''}
    </div>`;
  }

  function skeletonGrid(count) {
    const card = `<div class="skeleton-card">
      <div class="skeleton skeleton-card__art"></div>
      <div class="skeleton skeleton-card__line"></div>
      <div class="skeleton skeleton-card__line skeleton-card__line--short"></div>
    </div>`;
    return `<div class="grid grid--posters">${Array.from({ length: count || 12 }, () => card).join('')}</div>`;
  }

  S.emptyState = emptyState;
  S.skeletonGrid = skeletonGrid;

  /* ============================ HOME ============================ */
  S.home = function home() {
    const B = window.B;
    const { esc, icon, fmtEUR, fmtRating, fmtInt, plural } = B;
    const Store = window.Store;
    const stats = Store.stats();
    const items = Store.all();
    const owned = items.filter((item) => item.owned);
    const wishlist = items.filter((item) => item.wishlist);
    const reading = items.filter((item) => item.readStatus === 'reading');
    const favorites = items.filter((item) => item.rating >= 4).sort((a, b) => b.rating - a.rating);

    const fallbackRow = B.ROWS.find((row) => row.id === 'manga-tendances') || B.ROWS[0];
    const featured = owned
      .slice()
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
      .find((item) => item.banner) ||
      owned[0] ||
      (fallbackRow && fallbackRow.items[0]) ||
      B.CATALOG[0];

    if (!featured) {
      return `<section class="page">${emptyState({
        icon: 'library',
        title: 'Ta librairie est vide',
        text: 'Le catalogue n’a pas pu être chargé. Recharge l’application.',
        actions: '<button class="btn btn--accent" data-action="reload-app" type="button">Recharger</button>'
      })}</section>`;
    }

    const tracked = Store.get(featured.id);
    const isOwned = Boolean(tracked && tracked.owned);
    const isWished = Boolean(tracked && tracked.wishlist);
    const heroState = isOwned ? 'Dans ta librairie' : isWished ? 'Dans ta wishlist' : 'À découvrir';
    const heroBadgeClass = isOwned ? 'badge--soft' : isWished ? 'badge--soft' : 'badge--accent';
    const bg = featured.banner || featured.cover || '';
    const heroRating = tracked ? Number(tracked.rating) || 0 : 0;

    const meta = [
      B.kindLabel(featured),
      featured.year ? String(featured.year) : '',
      featured.volumes ? featured.volumes + ' tomes' : '',
      heroRating ? 'Ta note ' + fmtRating(heroRating) + '/5' : (featured.score ? featured.score + '/100' : '')
    ].filter(Boolean);

    const hero = `<section class="hero">
      <div class="hero__media ${featured.banner ? '' : 'hero__media--blur'}">
        ${bg ? `<img src="${esc(bg)}" alt="" referrerpolicy="no-referrer">` : ''}
      </div>
      <a class="hero__user" href="#/settings">
        <span class="hero__avatar">${esc(B.initials(Store.settings.name || 'Toi'))}</span>
        <span>
          ${esc(Store.settings.name || 'Mon profil')}
          <small>${stats.ownedCount} possédés · ${stats.wishlistCount} envies</small>
        </span>
      </a>
      <div class="hero__content">
        <span class="badge ${heroBadgeClass} hero__badge">${icon(isOwned ? 'check' : isWished ? 'heart' : 'sparkles')} ${esc(heroState)}</span>
        <h1 class="hero__title">${esc(featured.title)}</h1>
        <div class="hero__meta">
          ${meta.map((part, index) => `${index ? '<span class="dot"></span>' : ''}<span>${esc(part)}</span>`).join('')}
        </div>
        <p class="hero__desc">${esc(featured.description || 'Une nouvelle histoire à ajouter à ta collection. Ouvre la fiche pour la découvrir, la noter, ou la mettre de côté.')}</p>
        <div class="hero__actions">
          <button class="btn btn--accent" data-action="open-item" data-id="${esc(featured.id)}" type="button">
            ${icon('book')} ${isOwned ? 'Ouvrir ma fiche' : 'Découvrir'}
          </button>
          <button class="btn btn--ghost" data-action="explore-kind" data-kind="${featured.kind}" type="button">
            ${icon('compass')} Explorer
          </button>
        </div>
      </div>
    </section>`;

    const welcome = stats.series === 0 ? `<section class="welcome">
      <div class="welcome__copy">
        <span class="eyebrow">Bienvenue dans Bulle</span>
        <h2>Ta collection, enfin à ton image.</h2>
        <p>Un manga possédé, une BD empruntée, un tome que tu veux absolument ? Dis-le en un tap, note ce que tu aimes, garde une trace de tes achats.</p>
        <div class="welcome__actions">
          <button class="btn btn--accent" data-action="explore-kind" data-kind="all" type="button">${icon('compass')} Explorer le catalogue</button>
          <button class="btn" data-action="load-demo" type="button">${icon('sparkles')} Charger des exemples</button>
        </div>
      </div>
      <div class="welcome__steps">
        <div class="welcome__step">
          <span class="welcome__step-icon">${icon('library')}</span>
          <strong>Possède ou veux</strong>
          <span>Ta librairie et ta wishlist, séparées mais complémentaires.</span>
        </div>
        <div class="welcome__step">
          <span class="welcome__step-icon">${icon('book')}</span>
          <strong>Lis et note</strong>
          <span>À lire, en cours, lu, abandonné. Et une note sur 5, aux demi-étoiles.</span>
        </div>
        <div class="welcome__step">
          <span class="welcome__step-icon">${icon('euro')}</span>
          <strong>Suis la valeur</strong>
          <span>Prix d’achat, tome possédé, valeur de revente estimée.</span>
        </div>
      </div>
    </section>` : '';

    const rows = [];

    if (reading.length) {
      rows.push({
        title: 'Reprendre la lecture',
        subtitle: 'Là où tu t’es arrêté',
        items: reading.slice(0, 14),
        see: { action: 'goto-library', filter: 'reading' }
      });
    }

    if (owned.length) {
      rows.push({
        title: 'Ma librairie',
        subtitle: `${fmtInt(owned.length)} ${plural(owned.length, 'série')} · ${fmtInt(stats.volumes)} ${plural(stats.volumes, 'tome')}`,
        items: owned
          .slice()
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .slice(0, 16),
        see: { action: 'goto-library', filter: 'owned' }
      });
    }

    if (wishlist.length) {
      rows.push({
        title: 'Ma wishlist',
        subtitle: 'Les titres qui te font de l’œil',
        items: wishlist.slice(0, 14),
        see: { action: 'goto-library', filter: 'wishlist' }
      });
    }

    if (favorites.length) {
      rows.push({
        title: 'Tes coups de cœur',
        subtitle: 'Ta crème de la crème, notée 4 étoiles et plus',
        items: favorites.slice(0, 14),
        see: { action: 'goto-library', filter: 'read' }
      });
    }

    const seedIds = ['manga-tendances', 'bd-franco', 'manga-fantasy', 'bd-comics', 'bd-graphic', 'manga-romance'];
    seedIds.forEach((id) => {
      const row = B.ROWS.find((entry) => entry.id === id);
      if (!row || !row.items.length) return;
      rows.push({
        title: row.title,
        subtitle: row.subtitle,
        items: row.items.slice(0, 18),
        see: { action: 'explore-kind', kind: row.kind }
      });
    });

    return `<section class="home">
      ${hero}
      ${welcome}
      <div class="rows">${rows.map((row) => B.rowHTML(row)).join('')}</div>
      <footer class="home-foot">
        <span>${icon('shield')} Ta collection est stockée sur ton téléphone, pas sur un serveur.</span>
        <a href="#/settings">Gérer mes données</a>
      </footer>
    </section>`;
  };

  /* ============================ EXPLORE ============================ */
  S.explore = function explore() {
    const B = window.B;
    const { esc, icon } = B;
    const e = B.ui.explore;

    const segment = (kind, label) => `<button class="segmented__btn ${e.kind === kind ? 'is-active' : ''}"
      data-action="set-explore-kind" data-kind="${kind}" type="button">${esc(label)}</button>`;

    return `<section class="page">
      <div class="explore-head">
        <div>
          <span class="eyebrow">Catalogue</span>
          <h1 class="page-title">Explorer</h1>
          <p class="page-sub">Des milliers de mangas et de BD, avec leurs couvertures. Cherche, découvre, puis garde ce qui te plaît.</p>
        </div>
        <div class="segmented" role="tablist" aria-label="Type de titre">
          ${segment('all', 'Tout')}
          ${segment('manga', 'Mangas')}
          ${segment('bd', 'BD & comics')}
        </div>
      </div>

      <div class="explore-tools">
        <div class="searchbar">
          ${icon('search')}
          <input id="explore-search" type="search" value="${esc(e.q)}" placeholder="Titre, auteur, genre… (ex. Berserk, Thorgal)"
            autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Rechercher un manga ou une BD">
          ${e.q ? `<button class="searchbar__clear" data-action="clear-search" type="button" aria-label="Effacer la recherche">${icon('x')}</button>` : ''}
        </div>
        <select class="select" id="explore-sort" aria-label="Trier les résultats">
          <option value="relevance" ${e.sort === 'relevance' ? 'selected' : ''}>Sélection Bulle</option>
          <option value="score" ${e.sort === 'score' ? 'selected' : ''}>Mieux notés</option>
          <option value="year" ${e.sort === 'year' ? 'selected' : ''}>Plus récents</option>
          <option value="title" ${e.sort === 'title' ? 'selected' : ''}>A → Z</option>
        </select>
      </div>

      <div id="explore-results">${S.exploreResultsHTML()}</div>
    </section>`;
  };

  S.exploreResultsHTML = function exploreResultsHTML() {
    const B = window.B;
    const { esc, icon, fmtInt } = B;
    const Store = window.Store;
    const e = B.ui.explore;
    const query = e.q.trim();

    if (!query) {
      const genres = B.galleryGenres();
      const all = B.galleryCatalog();
      const sorted = B.sortItems(all, e.sort);
      const shown = sorted.slice(0, e.limit);
      const seedDate = window.SEED && window.SEED.generated
        ? new Date(window.SEED.generated + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        : '';

      const genreChips = [
        `<button class="chip ${!e.genre ? 'is-active' : ''}" data-action="explore-genre" data-genre="" type="button">Tous <span class="count">${B.CATALOG.length}</span></button>`
      ].concat(genres.map((genre) => `<button class="chip ${e.genre === genre.name ? 'is-active' : ''}"
        data-action="explore-genre" data-genre="${esc(genre.name)}" type="button">${esc(genre.name)} <span class="count">${genre.count}</span></button>`)).join('');

      return `<div class="genre-cloud">${genreChips}</div>
        <div class="section-head">
          <div>
            <h2 class="section-title">${e.genre ? esc(e.genre) : 'Le catalogue Bulle'}</h2>
            <p class="section-sub">${fmtInt(all.length)} ${e.genre ? 'titres dans ce genre' : 'mangas, BD et comics sélectionnés'}${seedDate ? ' · édition ' + esc(seedDate) : ''}</p>
          </div>
          <span class="result-note">${icon('globe')} Catalogue local, dispo hors-ligne</span>
        </div>
        ${shown.length ? `<div class="grid grid--posters">${shown.map((item) => B.posterCard(item)).join('')}</div>` : emptyState({
          icon: 'compass',
          title: 'Aucun titre dans ce genre',
          text: 'Essaie un autre genre ou affiche tout le catalogue.',
          actions: '<button class="btn" data-action="explore-genre" data-genre="" type="button">Tout afficher</button>'
        })}
        ${sorted.length > e.limit ? `<div class="load-more-wrap"><button class="btn" data-action="load-more" type="button">Afficher ${Math.min(28, sorted.length - e.limit)} titres de plus</button></div>` : ''}`;
    }

    const local = B.searchLocal(query);
    let remote = e.searchedFor === query ? e.items : [];
    let merged = B.mergeResults(remote, local);
    if (e.kind !== 'all') merged = merged.filter((item) => item.kind === e.kind);
    const sorted = B.sortItems(merged, e.sort);
    const shown = sorted.slice(0, e.limit);
    const waiting = query.length >= 2 && e.searchedFor !== query && !e.loading;
    const loading = e.loading;
    const errors = e.errors || [];
    const offline = navigator.onLine === false;

    const errorBox = errors.length && !shown.length ? `<div class="error-box">
      ${icon('info')}
      <div>
        <strong>La recherche en ligne n’a pas répondu.</strong><br>
        ${offline ? 'Tu es hors-ligne : le catalogue local reste disponible.' : esc(errors.map((error) => error.source + ' (' + error.message + ')').join(' · '))}
        <div style="margin-top:8px"><button class="btn btn--small" data-action="retry-search" type="button">Réessayer</button></div>
      </div>
    </div>` : '';

    const resultHeader = `<div class="section-head">
      <div>
        <h2 class="section-title">Résultats pour « ${esc(query)} »</h2>
        <p class="section-sub">${shown.length ? fmtInt(sorted.length) + ' ' + (sorted.length > 1 ? 'titres trouvés' : 'titre trouvé') : (loading ? 'Recherche en cours…' : 'Aucun titre pour le moment')}${e.kind !== 'all' ? ' · ' + (e.kind === 'manga' ? 'mangas' : 'BD & comics') : ''}</p>
      </div>
      ${sorted.length ? `<button class="btn-link" data-action="clear-search" type="button">${icon('x')} Effacer</button>` : ''}
    </div>`;

    const sourceLabel = e.kind === 'manga'
      ? 'AniList'
      : e.kind === 'bd'
        ? 'Open Library et Google Books'
        : 'AniList, Open Library et Google Books';

    const loader = loading ? `<div class="loader-line"><span class="spinner"></span> Recherche dans ${sourceLabel}…</div>` : '';

    let content = '';
    if (shown.length) {
      content = `<div class="grid grid--posters">${shown.map((item) => B.posterCard(item)).join('')}</div>`;
    } else if (loading || waiting) {
      content = skeletonGrid(12);
    } else {
      content = emptyState({
        icon: 'search',
        title: 'Aucun résultat',
        text: offline
          ? 'Pas de connexion : seuls les titres du catalogue local sont cherchables. Reconnecte-toi pour interroger les bases en ligne.'
          : 'Essaie un autre titre, un nom d’auteur, ou vérifie l’orthographe. Tu peux aussi chercher dans toutes les catégories.',
        actions: `<button class="btn" data-action="set-explore-kind" data-kind="all" type="button">Chercher partout</button>
          <button class="btn" data-action="retry-search" type="button">${icon('refresh')} Réessayer</button>`
      });
    }

    const more = sorted.length > e.limit
      ? `<div class="load-more-wrap"><button class="btn" data-action="load-more" type="button">Afficher plus de résultats</button></div>`
      : '';

    const onlineNote = (shown.length && (remote.length || errors.length))
      ? `<p class="result-note">${icon('globe')} Résultats issus d’${sourceLabel} · ajoute un titre pour le garder hors-ligne.</p>`
      : '';

    return `${resultHeader}${loader}${errorBox}${content}${more}${onlineNote}`;
  };
})();
