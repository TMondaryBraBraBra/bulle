/* =========================================================
   BULLE — écran : prochaines sorties françaises
   ========================================================= */
(function () {
  'use strict';
  const S = window.Screens = window.Screens || {};

  function releaseCardFor(entry, collectionKeys) {
    const B = window.B;
    if (entry.type === 'group') {
      const inCollection = entry.group.items.some((item) => {
        const release = B.findRelease(item.id);
        return release ? B.releaseMatchesCollection(release, collectionKeys) : false;
      });
      return B.seriesCard(entry.group, { inCollection });
    }
    return B.releaseCard(entry.release);
  }

  S.releases = function releases() {
    const B = window.B;
    const { esc, icon, fmtInt, plural, releaseMonthLabel } = B;
    const r = B.ui.releases;
    const all = B.upcomingReleases();
    const collectionKeys = B.collectionSeriesKeys();
    const months = Array.from(new Set(all.map((release) => String(release.date).slice(0, 7)))).sort();

    if (r.month !== 'all' && !months.includes(r.month)) r.month = 'all';

    let items = all;
    if (r.kind !== 'all') items = items.filter((release) => release.kind === r.kind);
    if (r.month !== 'all') items = items.filter((release) => String(release.date).startsWith(r.month));
    if (r.collectionOnly) items = items.filter((release) => B.releaseMatchesCollection(release, collectionKeys));

    const bdItems = items.filter((release) => release.kind === 'bd').map((release) => B.releaseToItem(release));
    const groups = B.groupBdSeries(bdItems);
    B.ui.releases.bdGroups = groups;

    const groupByItem = new Map();
    groups.filter((group) => group.count > 1).forEach((group) => group.items.forEach((item) => groupByItem.set(item.id, group)));

    const entries = [];
    const seenGroups = new Set();
    items.forEach((release) => {
      if (release.kind === 'bd') {
        const group = groupByItem.get(release.id);
        if (group) {
          if (seenGroups.has(group.key)) return;
          seenGroups.add(group.key);
          entries.push({ type: 'group', date: group.nextDate || release.date, group });
        } else {
          entries.push({ type: 'release', date: release.date, release });
        }
      } else {
        entries.push({ type: 'release', date: release.date, release });
      }
    });

    entries.sort((a, b) => {
      const byDate = String(a.date).localeCompare(String(b.date));
      if (byDate) return byDate;
      const titleA = a.type === 'group' ? a.group.series : a.release.series;
      const titleB = b.type === 'group' ? b.group.series : b.release.series;
      return String(titleA || '').localeCompare(String(titleB || ''), 'fr');
    });

    const shown = entries.slice(0, r.limit);
    const sections = new Map();
    shown.forEach((entry) => {
      const month = String(entry.date || '').slice(0, 7) || 'unknown';
      if (!sections.has(month)) sections.set(month, []);
      sections.get(month).push(entry);
    });

    const content = sections.size
      ? Array.from(sections.entries()).map(([month, monthEntries]) => {
        const albumCount = monthEntries.reduce((sum, entry) => sum + (entry.type === 'group' ? entry.group.count : 1), 0);
        return `<section class="release-month">
          <div class="release-month__head">
            <h2>${esc(month === 'unknown' ? 'Date à confirmer' : releaseMonthLabel(month + '-01'))}</h2>
            <span>${fmtInt(albumCount)} ${plural(albumCount, 'sortie')}</span>
          </div>
          <div class="grid grid--posters">${monthEntries.map((entry) => releaseCardFor(entry, collectionKeys)).join('')}</div>
        </section>`;
      }).join('')
      : S.emptyState({
        icon: 'calendar',
        title: all.length ? 'Aucune sortie dans ce filtre' : 'Le calendrier arrive bientôt',
        text: all.length
          ? 'Change de mois, de catégorie ou désactive le filtre « suites de ma collection ».'
          : 'Le calendrier des sorties françaises n’a pas encore été chargé. Recharge l’application pour réessayer.',
        actions: all.length
          ? `<button class="btn" data-action="release-reset" type="button">Tout afficher</button>`
          : `<button class="btn btn--accent" data-action="reload-app" type="button">Recharger</button>`
      });

    const kindButton = (kind, label) => `<button class="segmented__btn ${r.kind === kind ? 'is-active' : ''}"
      data-action="release-kind" data-kind="${kind}" type="button" aria-pressed="${r.kind === kind}">${esc(label)}</button>`;

    const monthOptions = ['<option value="all">Tous les mois</option>']
      .concat(months.map((month) => `<option value="${month}" ${r.month === month ? 'selected' : ''}>${esc(releaseMonthLabel(month + '-01'))}</option>`))
      .join('');

    const mangaCount = items.filter((release) => release.kind === 'manga').length;
    const bdCount = items.filter((release) => release.kind === 'bd').length;
    const generated = window.RELEASES && window.RELEASES.generated
      ? new Date(window.RELEASES.generated + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    return `<section class="page releases-page">
      <div class="page__head releases-head">
        <div>
          <span class="eyebrow">Calendrier français</span>
          <h1 class="page-title">Prochaines sorties</h1>
          <p class="page-sub">Les mangas et les BD qui arrivent en France. Repère les suites de ta collection, ajoute-les à ta wishlist et garde une longueur d’avance.</p>
        </div>
        ${generated ? `<div class="release-freshness">${icon('refresh')}<span>Calendrier mis à jour le ${esc(generated)}</span></div>` : ''}
      </div>

      <div class="releases-toolbar">
        <div class="segmented" role="group" aria-label="Type de sortie">
          ${kindButton('all', 'Tout')}
          ${kindButton('manga', 'Mangas')}
          ${kindButton('bd', 'BD')}
        </div>
        <select class="select" id="release-month" aria-label="Filtrer par mois">${monthOptions}</select>
        <button class="chip chip--toggle ${r.collectionOnly ? 'is-active' : ''}" data-action="release-collection" type="button" aria-pressed="${r.collectionOnly}">
          ${icon('sparkles')} Suites de ma collection
        </button>
      </div>

      <div class="release-summary">
        <span><strong>${fmtInt(items.length)}</strong> ${plural(items.length, 'sortie')}</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(mangaCount)}</strong> mangas</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(bdCount)}</strong> BD</span>
        <span class="dot"></span>
        <span><strong>${fmtInt(groups.length)}</strong> ${plural(groups.length, 'série')} BD</span>
      </div>

      <div class="releases-content">${content}</div>

      ${entries.length > shown.length ? `<div class="load-more-wrap"><button class="btn" data-action="load-more-releases" type="button">Afficher plus de sorties</button></div>` : ''}

      <footer class="home-foot">
        <span>${icon('info')} Calendrier indicatif : les dates peuvent bouger chez les éditeurs.</span>
        <a href="#/settings">Gérer mes données</a>
      </footer>
    </section>`;
  };
})();
