/* =========================================================
   BULLE — écran : réglages
   ========================================================= */
(function () {
  'use strict';
  const S = window.Screens = window.Screens || {};

  S.settings = function settings() {
    const B = window.B;
    const { esc, icon } = B;
    const Store = window.Store;
    const settings = Store.settings;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const installReady = Boolean(B.ui.installPrompt);
    const seedDate = window.SEED && window.SEED.generated
      ? new Date(window.SEED.generated + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

    const themeButton = (id, label, iconName) => `<button class="segmented__btn ${settings.theme === id ? 'is-active' : ''}"
      data-action="set-theme" data-theme="${id}" type="button">${icon(iconName)} ${esc(label)}</button>`;

    return `<section class="page">
      <div class="page__head">
        <div>
          <span class="eyebrow">Réglages</span>
          <h1 class="page-title">Ton Bulle</h1>
          <p class="page-sub">Un profil, un thème, une collection. Et la certitude que rien ne part sur un serveur.</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="card install-card">
          <div class="card__head">${icon('install')}<h3>${standalone ? 'Bulle est installée' : 'Installer Bulle sur ton téléphone'}</h3></div>
          <div class="card__body">
            <p class="card__desc">${standalone
              ? 'Tu utilises la version installée : icône sur l’écran d’accueil, plein écran, et accès hors-ligne.'
              : 'Une icône sur ton écran d’accueil, en plein écran, comme une appli normale. Pas de store, pas de compte.'}</p>
            ${standalone
              ? `<div class="status-line"><span class="dot"></span> Application installée sur cet appareil</div>`
              : `<button class="btn btn--accent btn--wide" data-action="install-app" type="button">${icon('install')} ${installReady ? 'Installer maintenant' : 'Comment installer ?'}</button>
                 <div class="install-card__hint">${icon('info')}
                   <span><strong>Android :</strong> menu ⋮ de Chrome → « Installer l’application ».<br>
                   <strong>iPhone :</strong> Partager → « Sur l’écran d’accueil ».</span>
                 </div>`}
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('pencil')}<h3>Profil</h3></div>
          <div class="card__body">
            <div class="field">
              <label for="profile-name">Comment veux-tu être appelé ?</label>
              <input class="input" id="profile-name" type="text" maxlength="40" value="${esc(settings.name)}" placeholder="Ton prénom" autocomplete="given-name">
            </div>
            <p class="card__desc" style="margin-top:10px">Sert juste à personnaliser l’accueil. Aucune inscription, aucun mot de passe.</p>
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('sun')}<h3>Apparence</h3></div>
          <div class="card__body">
            <div class="segmented" style="width:100%">
              ${themeButton('dark', 'Sombre', 'moon')}
              ${themeButton('light', 'Clair', 'sun')}
            </div>
            <p class="card__desc" style="margin-top:12px">Le thème sombre est pensé pour les couvertures. Le thème clair pour lire tranquillement.</p>
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('refresh')}<h3>Mises à jour</h3></div>
          <div class="card__body">
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Version installée</strong>
                <span id="update-status">Bulle v${esc(B.APP_VERSION)}</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small" data-action="check-update" type="button">${icon('refresh')} Vérifier</button>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Appliquer une mise à jour</strong>
                <span>Quand une nouvelle version est prête, un bouton apparaît en haut de l’écran.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small btn--accent" data-action="apply-update" type="button">Mettre à jour</button>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Recharger l’application</strong>
                <span>Utile si un écran semble bloqué. Ta collection est conservée.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small" data-action="reload-app" type="button">Recharger</button>
              </div>
            </div>
            <p class="card__desc" style="margin-top:12px">Les mises à jour sont publiées depuis GitHub. Tu n’as rien à installer à la main : l’app se met à jour et te prévient.</p>
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('download')}<h3>Mes données</h3></div>
          <div class="card__body">
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Exporter ma collection</strong>
                <span>Un fichier JSON de sauvegarde, à garder précieusement.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small" data-action="export-data" type="button">${icon('download')} Exporter</button>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Importer une sauvegarde</strong>
                <span>Fusionne un fichier exporté avec ta collection actuelle.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small" data-action="import-data" type="button">${icon('upload')} Importer</button>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Exemples de collection</strong>
                <span>Ajoute une sélection de titres pour tester l’app.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small" data-action="load-demo" type="button">${icon('sparkles')} Charger</button>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Stockage utilisé</strong>
                <span id="storage-usage">Calcul en cours…</span>
              </div>
            </div>
            <div class="setting-row" style="border-top:1px solid var(--line);margin-top:4px;padding-top:14px">
              <div class="setting-row__text">
                <strong style="color:var(--danger)">Tout effacer</strong>
                <span>Supprime définitivement ta collection de cet appareil.</span>
              </div>
              <div class="setting-row__actions">
                <button class="btn btn--small btn--danger" data-action="reset-data" type="button">${icon('trash')} Effacer</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('globe')}<h3>Sources du catalogue</h3></div>
          <div class="card__body">
            <p class="card__desc">Les fiches et couvertures viennent de bases gratuites et ouvertes :</p>
            <div class="setting-row">
              <div class="setting-row__text"><strong>AniList</strong><span>Mangas, couvertures, synopsis, genres</span></div>
              <a class="btn btn--small" href="https://anilist.co" target="_blank" rel="noopener noreferrer">Ouvrir ${icon('external')}</a>
            </div>
            <div class="setting-row">
              <div class="setting-row__text"><strong>Open Library</strong><span>BD, albums, romans graphiques</span></div>
              <a class="btn btn--small" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Ouvrir ${icon('external')}</a>
            </div>
            <div class="setting-row">
              <div class="setting-row__text"><strong>Google Books</strong><span>Compléments BD et comics</span></div>
              <a class="btn btn--small" href="https://books.google.com" target="_blank" rel="noopener noreferrer">Ouvrir ${icon('external')}</a>
            </div>
            <p class="credits" style="margin-top:12px">Couvertures et textes © leurs éditeurs et ayants droit respectifs. Bulle est une application personnelle, sans affiliation avec ces services.</p>
          </div>
        </div>

        <div class="card">
          <div class="card__head">${icon('shield')}<h3>Confidentialité & à propos</h3></div>
          <div class="card__body">
            <p class="card__desc"><strong>Ta collection ne quitte jamais ton téléphone.</strong> Possessions, envies, notes et notes personnelles sont enregistrés dans le stockage local de l’app. Aucun compte, aucun serveur Bulle.</p>
            <p class="card__desc">Les recherches en ligne envoient uniquement le texte que tu tapes à AniList, Open Library et Google Books, pour trouver des couvertures.</p>
            <div class="status-line"><span class="dot"></span> Données locales · ${esc(seedDate)}</div>
            <p class="credits" style="margin-top:14px">Bulle v${esc(B.APP_VERSION)} · faite pour les étagères qui débordent.<br>
              Catalogue local : ${esc(String((window.SEED && window.SEED.catalog || []).length))} titres · ${esc(String((window.SEED && window.SEED.rows || []).length))} sélections.</p>
          </div>
        </div>
      </div>
    </section>`;
  };
})();
