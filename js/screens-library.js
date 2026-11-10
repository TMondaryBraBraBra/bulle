/* =========================================================
   BULLE — écrans : librairie + statistiques
   ========================================================= */
(function () {
  'use strict';
  const S = window.Screens = window.Screens || {};

  /* ============================ LIBRARY ============================ */
  S.library = function library() {
    const B = window.B;
    const { esc, icon, fmtInt, fmtRating, plural } = B;
    const Store = window.Store;
    const items = Store.all();
    const owned = items.filter((item) => item.owned);

    if (!items.length) {
      return `<section class="page">
        <div class="page__head">
          <div>
            <span class="eyebrow">Collection</span>
            <h1 class="page-title">Ma librairie</h1>
            <p class="page-sub">Tout ce que tu possèdes, veux, lis et abandonnes — au même endroit.</p>
          </div>
        </div>
        ${S.emptyState({
          icon: 'library',
          title: 'Ta librairie est encore vide',
          text: 'Cherche un manga ou une BD, ouvre sa fiche et marque-le comme possédé, à lire ou en wishlist. Tout reste sur ton téléphone.',
          actions: `<button class="btn btn--accent" data-action="explore-kind" data-kind="all" type="button">${B.icon('compass')} Explorer le catalogue</button>
            <button class="btn" data-action="load-demo" type="button">${B.icon('sparkles')} Charger des exemples</button>`
        })}
      </section>`;
    }

    const counts = {
      all: items.length,
      owned: owned.length,
      unread: items.filter((item) => item.owned && item.readStatus === 'unread').length,
      reading: items.filter((item) => item.readStatus === 'reading').length,
      read: items.filter((item) => item.readStatus === 'read').length,
      wishlist: items.filter((item) => item.wishlist).length,
      dropped: items.filter((item) => item.readStatus === 'dropped').length
    };

    const filters = [
      ['all', 'Tout'],
      ['owned', 'Possédés'],
      ['unread', 'À lire'],
      ['reading', 'En cours'],
      ['read', 'Lus'],
      ['wishlist', 'Wishlist'],
      ['dropped', 'Abandonnés']
    ];

    const matches = {
      all: () => true,
      owned: (item) => item.owned,
      unread: (item) => item.owned && item.readStatus === 'unread',
      reading: (item) => item.readStatus === 'reading',
      read: (item) => item.readStatus === 'read',
      wishlist: (item) => item.wishlist,
      dropped: (item) => item.readStatus === 'dropped'
    };

    const status = matches[B.ui.library.status] ? B.ui.library.status : 'all';
    const kind = B.ui.library.kind;
    const sort = B.ui.library.sort;
    const view = B.ui.library.view;

    let filtered = items.filter(matches[status]);
    if (kind !== 'all') filtered = filtered.filter((item) => item.kind === kind);

    const sorters = {
      recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      title: (a, b) => String(a.title).localeCompare(String(b.title), 'fr'),
      rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
      year: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)
    };
    filtered = filtered.slice().sort(sorters[sort] || sorters.recent);

    const volumes = owned.reduce((sum, item) => sum + Store.ownedVolumeCount(item), 0);
    const readingCount = items.filter((item) => item.readStatus === 'reading').length;

    const filterChips = filters.map(([id, label]) => {
      const count = counts[id] || 0;
      return `<button class="chip ${status === id ? 'is-active' : ''}" data-action="lib-filter" data-filter="${id}" type="button">
        ${esc(label)} <span class="count">${count}</span>
      </button>`;
    }).join('');

    const kindSegment = (id, label) => `<button class="segmented__btn ${kind === id ? 'is-active' : ''}"
      data-action="lib-kind" data-kind="${id}" type="button">${esc(label)}</button>`;

    const viewButton = (id, iconName, label) => `<button class="segmented__btn ${view === id ? 'is-active' : ''}"
      data-action="lib-view" data-view="${id}" type="button" aria-label="${label}" title="${label}">${icon(iconName)}</button>`;

    const grouped = B.groupCollectionEntries(filtered, 2);
    B.ui.library.bdGroups = grouped.groups;
    const body = filtered.length
      ? (view === 'grid'
        ? `<div class="grid grid--posters">${grouped.entries.map((entry) => entry.type === 'group'
          ? B.seriesCard(entry.group, { inCollection: entry.group.items.some((item) => item.owned) })
          : B.posterCard(entry.item)).join('')}</div>`
        : `<div class="liblist">${filtered.map((item) => libRow(item)).join('')}</div>`)
      : S.emptyState({
        icon: 'filter',
        title: 'Aucun titre dans ce filtre',
        text: 'Change de filtre ou affiche toute ta collection.',
        actions: '<button class="btn" data-action="lib-filter" data-filter="all" type="button">Tout afficher</button>'
      });

    return `<section class="page">
      <div class="page__head">
        <div>
          <span class="eyebrow">Collection</span>
          <h1 class="page-title">Ma librairie</h1>
          <p class="page-sub">${fmtInt(items.length)} ${plural(items.length, 'titre')} suivi${items.length > 1 ? 's' : ''} · ${fmtInt(owned.length)} possédé${owned.length > 1 ? 's' : ''} · ${fmtInt(volumes)} ${plural(volumes, 'tome')}.</p>
        </div>
      </div>

      <div class="library-summary">
        <span><strong>${fmtInt(volumes)}</strong> tomes</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(readingCount)}</strong> en cours</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(items.filter((item) => item.readStatus === 'read').length)}</strong> lus</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(counts.wishlist)}</strong> en wishlist</span>
      </div>

      <div class="chips" role="group" aria-label="Filtrer la librairie">${filterChips}</div>

      <div class="explore-tools">
        <div class="segmented" aria-label="Type de titre">
          ${kindSegment('all', 'Tout')}
          ${kindSegment('manga', 'Mangas')}
          ${kindSegment('bd', 'BD & comics')}
        </div>
        <select class="select" id="library-sort" aria-label="Trier la librairie">
          <option value="recent" ${sort === 'recent' ? 'selected' : ''}>Ajout récent</option>
          <option value="title" ${sort === 'title' ? 'selected' : ''}>Titre A → Z</option>
          <option value="rating" ${sort === 'rating' ? 'selected' : ''}>Meilleures notes</option>
          <option value="year" ${sort === 'year' ? 'selected' : ''}>Année</option>
        </select>
        <div class="segmented segmented--view" role="group" aria-label="Affichage">
          ${viewButton('grid', 'grid', 'Affichage en grille')}
          ${viewButton('list', 'list', 'Affichage en liste')}
        </div>
      </div>

      ${body}
    </section>`;

    function libRow(item) {
      const rating = Number(item.rating) || 0;
      const tags = [];
      if (item.owned) tags.push(`<span class="mini-tag mini-tag--owned">${icon('check')} Possédé</span>`);
      if (item.wishlist) tags.push(`<span class="mini-tag mini-tag--wish">${icon('heart')} Wishlist</span>`);
      if (item.readStatus === 'reading') tags.push(`<span class="mini-tag mini-tag--reading">${icon('book')} En cours</span>`);
      else if (item.readStatus === 'read') tags.push(`<span class="mini-tag mini-tag--read">${icon('check')} Lu</span>`);
      else if (item.readStatus === 'dropped') tags.push(`<span class="mini-tag">${icon('x')} Abandonné</span>`);

      const meta = [
        B.kindLabel(item),
        item.author || '',
        B.volumeProgress(item)
      ].filter(Boolean);

      return `<button class="lib-row" data-action="open-item" data-id="${esc(item.id)}" type="button">
        <span class="lib-row__cover">${B.coverHTML(item)}</span>
        <span class="lib-row__main">
          <span class="lib-row__title">${esc(item.title)}</span>
          <span class="lib-row__meta">${meta.map((part) => esc(part)).join('<span class="dot"> · </span>')}</span>
          ${tags.length ? `<span class="lib-row__tags">${tags.join('')}</span>` : ''}
        </span>
        <span class="lib-row__side">
          ${rating > 0 ? `<span class="lib-row__rating">${icon('star')}${fmtRating(rating)}</span>` : ''}
          <span class="lib-row__chev">${icon('chevron-right')}</span>
        </span>
      </button>`;
    }
  };

  /* ============================ STATS ============================ */
  S.stats = function stats() {
    const B = window.B;
    const { esc, icon, fmtInt, fmtRating, plural } = B;
    const Store = window.Store;
    const s = Store.stats();

    if (!s.series) {
      return `<section class="page">
        <div class="page__head">
          <div>
            <span class="eyebrow">Bilan</span>
            <h1 class="page-title">Tes statistiques</h1>
            <p class="page-sub">Ta collection, en chiffres. Dès que tu ajoutes un titre, ça se remplit tout seul.</p>
          </div>
        </div>
        ${S.emptyState({
          icon: 'chart',
          title: 'Pas encore de chiffres',
          text: 'Ajoute quelques mangas ou BD à ta librairie pour voir ta répartition, tes notes et tes genres favoris.',
          actions: `<button class="btn btn--accent" data-action="explore-kind" data-kind="all" type="button">${icon('compass')} Explorer</button>
            <button class="btn" data-action="load-demo" type="button">${icon('sparkles')} Charger des exemples</button>`
        })}
      </section>`;
    }

    const owned = s.ownedCount;
    const readPct = owned ? Math.round((s.ownedRead / owned) * 100) : 0;
    const kindsTotal = s.kindSplit.manga + s.kindSplit.bd;
    const mangaPct = kindsTotal ? Math.round((s.kindSplit.manga / kindsTotal) * 100) : 50;
    const maxRating = Math.max(1, ...s.ratingDist.map((entry) => entry.count));
    const maxGenre = Math.max(1, ...s.genres.map((entry) => entry.count));

    const card = (label, value, hint, iconName, extraClass) => `<div class="stat-card ${extraClass || ''}">
      <div class="stat-card__label">${icon(iconName)} ${esc(label)}</div>
      <div class="stat-card__value">${value}</div>
      <div class="stat-card__hint">${hint}</div>
    </div>`;

    const ratingBars = s.ratingDist.map((entry) => {
      const height = Math.max(3, Math.round((entry.count / maxRating) * 100));
      return `<div class="rating-bar" title="${entry.count} ${plural(entry.count, 'titre')} noté${entry.count > 1 ? 's' : ''} ${entry.star}/5">
        <div class="rating-bar__fill" style="height:${height}%"></div>
        <span>${entry.star}★</span>
      </div>`;
    }).join('');

    const genreBars = s.genres.length ? s.genres.map((entry) => `
      <div class="bar">
        <div class="bar__head"><span>${esc(entry.name)}</span><strong>${entry.count} ${plural(entry.count, 'titre')}</strong></div>
        <div class="bar__track"><div class="bar__fill" style="width:${Math.round((entry.count / maxGenre) * 100)}%"></div></div>
      </div>`).join('') : `<p class="panel__sub">Ajoute des genres en possédant tes premiers titres.</p>`;

    const topFive = s.topRated.length ? s.topRated.map((item) => `
      <button class="top-rated__item" data-action="open-item" data-id="${esc(item.id)}" type="button">
        <span class="top-rated__cover">${B.coverHTML(item)}</span>
        <span class="top-rated__name">${esc(item.title)}</span>
        <span class="top-rated__score">${icon('star')} ${fmtRating(item.rating)}</span>
      </button>`).join('') : `<p class="panel__sub">Note tes titres pour voir ton top 5 apparaître ici.</p>`;

    return `<section class="page">
      <div class="page__head">
        <div>
          <span class="eyebrow">Bilan</span>
          <h1 class="page-title">Tes statistiques</h1>
          <p class="page-sub">${fmtInt(owned)} ${plural(owned, 'série')} possédée${owned > 1 ? 's' : ''}, ${fmtInt(s.volumes)} ${plural(s.volumes, 'tome')}, ${fmtInt(s.readCount)} ${plural(s.readCount, 'titre')} lu${s.readCount > 1 ? 's' : ''}.</p>
        </div>
      </div>

      <div class="stat-grid">
        ${card('Possédés', fmtInt(owned), `${fmtInt(s.series)} titres suivis`, 'library')}
        ${card('Tomes', fmtInt(s.volumes), `${fmtInt(owned)} ${plural(owned, 'série')}`, 'layers')}
        ${card('Lus', fmtInt(s.ownedRead), `${readPct}% de ta librairie`, 'eye')}
        ${card('Wishlist', fmtInt(s.wishlistCount), `${fmtInt(s.droppedCount)} ${plural(s.droppedCount, 'abandon')}`, 'heart')}
        ${card('En cours', fmtInt(s.readingCount), 'lectures en cours', 'book')}
        ${card('Notes', s.ratedCount ? fmtRating(s.averageRating) + '/5' : '—', `${fmtInt(s.ratedCount)} ${plural(s.ratedCount, 'titre')} noté${s.ratedCount > 1 ? 's' : ''}`, 'star', 'stat-card--accent')}
      </div>

      <div class="panels">
        <div class="panel">
          <div class="panel__title">Manga ou BD ?</div>
          <p class="panel__sub">Répartition de tes séries possédées</p>
          <div class="split-panel">
            <div class="donut" style="--a:${mangaPct}%; --color-a:var(--accent); --color-b:var(--violet)">
              <div class="donut__center"><strong>${fmtInt(owned)}</strong><span>séries</span></div>
            </div>
            <div class="legend">
              <div class="legend__item"><span class="legend__swatch"></span> Mangas <strong>${fmtInt(s.kindSplit.manga)} · ${mangaPct}%</strong></div>
              <div class="legend__item"><span class="legend__swatch legend__swatch--b"></span> BD & comics <strong>${fmtInt(s.kindSplit.bd)} · ${100 - mangaPct}%</strong></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__title">Tes notes</div>
          <p class="panel__sub">${s.ratedCount ? fmtInt(s.ratedCount) + ' ' + plural(s.ratedCount, 'titre') + ' noté' + (s.ratedCount > 1 ? 's' : '') : 'Aucune note pour le moment'}</p>
          <div style="display:flex;align-items:baseline;gap:7px;margin-top:14px">
            <span style="font-size:40px;font-weight:850;letter-spacing:-0.05em;line-height:1">${s.averageRating ? fmtRating(s.averageRating) : '—'}</span>
            <span style="color:var(--muted-2);font-size:12px;font-weight:650">/ 5</span>
            <span style="margin-left:auto">${B.starsHTML(s.averageRating)}</span>
          </div>
          <div class="rating-bars">${ratingBars}</div>
        </div>

        <div class="panel">
          <div class="panel__title">Genres favoris</div>
          <p class="panel__sub">Ce qui revient le plus dans ta librairie</p>
          <div class="bars">${genreBars}</div>
        </div>

        <div class="panel">
          <div class="panel__title">Tes 5 meilleurs</div>
          <p class="panel__sub">Classés par ta note</p>
          <div class="top-rated">${topFive}</div>
        </div>
      </div>
    </section>`;
  };
})();
