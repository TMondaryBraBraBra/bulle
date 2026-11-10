/* =========================================================
   BULLE — routeur, actions, recherche, mises à jour
   ========================================================= */
(function () {
  'use strict';

  const B = window.B;
  const Store = window.Store;
  const Screens = window.Screens;
  const Sheet = window.Sheet;
  const $ = B.$;
  const $$ = B.$$;

  let searchTimer = null;
  let searchSeq = 0;
  let refreshing = false;
  let importInput = null;

  /* ------------------------- rendering ------------------------- */
  function afterRender() {
    $$('#view img.poster__img, #overlay-root img.poster__img').forEach((img) => {
      if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');
    });

    if (B.ui.screen === 'explore' && B.ui.explore.focusSearch) {
      B.ui.explore.focusSearch = false;
      const input = $('#global-search');
      if (input) {
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (err) { /* noop */ }
      }
    }

    syncGlobalSearch();

    if (B.ui.screen === 'explore') {
      const query = B.ui.explore.q.trim();
      if (query.length >= 2 && B.ui.explore.searchedFor !== query && !B.ui.explore.loading) {
        scheduleSearch(0);
      }
    }

    if (B.ui.screen === 'settings') updateStorageEstimate();
  }

  function renderCurrentScreen(options) {
    const opts = options || {};
    const scrollY = opts.preserveScroll ? window.scrollY : 0;
    const screen = B.ui.screen;
    let html = '';
    document.body.dataset.screen = screen;

    if (screen === 'explore') html = Screens.explore();
    else if (screen === 'releases') html = Screens.releases();
    else if (screen === 'library') html = Screens.library();
    else if (screen === 'stats') html = Screens.stats();
    else if (screen === 'settings') html = Screens.settings();
    else html = Screens.home();

    $('#view').innerHTML = html;
    B.refreshChrome();

    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
      afterRender();
    });
  }

  window.App = { renderCurrentScreen };

  function currentRoute() {
    return (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
  }

  function renderRoute() {
    if (document.body.classList.contains('sheet-open')) Sheet.close(true);
    const route = currentRoute();
    const valid = ['home', 'explore', 'releases', 'library', 'stats', 'settings'];
    if (!valid.includes(route)) {
      B.ui.screen = 'home';
      if (location.hash !== '#/') history.replaceState(null, '', '#/');
    } else {
      B.ui.screen = route;
    }
    renderCurrentScreen();
  }

  /* ------------------------- explore / search ------------------------- */
  function renderExploreResults() {
    const container = $('#explore-results');
    if (!container) return;
    container.innerHTML = Screens.exploreResultsHTML();
  }

  function scheduleSearch(delay) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, delay === undefined ? 450 : delay);
  }

  async function runSearch() {
    const query = B.ui.explore.q.trim();
    const kind = B.ui.explore.kind;
    if (query.length < 2) {
      B.ui.explore.items = [];
      B.ui.explore.searchedFor = '';
      B.ui.explore.loading = false;
      renderExploreResults();
      return;
    }

    const seq = ++searchSeq;
    B.ui.explore.loading = true;
    B.ui.explore.errors = [];
    renderExploreResults();

    try {
      const result = await window.Api.search(query, kind);
      if (seq !== searchSeq || B.ui.explore.q.trim() !== query || B.ui.explore.kind !== kind) return;
      B.ui.explore.items = result.items || [];
      B.ui.explore.errors = result.errors || [];
      B.ui.explore.searchedFor = query;
    } catch (err) {
      if (seq !== searchSeq) return;
      B.ui.explore.items = [];
      B.ui.explore.errors = [{ source: 'Réseau', message: err.message || 'Erreur inconnue' }];
      B.ui.explore.searchedFor = query;
    } finally {
      if (seq === searchSeq) {
        B.ui.explore.loading = false;
        renderExploreResults();
      }
    }
  }

  function syncGlobalSearch() {
    const input = $('#global-search');
    if (!input) return;
    if (document.activeElement !== input && input.value !== B.ui.explore.q) {
      input.value = B.ui.explore.q;
    }
    const clear = $('#global-search-clear');
    if (clear) clear.hidden = !input.value;
  }

  function onGlobalInput(value) {
    B.ui.explore.q = value;
    B.ui.explore.limit = 28;
    clearTimeout(searchTimer);

    const query = value.trim();
    if (query.length < 2) {
      searchSeq += 1;
      B.ui.explore.loading = false;
      B.ui.explore.searchedFor = '';
      B.ui.explore.items = [];
      B.ui.explore.errors = [];
    }

    if (B.ui.screen !== 'explore') {
      if (location.hash === '#/explore') renderCurrentScreen({ preserveScroll: true });
      else location.hash = '#/explore';
    } else {
      renderExploreResults();
    }

    syncGlobalSearch();

    if (query.length >= 2) scheduleSearch(450);
  }

  function setExploreKind(kind) {
    if (!['all', 'manga', 'bd'].includes(kind)) return;
    if (B.ui.explore.kind === kind) return;
    B.ui.explore.kind = kind;
    B.ui.explore.limit = 28;
    searchSeq += 1;
    clearTimeout(searchTimer);
    if (B.ui.explore.q.trim().length >= 2) {
      B.ui.explore.items = [];
      B.ui.explore.errors = [];
      B.ui.explore.searchedFor = '';
    }
    renderCurrentScreen({ preserveScroll: true });
    if (B.ui.explore.q.trim().length >= 2) scheduleSearch(0);
  }

  function goExplore(kind) {
    B.ui.explore.q = '';
    B.ui.explore.kind = ['manga', 'bd'].includes(kind) ? kind : 'all';
    B.ui.explore.genre = '';
    B.ui.explore.limit = 28;
    B.ui.explore.items = [];
    B.ui.explore.errors = [];
    B.ui.explore.loading = false;
    B.ui.explore.searchedFor = '';
    searchSeq += 1;
    clearTimeout(searchTimer);
    if (location.hash === '#/explore') renderCurrentScreen();
    else location.hash = '#/explore';
  }

  function focusSearch() {
    if (document.body.classList.contains('sheet-open')) return;
    const input = $('#global-search');
    if (!input) return;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (err) { /* noop */ }
  }

  function refreshAfterLibraryChange() {
    if (document.body.classList.contains('sheet-open')) return;
    if (B.ui.screen === 'explore') {
      renderExploreResults();
      B.refreshChrome();
    } else {
      renderCurrentScreen({ preserveScroll: true });
    }
  }

  /* ------------------------- actions ------------------------- */
  async function handleAction(action, target, event) {
    switch (action) {
      case 'open-item': {
        const item = B.findItem(target.dataset.id);
        if (item) Sheet.open(item);
        break;
      }

      case 'open-release': {
        const release = B.findRelease(target.dataset.id);
        if (release) Sheet.open(B.releaseToItem(release));
        break;
      }

      case 'open-series': {
        const group = B.findSeriesGroup(target.dataset.group, target.dataset.item);
        if (group) Sheet.openSeries(group);
        break;
      }

      case 'home-tab': {
        const tab = target.dataset.tab;
        if (!['all', 'manga', 'bd', 'releases'].includes(tab)) break;
        B.ui.home.tab = tab;
        renderCurrentScreen({ preserveScroll: true });
        break;
      }

      case 'goto-releases':
        if (location.hash === '#/releases') renderCurrentScreen({ preserveScroll: true });
        else location.hash = '#/releases';
        break;

      case 'release-kind': {
        const kind = target.dataset.kind;
        if (!['all', 'manga', 'bd'].includes(kind)) break;
        B.ui.releases.kind = kind;
        B.ui.releases.limit = 60;
        renderCurrentScreen({ preserveScroll: true });
        break;
      }

      case 'release-collection':
        B.ui.releases.collectionOnly = !B.ui.releases.collectionOnly;
        B.ui.releases.limit = 60;
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'release-reset':
        B.ui.releases.kind = 'all';
        B.ui.releases.month = 'all';
        B.ui.releases.collectionOnly = false;
        B.ui.releases.limit = 60;
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'load-more-releases':
        B.ui.releases.limit += 60;
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'quick-add': {
        const item = B.findItem(target.dataset.id);
        if (!item) break;
        const stored = Store.get(item.id);
        if (stored && stored.owned) {
          Sheet.open(stored);
          break;
        }
        if (stored && stored.wishlist) {
          Store.track(item, { wishlist: false });
          B.toast('Retiré de la wishlist');
        } else {
          Store.track(item, { wishlist: true });
          B.toast('Ajouté à ta wishlist');
        }
        refreshAfterLibraryChange();
        break;
      }

      case 'rail': {
        const wrap = target.closest('.rail-wrap');
        const rail = wrap && wrap.querySelector('.rail');
        if (rail) {
          const dir = Number(target.dataset.dir) || 1;
          rail.scrollBy({ left: dir * Math.max(300, rail.clientWidth * 0.8), behavior: 'smooth' });
        }
        break;
      }

      case 'set-explore-kind':
        setExploreKind(target.dataset.kind);
        break;

      case 'explore-kind':
        goExplore(target.dataset.kind);
        break;

      case 'explore-genre':
        B.ui.explore.genre = target.dataset.genre || '';
        B.ui.explore.limit = 28;
        renderExploreResults();
        break;

      case 'clear-search':
        B.ui.explore.q = '';
        B.ui.explore.items = [];
        B.ui.explore.errors = [];
        B.ui.explore.searchedFor = '';
        B.ui.explore.limit = 28;
        searchSeq += 1;
        clearTimeout(searchTimer);
        {
          const input = $('#global-search');
          if (input) {
            input.value = '';
            input.focus();
          }
          syncGlobalSearch();
        }
        if (B.ui.screen === 'explore') renderExploreResults();
        break;

      case 'retry-search':
        runSearch();
        break;

      case 'load-more':
        B.ui.explore.limit += 28;
        renderExploreResults();
        break;

      case 'goto-library':
        B.ui.library.status = target.dataset.filter || 'all';
        if (location.hash === '#/library') renderCurrentScreen();
        else location.hash = '#/library';
        break;

      case 'lib-filter':
        B.ui.library.status = target.dataset.filter || 'all';
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'lib-kind':
        B.ui.library.kind = target.dataset.kind || 'all';
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'lib-view': {
        const view = target.dataset.view === 'list' ? 'list' : 'grid';
        B.ui.library.view = view;
        Store.setSetting('libraryView', view);
        renderCurrentScreen({ preserveScroll: true });
        break;
      }

      case 'set-theme':
        B.applyTheme(target.dataset.theme);
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'toggle-theme':
        B.applyTheme(Store.settings.theme === 'light' ? 'dark' : 'light');
        renderCurrentScreen({ preserveScroll: true });
        break;

      case 'close-sheet':
        Sheet.close();
        break;

      case 'backdrop-close':
        if (event.target === target) Sheet.close();
        break;

      case 'remove-item':
        Sheet.remove();
        break;

      case 'rate': {
        const rect = target.getBoundingClientRect();
        const keyboard = event.detail === 0;
        const half = !keyboard && (event.clientX - rect.left) < rect.width / 2;
        Sheet.setRating(Number(target.dataset.index), half);
        break;
      }

      case 'toggle-volume':
        Sheet.toggleVolume(Number(target.dataset.volume));
        break;

      case 'volumes-all':
        Sheet.setAllVolumes('all');
        break;

      case 'volumes-none':
        Sheet.setAllVolumes('none');
        break;

      case 'focus-search':
        focusSearch();
        break;

      case 'apply-update':
        applyUpdate();
        break;

      case 'dismiss-update':
        $('#update-banner').hidden = true;
        break;

      case 'check-update':
        checkForUpdates(true);
        break;

      case 'install-app':
        installApp();
        break;

      case 'export-data':
        exportData();
        break;

      case 'import-data':
        if (importInput) importInput.click();
        break;

      case 'load-demo':
        await loadDemoFlow();
        break;

      case 'reset-data':
        await resetDataFlow();
        break;

      case 'reload-app':
        location.reload();
        break;

      default:
        break;
    }
  }

  /* ------------------------- install ------------------------- */
  function installApp() {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      B.toast('Bulle est déjà installée sur cet appareil.', 'info');
      return;
    }
    const prompt = B.ui.installPrompt;
    if (!prompt) {
      B.toast('Ouvre le menu de ton navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».', 'info', 6500);
      return;
    }
    prompt.prompt();
    prompt.userChoice.then((choice) => {
      if (choice && choice.outcome === 'accepted') B.toast('Installation de Bulle lancée 🎉');
      B.ui.installPrompt = null;
      if (B.ui.screen === 'settings') renderCurrentScreen({ preserveScroll: true });
    }).catch(() => {
      B.ui.installPrompt = null;
    });
  }

  /* ------------------------- updates ------------------------- */
  function showUpdateBanner() {
    const banner = $('#update-banner');
    if (banner) banner.hidden = false;
  }

  function setUpdateStatus(text) {
    const el = $('#update-status');
    if (el) el.textContent = text;
  }

  async function fetchLatestVersion() {
    try {
      const response = await fetch('./version.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      return data && data.version ? String(data.version) : null;
    } catch (err) {
      return null;
    }
  }

  async function checkForUpdates(manual) {
    if (!('serviceWorker' in navigator)) {
      if (manual) B.toast('Les mises à jour sont disponibles une fois l’app installée depuis le web.', 'info');
      return;
    }
    try {
      const reg = B.ui.swReg || await navigator.serviceWorker.getRegistration();
      if (manual) setUpdateStatus('Recherche de mise à jour…');
      if (reg) await reg.update();
      const latest = await fetchLatestVersion();
      await new Promise((resolve) => setTimeout(resolve, 900));

      if (latest && latest !== B.APP_VERSION) {
        showUpdateBanner();
        setUpdateStatus('Bulle v' + latest + ' disponible');
        if (manual) B.toast('La version ' + latest + ' est prête : clique sur « Mettre à jour ».', 'info');
        return;
      }

      if (reg && reg.waiting) {
        showUpdateBanner();
        setUpdateStatus('Bulle v' + B.APP_VERSION + ' · mise à jour prête');
        if (manual) B.toast('Nouvelle version prête : clique sur « Mettre à jour ».', 'info');
      } else {
        setUpdateStatus('Bulle v' + B.APP_VERSION + ' · à jour');
        if (manual) B.toast('Tu es déjà à jour ✓');
      }
    } catch (err) {
      setUpdateStatus('Bulle v' + B.APP_VERSION);
      if (manual) B.toast('Vérification impossible pour le moment. Réessaie plus tard.', 'error');
    }
  }

  async function applyUpdate() {
    if (!('serviceWorker' in navigator)) {
      location.reload();
      return;
    }
    try {
      const reg = B.ui.swReg || await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        refreshing = true;
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => {
          if (refreshing) location.reload();
        }, 1800);
      } else {
        location.reload();
      }
    } catch (err) {
      location.reload();
    }
  }

  async function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

    // Mode développement : ouvrir l'app avec ?nosw=1 pour tester sans cache du service worker.
    if (new URLSearchParams(location.search).has('nosw')) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      } catch (err) { /* noop */ }
      return;
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) location.reload();
    });

    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        B.ui.swReg = reg;

        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });

        setInterval(() => {
          if (navigator.onLine) reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch (err) {
        console.warn('[Bulle] Service worker indisponible.', err);
      }
    });
  }

  /* ------------------------- data actions ------------------------- */
  function exportData() {
    const data = Store.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulle-collection-' + date + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    B.toast('Sauvegarde de ta collection téléchargée');
  }

  function setupImportInput() {
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.hidden = true;
    importInput.id = 'import-file';
    document.body.appendChild(importInput);

    importInput.addEventListener('change', async () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!file) return;

      const ok = await B.confirmDialog({
        title: 'Importer cette sauvegarde ?',
        text: '« ' + file.name + ' » sera fusionné avec ta collection actuelle. Les titres déjà présents seront mis à jour.',
        confirmLabel: 'Importer'
      });
      if (!ok) return;

      try {
        const text = await file.text();
        const result = Store.importData(text);
        B.applyTheme(Store.settings.theme, false);
        renderCurrentScreen();
        B.toast(result.added + ' ajouté' + (result.added > 1 ? 's' : '') + ', ' + result.updated + ' mis à jour');
      } catch (err) {
        B.toast(err.message || 'Import impossible.', 'error');
      }
    });
  }

  async function loadDemoFlow() {
    const hasItems = Store.all().length > 0;
    if (hasItems) {
      const ok = await B.confirmDialog({
        title: 'Charger des exemples ?',
        text: 'Une sélection de mangas et de BD sera ajoutée à ta collection actuelle. Tu pourras tout effacer depuis les réglages.',
        confirmLabel: 'Ajouter les exemples'
      });
      if (!ok) return;
    }
    const count = Store.loadDemo();
    B.ui.library.status = 'all';
    B.ui.library.kind = 'all';
    B.applyTheme(Store.settings.theme, false);
    renderCurrentScreen();
    B.toast(count + ' titres d’exemple ajoutés');
  }

  async function resetDataFlow() {
    const ok = await B.confirmDialog({
      title: 'Tout effacer ?',
      text: 'Ta collection, tes notes et tes réglages seront définitivement supprimés de cet appareil. Pense à exporter avant.',
      confirmLabel: 'Tout effacer',
      danger: true
    });
    if (!ok) return;
    Store.clear();
    B.applyTheme('dark', false);
    B.ui.explore.q = '';
    B.ui.explore.kind = 'all';
    B.ui.explore.genre = '';
    B.ui.explore.items = [];
    B.ui.explore.searchedFor = '';
    B.ui.library.status = 'all';
    B.ui.library.kind = 'all';
    B.ui.library.sort = 'recent';
    B.ui.library.view = 'grid';
    B.ui.home.tab = 'all';
    B.ui.releases.kind = 'all';
    B.ui.releases.month = 'all';
    B.ui.releases.collectionOnly = false;
    B.ui.releases.limit = 60;
    if (location.hash !== '#/' && location.hash !== '') location.hash = '#/';
    else renderCurrentScreen();
    B.toast('Collection effacée');
  }

  /* ------------------------- storage estimate ------------------------- */
  async function updateStorageEstimate() {
    const el = $('#storage-usage');
    if (!el) return;
    try {
      if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        const estimate = await navigator.storage.estimate();
        const used = (Number(estimate.usage) || 0) / 1024 / 1024;
        const quota = (Number(estimate.quota) || 0) / 1024 / 1024;
        el.textContent = used.toFixed(2).replace('.', ',') + ' Mo utilisés' + (quota ? ' · ' + Math.round(quota) + ' Mo disponibles' : '');
      } else {
        const bytes = new Blob([JSON.stringify(Store.exportData())]).size;
        el.textContent = Math.max(1, Math.round(bytes / 1024)) + ' Ko de collection';
      }
    } catch (err) {
      el.textContent = 'Stockage local du téléphone';
    }
  }

  /* ------------------------- events ------------------------- */
  function bindEvents() {
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-sheet-toggle]');
      if (toggle) {
        event.preventDefault();
        Sheet.toggle(toggle.dataset.sheetToggle);
        return;
      }

      const actionTarget = event.target.closest('[data-action]');
      if (!actionTarget) return;
      const action = actionTarget.dataset.action;
      Promise.resolve(handleAction(action, actionTarget, event)).catch((err) => {
        console.error('[Bulle]', err);
        B.toast('Une erreur est survenue. Réessaie.', 'error');
      });
    });

    document.addEventListener('input', (event) => {
      if (event.target.id === 'global-search') onGlobalInput(event.target.value);
      else if (event.target.id === 'sheet-notes') Sheet.setNotes(event.target.value);
    });

    document.addEventListener('change', (event) => {
      const target = event.target;

      if (target.id === 'explore-sort') {
        B.ui.explore.sort = target.value;
        B.ui.explore.limit = 28;
        renderExploreResults();
        return;
      }

      if (target.id === 'library-sort') {
        B.ui.library.sort = target.value;
        Store.setSetting('librarySort', target.value);
        renderCurrentScreen({ preserveScroll: true });
        return;
      }

      if (target.id === 'release-month') {
        B.ui.releases.month = target.value || 'all';
        B.ui.releases.limit = 60;
        renderCurrentScreen({ preserveScroll: true });
        return;
      }

      if (target.id === 'profile-name') {
        Store.setSetting('name', String(target.value || '').trim());
        B.toast('Profil mis à jour');
        return;
      }

      if (target.dataset.sheetSelect === 'readStatus') {
        Sheet.setStatus(target.value);
        return;
      }

      if (target.dataset.sheetField) {
        Sheet.setField(target.dataset.sheetField, target.value);
      }
    });

    document.addEventListener('keydown', (event) => {
      const tag = (event.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;

      if (event.key === 'Escape' && document.body.classList.contains('sheet-open')) {
        if (document.querySelector('#overlay-root .dialog-backdrop')) return;
        event.preventDefault();
        Sheet.close();
        return;
      }

      if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) && !typing) {
        event.preventDefault();
        focusSearch();
      }
    });

    document.addEventListener('load', (event) => {
      if (event.target.tagName === 'IMG' && event.target.classList.contains('poster__img')) {
        event.target.classList.add('is-loaded');
      }
    }, true);

    document.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG' && event.target.classList.contains('poster__img')) {
        event.target.classList.add('is-failed');
      }
    }, true);

    window.addEventListener('hashchange', renderRoute);

    window.addEventListener('online', () => {
      B.refreshChrome();
      B.toast('De retour en ligne', 'info');
    });

    window.addEventListener('offline', () => {
      B.refreshChrome();
      B.toast('Hors-ligne : ta collection reste disponible', 'info');
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      B.ui.installPrompt = event;
      if (B.ui.screen === 'settings') renderCurrentScreen({ preserveScroll: true });
    });

    window.addEventListener('appinstalled', () => {
      B.ui.installPrompt = null;
      B.toast('Bulle est installée 🎉');
      if (B.ui.screen === 'settings') renderCurrentScreen({ preserveScroll: true });
    });

    window.addEventListener('popstate', () => {
      if (document.body.classList.contains('sheet-open')) Sheet.close(true);
    });

    window.addEventListener('bulle:store', () => {
      B.refreshChrome();
    });
  }

  /* ------------------------- boot ------------------------- */
  function boot() {
    if (!location.hash) history.replaceState(null, '', '#/');
    B.applyTheme(Store.settings.theme, false);
    setupImportInput();
    bindEvents();
    renderRoute();
    B.refreshChrome();
    setupServiceWorker();
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
