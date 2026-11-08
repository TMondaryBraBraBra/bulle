/* =========================================================
   BULLE — fiche détaillée (sheet)
   ========================================================= */
(function () {
  'use strict';

  let current = null;
  let tracked = false;
  let notesTimer = null;
  let pendingNotes = null;

  function inputNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value).replace('.', ',');
  }

  function parseDecimal(raw) {
    const cleaned = String(raw || '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  function parseVolume(raw) {
    if (String(raw).trim() === '') return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  function userFor(item) {
    return { ...window.Store.DEFAULTS, ...(window.Store.get(item.id) || {}) };
  }

  function meaningful(item) {
    if (!item) return false;
    return Boolean(
      item.owned ||
      item.wishlist ||
      item.readStatus !== 'unread' ||
      Number(item.rating) > 0 ||
      (item.notes && item.notes.trim()) ||
      Number(item.price) > 0 ||
      Number(item.salePrice) > 0 ||
      Number(item.volumesOwned) > 0 ||
      item.condition
    );
  }

  function html(item) {
    const B = window.B;
    const Store = window.Store;
    const { esc, icon, fmtEUR, fmtRating, fmtDate, plural } = B;
    const user = userFor(item);
    const isTracked = Store.has(item.id);
    const rating = Number(user.rating) || 0;
    const bg = item.banner || item.cover || '';
    const total = Number(item.volumes);
    const volumesOwned = Number(user.volumesOwned) || 0;

    const meta = [
      item.year ? String(item.year) : '',
      total ? total + ' ' + plural(total, 'tome') : '',
      item.chapters ? item.chapters + ' chapitres' : '',
      item.score ? item.score + '/100 sur ' + B.sourceLabel(item) : ''
    ].filter(Boolean);

    const badges = [`<span class="badge badge--soft">${esc(B.kindLabel(item))}</span>`];
    if (user.owned) badges.push(`<span class="badge badge--accent">${icon('check')} Possédé</span>`);
    if (user.wishlist) badges.push(`<span class="badge" style="color:var(--violet);background:var(--violet-soft);border-color:transparent">${icon('heart')} Wishlist</span>`);
    if (user.readStatus === 'read') badges.push(`<span class="badge" style="color:var(--green);background:var(--green-soft);border-color:transparent">${icon('eye')} Lu</span>`);

    const conditionOptions = ['<option value="">Non précisé</option>']
      .concat(Store.CONDITIONS.map((condition) => `<option value="${esc(condition)}" ${user.condition === condition ? 'selected' : ''}>${esc(condition)}</option>`))
      .join('');

    const statusOptions = [
      ['unread', 'À lire'],
      ['reading', 'En cours de lecture'],
      ['read', 'Lu'],
      ['dropped', 'Abandonné']
    ].map(([value, label]) => `<option value="${value}" ${user.readStatus === value ? 'selected' : ''}>${label}</option>`).join('');

    const sourceUrl = item.siteUrl || '';
    const source = B.sourceLabel(item);

    return `<div class="sheet-backdrop" data-action="backdrop-close">
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
        <div class="sheet__scroll">
          <div class="sheet__hero">
            <button class="icon-btn sheet__close" data-action="close-sheet" type="button" aria-label="Fermer la fiche">${icon('x')}</button>
            <div class="sheet__bg">${bg ? `<img src="${esc(bg)}" alt="" referrerpolicy="no-referrer">` : ''}</div>
            <div class="sheet__head">
              <div class="sheet__cover">${B.coverHTML(item, { eager: true })}</div>
              <div class="sheet__info">
                <div class="sheet__kind">${badges.join('')}</div>
                <h2 class="sheet__title" id="sheet-title">${esc(item.title)}</h2>
                ${item.author ? `<p class="sheet__author">${esc(item.author)}</p>` : ''}
                <div class="sheet__meta">
                  ${meta.map((part, index) => `${index ? '<span class="dot"></span>' : ''}<span>${esc(part)}</span>`).join('')}
                </div>
                ${(item.genres || []).length ? `<div class="sheet__genres">${item.genres.slice(0, 5).map((genre) => `<span class="sheet__genre">${esc(genre)}</span>`).join('')}</div>` : ''}
                <p class="sheet__desc">${esc(item.description || 'Pas encore de synopsis pour ce titre. Tu peux quand même le ranger dans ta librairie, le noter et garder tes impressions.')}</p>
                ${sourceUrl ? `<a class="sheet__source" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Voir la fiche sur ${esc(source)} ${icon('external')}</a>` : ''}
              </div>
            </div>
          </div>

          <div class="sheet__body">
            <div class="sheet__col">
              <div class="sheet__section">
                <div class="sheet__section-title">${icon('library')} Ma collection</div>
                <div class="toggle-grid">
                  <button class="toggle ${user.owned ? 'is-on' : ''}" data-sheet-toggle="owned" aria-pressed="${user.owned}" type="button">
                    ${icon('check')}<span>Possédé</span><small>${user.owned ? 'Dans ta librairie' : 'Pas encore'}</small>
                  </button>
                  <button class="toggle toggle--wish ${user.wishlist ? 'is-on' : ''}" data-sheet-toggle="wishlist" aria-pressed="${user.wishlist}" type="button">
                    ${icon('heart')}<span>Wishlist</span><small>${user.wishlist ? 'Tu le veux' : 'Ajouter une envie'}</small>
                  </button>
                  <button class="toggle toggle--read ${user.readStatus === 'read' ? 'is-on' : ''}" data-sheet-toggle="read" aria-pressed="${user.readStatus === 'read'}" type="button">
                    ${icon('eye')}<span>Lu</span><small>${user.readStatus === 'read' ? 'Lecture terminée' : 'Pas encore lu'}</small>
                  </button>
                </div>
                <div class="status-select">
                  <select class="select" id="sheet-status" data-sheet-select="readStatus" aria-label="Statut de lecture">
                    ${statusOptions}
                  </select>
                </div>
              </div>

              <div class="sheet__section">
                <div class="sheet__section-title">${icon('star')} Ma note</div>
                <div style="display:flex;align-items:center;flex-wrap:wrap">
                  ${B.starsHTML(rating, { interactive: true })}
                  <span class="rating-value" id="sheet-rating-value">${rating ? fmtRating(rating) : '—'}<small>/5</small></span>
                </div>
                <p class="rating-hint">Clique à gauche d’une étoile pour une demi-note. Re-clique sur la même note pour l’effacer.</p>
              </div>

              <div class="sheet__section">
                <div class="sheet__section-title">${icon('pencil')} Mes notes</div>
                <textarea class="textarea sheet__notes" id="sheet-notes" data-sheet-notes maxlength="2000"
                  placeholder="Où l’as-tu acheté, ce que tu en penses, à qui tu veux le prêter…">${esc(user.notes)}</textarea>
                <div class="note-meta"><span id="notes-count">${(user.notes || '').length}/2000</span><span>Enregistré sur ton téléphone</span></div>
              </div>
            </div>

            <div class="sheet__col">
              <div class="sheet__section">
                <div class="sheet__section-title">${icon('euro')} Achat & revente</div>
                <div class="price-grid">
                  <div class="field">
                    <label for="sheet-price">Prix d’achat</label>
                    <div class="input-with-unit">
                      <input class="input" id="sheet-price" data-sheet-field="price" inputmode="decimal" value="${inputNumber(user.price)}" placeholder="0,00">
                      <span class="input-with-unit__unit">€</span>
                    </div>
                  </div>
                  <div class="field">
                    <label for="sheet-sale">Revente estimée</label>
                    <div class="input-with-unit">
                      <input class="input" id="sheet-sale" data-sheet-field="salePrice" inputmode="decimal" value="${inputNumber(user.salePrice)}" placeholder="0,00">
                      <span class="input-with-unit__unit">€</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="sheet__section">
                <div class="sheet__section-title">${icon('layers')} Mon exemplaire</div>
                <div class="price-grid">
                  <div class="field">
                    <label for="sheet-volumes">Tomes possédés</label>
                    <div class="input-with-unit">
                      <input class="input" id="sheet-volumes" data-sheet-field="volumesOwned" inputmode="numeric" type="number" min="0" step="1"
                        value="${volumesOwned || ''}" placeholder="${user.owned ? '1' : '0'}">
                      <span class="input-with-unit__unit input-with-unit__unit--wide">${total ? '/ ' + total : 'tomes'}</span>
                    </div>
                  </div>
                  <div class="field">
                    <label for="sheet-condition">État</label>
                    <select class="select" id="sheet-condition" data-sheet-field="condition" style="width:100%">${conditionOptions}</select>
                  </div>
                </div>
                <div class="autosave" id="sheet-autosave"><span class="dot"></span>${isTracked ? 'Enregistré automatiquement' : 'Rien n’est encore enregistré'}</div>
                ${isTracked && user.addedAt ? `<p class="sheet-note">Ajouté à ta librairie le ${fmtDate(user.addedAt)}</p>` : ''}
              </div>

              <div class="sheet__section">
                <div class="sheet__section-title">${icon('shield')} En local</div>
                <p class="sheet-note" style="line-height:1.6">Tes notes, prix et statuts restent dans le stockage de l’application. Aucune synchronisation, aucun compte. Pense à exporter ta collection de temps en temps.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="sheet__footer">
          <div class="sheet__footer-left">
            <button class="btn btn--danger btn--small" data-action="remove-item" type="button" ${isTracked ? '' : 'hidden'}>${icon('trash')} Retirer</button>
          </div>
          <div class="sheet__footer-actions">
            <span class="sheet-note" id="sheet-save-note">${isTracked ? 'Sauvegardé sur ton téléphone' : 'Aucune donnée envoyée'}</span>
            <button class="btn btn--accent" data-action="close-sheet" type="button">Terminé</button>
          </div>
        </div>
      </section>
    </div>`;
  }

  function markSaved() {
    const B = window.B;
    tracked = true;
    const remove = B.$('[data-action="remove-item"]');
    if (remove) remove.hidden = false;
    const autosave = B.$('#sheet-autosave');
    if (autosave) {
      autosave.innerHTML = '<span class="dot"></span>Enregistré automatiquement';
      autosave.classList.add('is-saving');
      setTimeout(() => autosave.classList.remove('is-saving'), 500);
    }
    const note = B.$('#sheet-save-note');
    if (note) note.textContent = 'Sauvegardé sur ton téléphone';
  }

  function flushNotes() {
    clearTimeout(notesTimer);
    if (pendingNotes === null || !current) return;
    const value = pendingNotes;
    pendingNotes = null;
    const saved = window.Store.track(current, { notes: value });
    current = saved;
    markSaved();
  }

  function open(item) {
    if (!item) return;
    const B = window.B;
    const overlay = B.$('#overlay-root');
    const alreadyOpen = document.body.classList.contains('sheet-open');
    const stored = window.Store.get(item.id);
    current = stored || item;
    tracked = Boolean(stored);
    pendingNotes = null;
    clearTimeout(notesTimer);
    overlay.innerHTML = html(current);
    document.body.classList.add('sheet-open');
    if (!alreadyOpen) history.pushState({ bulleSheet: true }, '');
    setTimeout(() => {
      const sheet = B.$('.sheet');
      if (sheet) sheet.focus({ preventScroll: true });
    }, 40);
  }

  function refresh(focusSelector) {
    if (!current) return;
    const B = window.B;
    flushNotes();
    const scroller = B.$('.sheet__scroll');
    const top = scroller ? scroller.scrollTop : 0;
    B.$('#overlay-root').innerHTML = html(current);
    const nextScroller = B.$('.sheet__scroll');
    if (nextScroller) nextScroller.scrollTop = top;
    if (focusSelector) {
      const target = B.$(focusSelector);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function finishClose() {
    const B = window.B;
    B.$('#overlay-root').innerHTML = '';
    document.body.classList.remove('sheet-open');
    current = null;
    tracked = false;
    if (window.App && typeof window.App.renderCurrentScreen === 'function') {
      window.App.renderCurrentScreen({ preserveScroll: true });
    }
  }

  function close(viaHistory) {
    if (!document.body.classList.contains('sheet-open')) return;
    const B = window.B;
    if (current) {
      flushNotes();
      const stored = window.Store.get(current.id);
      if (stored && !meaningful(stored)) window.Store.remove(stored.id);
    }
    const shouldGoBack = !viaHistory && history.state && history.state.bulleSheet;
    current = null;
    if (shouldGoBack) {
      history.back();
      return;
    }
    finishClose();
  }

  function toggle(flag) {
    if (!current) return;
    const B = window.B;
    flushNotes();
    const user = userFor(current);
    const patch = {};

    if (flag === 'owned') {
      patch.owned = !user.owned;
      if (patch.owned && !(Number(user.volumesOwned) > 0)) patch.volumesOwned = 1;
    } else if (flag === 'wishlist') {
      patch.wishlist = !user.wishlist;
    } else if (flag === 'read') {
      patch.readStatus = user.readStatus === 'read' ? 'unread' : 'read';
    } else {
      return;
    }

    const saved = window.Store.track(current, patch);
    current = saved;
    tracked = true;
    refresh(`[data-sheet-toggle="${flag}"]`);
    B.refreshChrome();

    if (flag === 'owned') B.toast(patch.owned ? 'Ajouté à ta librairie' : 'Retiré des possédés');
    if (flag === 'wishlist') B.toast(patch.wishlist ? 'Ajouté à ta wishlist' : 'Retiré de la wishlist');
    if (flag === 'read') B.toast(patch.readStatus === 'read' ? 'Marqué comme lu' : 'Remis dans les non-lus');
  }

  function setStatus(status) {
    if (!current) return;
    const B = window.B;
    flushNotes();
    const saved = window.Store.track(current, { readStatus: status });
    current = saved;
    refresh('#sheet-status');
    B.refreshChrome();
    const labels = { unread: 'À lire', reading: 'En cours de lecture', read: 'Marqué comme lu', dropped: 'Abandonné' };
    B.toast(labels[status] || 'Statut mis à jour');
  }

  function setRating(index, half) {
    if (!current) return;
    const B = window.B;
    const user = userFor(current);
    const previous = Number(user.rating) || 0;
    let value = Number(index) + (half ? 0.5 : 1);
    if (value === previous) value = 0;
    const saved = window.Store.track(current, { rating: value });
    current = saved;
    markSaved();

    B.$$('.sheet .star').forEach((star, starIndex) => {
      const fill = star.querySelector('.star__fill');
      if (fill) fill.style.width = Math.max(0, Math.min(100, (value - starIndex) * 100)) + '%';
    });
    const label = B.$('#sheet-rating-value');
    if (label) label.innerHTML = (value ? B.fmtRating(value) : '—') + '<small>/5</small>';
  }

  function setField(field, rawValue) {
    if (!current) return;
    const B = window.B;
    flushNotes();
    let value = rawValue;
    if (field === 'price' || field === 'salePrice') value = parseDecimal(rawValue);
    if (field === 'volumesOwned') value = parseVolume(rawValue);
    if (field === 'condition') value = String(rawValue || '');
    const saved = window.Store.track(current, { [field]: value });
    current = saved;
    markSaved();
    B.refreshChrome();
  }

  function setNotes(value) {
    if (!current) return;
    const count = window.B.$('#notes-count');
    if (count) count.textContent = String(value || '').length + '/2000';
    pendingNotes = value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      if (!current || pendingNotes === null) return;
      const text = pendingNotes;
      pendingNotes = null;
      const saved = window.Store.track(current, { notes: text });
      current = saved;
      markSaved();
    }, 380);
  }

  async function remove() {
    if (!current) return;
    const B = window.B;
    const title = current.title;
    const ok = await B.confirmDialog({
      title: 'Retirer ce titre ?',
      text: '« ' + title + ' » sera retiré de ta librairie. Tes notes, ton prix et ta note seront perdus.',
      confirmLabel: 'Retirer',
      danger: true
    });
    if (!ok) return;
    clearTimeout(notesTimer);
    pendingNotes = null;
    const id = current.id;
    window.Store.remove(id);
    current = null;
    close();
    B.refreshChrome();
    B.toast('Retiré de ta librairie');
  }

  window.addEventListener('popstate', () => {
    if (document.body.classList.contains('sheet-open')) close(true);
  });

  window.Sheet = {
    open,
    close,
    refresh,
    toggle,
    setStatus,
    setRating,
    setField,
    setNotes,
    remove,
    isOpen: () => document.body.classList.contains('sheet-open'),
    get item() { return current; }
  };
})();
