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
    const { esc, icon, fmtRating, fmtInt, plural } = B;
    const Store = window.Store;
    const stats = Store.stats();
    const items = Store.all();
    const owned = items.filter((item) => item.owned);
    const wishlist = items.filter((item) => item.wishlist);
    const reading = items.filter((item) => item.readStatus === 'reading');
    const favorites = items.filter((item) => item.rating >= 4).sort((a, b) => b.rating - a.rating);
    const tab = B.ui.home.tab || 'all';
    const collectionKeys = B.collectionSeriesKeys();
    const homeGroups = [];

    const inTab = (list) => {
      if (tab === 'manga') return list.filter((item) => item.kind !== 'bd');
      if (tab === 'bd') return list.filter((item) => item.kind === 'bd');
      return list;
    };

    function cardsFor(list) {
      if (tab === 'bd' || tab === 'all') {
        const grouped = B.groupCollectionEntries(list, 2);
        if (grouped.groups.length) {
          homeGroups.push(...grouped.groups);
          return {
            html: grouped.entries.map((entry) => entry.type === 'group'
              ? B.seriesCard(entry.group, { inCollection: entry.group.items.some((item) => item.owned) })
              : B.posterCard(entry.item)).join(''),
            items: grouped.entries
          };
        }
      }
      return { html: list.map((item) => B.posterCard(item)).join(''), items: list };
    }

    function row(list, title, subtitle, see) {
      const filtered = inTab(list);
      if (!filtered.length) return null;
      const cards = cardsFor(filtered);
      return { title, subtitle, items: cards.items, html: cards.html, see };
    }

    function releaseCardsFromEntries(entries) {
      return entries.map((entry) => entry.type === 'group'
        ? B.seriesCard(entry.group, {
          inCollection: entry.group.items.some((item) => {
            const release = B.findRelease(item.id);
            return release ? B.releaseMatchesCollection(release, collectionKeys) : false;
          })
        })
        : B.releaseCard(entry.release)).join('');
    }

    function releaseCards(releases) {
      const grouped = B.groupReleaseEntries(releases);
      homeGroups.push(...grouped.bdGroups);
      return releaseCardsFromEntries(grouped.entries);
    }

    function entryMatches(entry) {
      if (entry.type === 'group') {
        return entry.group.items.some((item) => {
          const release = B.findRelease(item.id);
          return release ? B.releaseMatchesCollection(release, collectionKeys) : false;
        });
      }
      return B.releaseMatchesCollection(entry.release, collectionKeys);
    }

    /* ----- héros carrousel ----- */
    const heroPool = [];
    const seenHeroes = new Set();
    const addHero = (item, kicker, cta, action) => {
      if (!item || !item.id || seenHeroes.has(item.id)) return;
      seenHeroes.add(item.id);
      heroPool.push({ item, kicker, cta, action });
    };

    reading.slice(0, 2).forEach((item) => addHero(item, 'Reprendre la lecture', 'Continuer', 'open-item'));
    const bannerOwned = owned.slice().sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    if (bannerOwned[0]) addHero(bannerOwned[0], 'Dans ta bibliothèque', 'Ouvrir ma fiche', 'open-item');
    if (wishlist[0]) addHero(wishlist[0], 'Dans ta wishlist', 'Voir la fiche', 'open-item');

    const upcoming = B.upcomingReleases();
    const nextRelease = upcoming.find((release) => B.releaseMatchesCollection(release, collectionKeys)) || upcoming[0];
    if (nextRelease) addHero(B.releaseToItem(nextRelease), 'Prochaine sortie', 'Voir la sortie', 'open-release');
    B.CATALOG.slice(0, 3).forEach((item) => addHero(item, 'À découvrir', 'Découvrir', 'open-item'));

    const heroSlides = heroPool.slice(0, 5).map((entry, index) => {
      const item = entry.item;
      const isRelease = entry.action === 'open-release';
      const bg = item.banner || item.cover || '';
      const title = isRelease ? (item.seriesTitle || item.title) : item.title;
      const meta = isRelease
        ? [item.releaseDate ? 'Sortie le ' + B.releaseDateLabel(item.releaseDate) : '', item.releaseLabel, item.publisher]
        : [B.kindLabel(item), item.author, item.year ? String(item.year) : ''];
      const badgeClass = isRelease ? 'badge--accent' : index === 0 && reading.length ? 'badge--gold' : 'badge--soft';
      return `<article class="hero-slide" aria-label="${esc(title)}">
        <div class="hero-slide__media ${bg ? '' : 'hero-slide__media--empty'}">
          ${bg ? `<img src="${esc(bg)}" alt="" referrerpolicy="no-referrer" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>` : ''}
        </div>
        <div class="hero-slide__shade"></div>
        <div class="hero-slide__body">
          <span class="badge ${badgeClass}">${icon(isRelease ? 'calendar' : index === 0 && reading.length ? 'book' : 'sparkles')} ${esc(entry.kicker)}</span>
          <h2 class="hero-slide__title">${esc(title)}</h2>
          <div class="hero-slide__meta">${meta.filter(Boolean).map((part, i) => `${i ? '<span class="dot"></span>' : ''}<span>${esc(part)}</span>`).join('')}</div>
          <p class="hero-slide__desc">${esc(item.description || 'Une nouvelle histoire à ajouter à ta collection. Ouvre la fiche pour la découvrir, la noter ou la mettre de côté.')}</p>
          <div class="hero-slide__actions">
            <button class="btn btn--accent" data-action="${entry.action}" data-id="${esc(item.id)}" type="button">${icon(isRelease ? 'calendar' : 'book')} ${esc(entry.cta)}</button>
            ${isRelease ? '' : `<button class="btn btn--ghost" data-action="quick-add" data-id="${esc(item.id)}" type="button">${icon('heart')} Wishlist</button>`}
          </div>
        </div>
      </article>`;
    }).join('');

    /* ----- accueil vierge ----- */
    const welcome = !items.length ? `<section class="welcome">
      <div class="welcome__copy">
        <span class="eyebrow">Bienvenue dans Bulle</span>
        <h2>Ta collection, enfin à ton image.</h2>
        <p>Un manga possédé, une BD empruntée, un tome que tu veux absolument ? Dis-le en un tap, note ce que tu aimes et garde une trace de tes lectures.</p>
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
          <span class="welcome__step-icon">${icon('calendar')}</span>
          <strong>Anticipe les sorties</strong>
          <span>Les prochains mangas et BD en français, et les suites de ta collection.</span>
        </div>
      </div>
    </section>` : '';

    /* ----- mes collections ----- */
    const collections = `<section class="home-collections">
      <div class="section-head">
        <div>
          <h2 class="section-title">Mes collections</h2>
          <p class="section-sub">Ta bibliothèque en un coup d’œil</p>
        </div>
        <button class="btn-link" data-action="goto-library" data-filter="all" type="button">Tout voir ${icon('arrow-right')}</button>
      </div>
      <div class="collection-grid">
        <button class="collection-card collection-card--owned" data-action="goto-library" data-filter="owned" type="button">
          <span class="collection-card__icon">${icon('library')}</span>
          <span class="collection-card__count">${fmtInt(owned.length)}</span>
          <span class="collection-card__label">Possédés</span>
          <span class="collection-card__hint">${fmtInt(stats.volumes)} ${plural(stats.volumes, 'tome')}</span>
        </button>
        <button class="collection-card collection-card--wish" data-action="goto-library" data-filter="wishlist" type="button">
          <span class="collection-card__icon">${icon('heart')}</span>
          <span class="collection-card__count">${fmtInt(wishlist.length)}</span>
          <span class="collection-card__label">Wishlist</span>
          <span class="collection-card__hint">${wishlist.length ? 'Envie de les lire' : 'Ajoute tes envies'}</span>
        </button>
        <button class="collection-card collection-card--reading" data-action="goto-library" data-filter="reading" type="button">
          <span class="collection-card__icon">${icon('book')}</span>
          <span class="collection-card__count">${fmtInt(reading.length)}</span>
          <span class="collection-card__label">En cours</span>
          <span class="collection-card__hint">${reading.length ? 'Reprendre la lecture' : 'Rien en cours'}</span>
        </button>
        <button class="collection-card collection-card--read" data-action="goto-library" data-filter="read" type="button">
          <span class="collection-card__icon">${icon('eye')}</span>
          <span class="collection-card__count">${fmtInt(items.filter((item) => item.readStatus === 'read').length)}</span>
          <span class="collection-card__label">Lus</span>
          <span class="collection-card__hint">${stats.averageRating ? fmtRating(stats.averageRating) + '/5 de moyenne' : 'Note tes lectures'}</span>
        </button>
      </div>
    </section>`;

    /* ----- rangées ----- */
    const rows = [];
    if (tab === 'releases') {
      if (upcoming.length) {
        rows.push({
          title: 'Toutes les prochaines sorties',
          subtitle: `${fmtInt(upcoming.length)} sorties françaises à venir`,
          items: upcoming.slice(0, 24),
          html: releaseCards(upcoming.slice(0, 24)),
          see: { action: 'goto-releases' }
        });
      }
    } else {
      rows.push(row(reading, 'Reprendre la lecture', 'Là où tu t’es arrêté', { action: 'goto-library', filter: 'reading' }));
      rows.push(row(owned, 'Ma librairie', `${fmtInt(owned.length)} ${plural(owned.length, 'titre')} · ${fmtInt(stats.volumes)} ${plural(stats.volumes, 'tome')}`, { action: 'goto-library', filter: 'owned' }));

      if (upcoming.length) {
        const filteredReleases = tab === 'manga'
          ? upcoming.filter((release) => release.kind === 'manga')
          : tab === 'bd'
            ? upcoming.filter((release) => release.kind === 'bd')
            : upcoming;
        const prioritized = B.groupReleaseEntries(filteredReleases).entries.slice().sort((a, b) => {
          const am = entryMatches(a);
          const bm = entryMatches(b);
          if (am !== bm) return am ? -1 : 1;
          return String(a.date).localeCompare(String(b.date));
        });
        if (prioritized.length) {
          rows.push({
            title: 'Nouveautés',
            subtitle: collectionKeys.size ? 'Les prochaines sorties, dont les suites de ta collection' : 'Les prochaines sorties françaises',
            items: prioritized.slice(0, 14),
            html: releaseCardsFromEntries(prioritized.slice(0, 14)),
            see: { action: 'goto-releases' }
          });
        }
      }

      if (wishlist.length) {
        rows.push(row(wishlist, 'Continuer ma liste', 'Tes envies, prêtes à rejoindre la librairie', { action: 'goto-library', filter: 'wishlist' }));
      } else {
        const suggestions = B.CATALOG.filter((item) => {
          const tracked = Store.get(item.id);
          return !tracked || (!tracked.owned && !tracked.wishlist);
        });
        const suggestionRow = row(suggestions, 'Continuer ma liste', 'Quelques idées pour commencer ta collection', {
          action: 'explore-kind',
          kind: tab === 'manga' ? 'manga' : tab === 'bd' ? 'bd' : 'all'
        });
        if (suggestionRow) rows.push(suggestionRow);
      }

      rows.push(row(favorites, 'Tes coups de cœur', 'Ta crème de la crème, notée 4 étoiles et plus', { action: 'goto-library', filter: 'read' }));
    }

    const seedIds = tab === 'manga'
      ? ['manga-tendances', 'manga-fantasy', 'manga-romance']
      : tab === 'bd'
        ? ['bd-franco', 'bd-comics', 'bd-graphic']
        : ['manga-tendances', 'bd-franco', 'manga-fantasy', 'bd-comics', 'bd-graphic', 'manga-romance'];
    seedIds.forEach((id) => {
      const seedRow = B.ROWS.find((entry) => entry.id === id);
      if (!seedRow || !seedRow.items.length) return;
      const filtered = inTab(seedRow.items);
      if (!filtered.length) return;
      const cards = cardsFor(filtered);
      rows.push({
        title: seedRow.title,
        subtitle: seedRow.subtitle,
        items: cards.items,
        html: cards.html,
        see: { action: 'explore-kind', kind: tab === 'all' ? seedRow.kind : tab }
      });
    });

    B.ui.home.bdGroups = homeGroups;

    const activeRows = rows.filter(Boolean);
    const displayName = Store.settings.name || 'Mon profil';
    const subtitle = Store.settings.name
      ? `Bonjour ${Store.settings.name} · ${fmtInt(stats.ownedCount)} ${plural(stats.ownedCount, 'titre')} possédé${stats.ownedCount > 1 ? 's' : ''}`
      : 'Ta collection, tes envies, tes prochaines lectures.';

    const tabButton = (id, label, iconName) => `<button class="home-tab ${tab === id ? 'is-active' : ''}" data-action="home-tab" data-tab="${id}" type="button" aria-pressed="${tab === id}">${icon(iconName)} ${esc(label)}</button>`;

    return `<section class="home">
      <header class="home-head">
        <a class="home-user" href="#/settings" aria-label="Ouvrir mes réglages">
          <span class="home-user__avatar">${esc(B.initials(Store.settings.name || 'Bulle'))}</span>
          <span class="home-user__text">
            <strong>${esc(displayName)}</strong>
            <small>${fmtInt(stats.ownedCount)} possédés · ${fmtInt(stats.wishlistCount)} envies</small>
          </span>
        </a>
        <div class="home-head__actions">
          <button class="icon-btn" data-action="focus-search" type="button" aria-label="Rechercher">${icon('search')}</button>
          <button class="icon-btn" data-action="toggle-theme" type="button" aria-label="Changer de thème">${icon(Store.settings.theme === 'light' ? 'sun' : 'moon', 'icon icon-theme')}</button>
        </div>
      </header>

      <div class="home-title">
        <span class="eyebrow">Bulle</span>
        <h1>Ma Bibliothèque</h1>
        <p>${esc(subtitle)}</p>
      </div>

      <nav class="home-tabs" aria-label="Filtrer l’accueil">
        ${tabButton('all', 'Pour toi', 'sparkles')}
        ${tabButton('manga', 'Mangas', 'book')}
        ${tabButton('bd', 'BD', 'layers')}
        ${tabButton('releases', 'Sorties', 'calendar')}
      </nav>

      ${heroSlides ? `<div class="rail-wrap hero-carousel">
        <button class="rail__arrow rail__arrow--prev" data-action="rail" data-dir="-1" type="button" aria-label="Sortie précédente">${icon('arrow-left')}</button>
        <div class="rail hero-rail">${heroSlides}</div>
        <button class="rail__arrow rail__arrow--next" data-action="rail" data-dir="1" type="button" aria-label="Sortie suivante">${icon('arrow-right')}</button>
      </div>` : ''}

      ${welcome}
      ${collections}
      <div class="rows">${activeRows.map((entry) => B.rowHTML(entry)).join('')}</div>
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
      data-action="set-explore-kind" data-kind="${kind}" type="button" aria-pressed="${e.kind === kind}">${esc(label)}</button>`;

    return `<section class="page">
      <div class="explore-head">
        <div>
          <span class="eyebrow">Catalogue</span>
          <h1 class="page-title">Explorer</h1>
          <p class="page-sub">Des milliers de mangas et de BD, avec leurs couvertures. Cherche, découvre, puis garde ce qui te plaît.</p>
        </div>
        <div class="segmented" role="group" aria-label="Type de titre">
          ${segment('all', 'Tout')}
          ${segment('manga', 'Mangas')}
          ${segment('bd', 'BD & comics')}
        </div>
      </div>

      <div class="explore-tools explore-tools--sort">
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

    function cardsGrid(list) {
      const grouped = B.groupCollectionEntries(list, 2);
      B.ui.explore.bdGroups = grouped.groups;
      const isOwned = (item) => {
        const trackedItem = Store.get(item.id);
        return Boolean((trackedItem && trackedItem.owned) || item.owned);
      };
      return `<div class="grid grid--posters">${grouped.entries.map((entry) => entry.type === 'group'
        ? B.seriesCard(entry.group, { inCollection: entry.group.items.some(isOwned) })
        : B.posterCard(entry.item)).join('')}</div>`;
    }

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
        ${shown.length ? cardsGrid(shown) : emptyState({
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
      content = cardsGrid(shown);
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
