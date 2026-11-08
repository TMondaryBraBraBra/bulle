# Bulle — ta mangathèque & bédéthèque

**Bulle** réunit tes mangas, tes BD et tes comics dans une seule bibliothèque visuelle, façon Netflix. Elle s'installe sur Android comme une vraie application (PWA), fonctionne hors-ligne et garde **toutes tes données sur ton téléphone**.

Pas de compte Bulle, pas de serveur, pas d'abonnement. GitHub héberge seulement le code.

---

## Ce que Bulle sait faire

- **Une seule étagère** pour les mangas, BD franco-belges et comics.
- **Catalogue local** de 144 titres avec vraies couvertures, prêt à explorer hors-ligne.
- **Recherche en ligne gratuite** : AniList (mangas), Open Library (BD) et Google Books (compléments).
- Pour chaque titre, suivre indépendamment :
  - **Possédé** ou non
  - **Wishlist**
  - **Lu / en cours / à lire / abandonné**
  - **Note** de 0 à 5 étoiles (demi-étoiles)
  - **Prix d'achat** et **valeur de revente estimée**
  - Nombre de tomes, état, notes personnelles
- **Statistiques** : budget, plus-value, répartition manga/BD, genres favoris, top 5.
- **Thème sombre ou clair**, interface 100 % en français.
- **Export / import JSON** pour sauvegarder ou changer de téléphone.
- **Mise à jour intégrée** : l'app détecte une nouvelle version et affiche un bouton « Mettre à jour ».

---

## Installer sur Android

1. Ouvrir l'adresse de l'app dans **Chrome**.
2. Menu **⋮** → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. Confirmer : l'icône **Bulle** apparaît sur l'écran d'accueil.
4. L'app s'ouvre en plein écran, comme une application classique.

Sur iPhone : **Partager** → **Sur l'écran d'accueil**.

> Une PWA installée n'est pas un simple raccourci : Chrome la lance en plein écran, la met en cache et la fait fonctionner hors-ligne.

---

## Mettre à jour l'app

Quand une nouvelle version est publiée :

1. Ouvre **Réglages** dans Bulle.
2. Appuie sur **Vérifier** (ou attends la bannière en haut de l'écran).
3. Appuie sur **Mettre à jour** : l'app se recharge sur la nouvelle version.

Ta collection est conservée. Les mises à jour ne touchent qu'au code de l'app.

---

## Déployer sur GitHub Pages (gratuit)

### 1. Créer le dépôt

1. Crée un compte sur [github.com](https://github.com).
2. Crée un dépôt **public** nommé par exemple `bulle`.
3. Ne coche pas « Add a README » : il est déjà là.

> GitHub Pages est gratuit pour les dépôts publics. Un dépôt privé nécessite un compte GitHub payant.

### 2. Envoyer les fichiers

**Depuis un ordinateur, avec Git :**

```bash
git init
git add .
git commit -m "Bulle v1.0.0"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/bulle.git
git push -u origin main
```

**Sans Git / depuis le navigateur :**

1. Sur la page du dépôt : **Add file** → **Upload files**.
2. Glisse **tout le contenu** du dossier Bulle (pas le dossier lui-même).
3. Valide le commit sur la branche `main`.

> Le fichier `.nojekyll` et le dossier `.github` sont indispensables. Sur Windows, active l'affichage des fichiers cachés pour les voir.

### 3. Activer GitHub Pages

1. Dans le dépôt : **Settings** → **Pages**.
2. Sous **Build and deployment** → **Source**, choisis **GitHub Actions**.
3. Va dans l'onglet **Actions** : le workflow « Deploy Bulle to GitHub Pages » se lance.
4. Une fois terminé, l'app est en ligne à l'adresse :

```
https://TON-COMPTE.github.io/bulle/
```

Le déploiement se relance automatiquement à chaque commit sur `main`.

---

## Publier une nouvelle version

Le numéro de version a **une seule source** : `version.json`. Le workflow GitHub Actions le recopie automatiquement dans `js/core.js` et `sw.js` avant le déploiement.

1. Modifie `version.json` (directement sur GitHub, même depuis le téléphone) :

```json
{
  "version": "1.0.1",
  "released": "2026-10-25",
  "notes": "Corrections et nouvelles couvertures."
}
```

2. Commit sur `main`.
3. GitHub Actions redéploie automatiquement.
4. Dans Bulle : **Réglages** → **Vérifier** → **Mettre à jour**.

C'est tout. Pas besoin d'ordinateur pour cette étape.

---

## Tester en local

Avec Windows PowerShell :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\serve.ps1 -Port 5173
```

Puis ouvrir <http://localhost:5173/>.

Pour tester sans le service worker (évite les caches pendant le développement) :

```
http://localhost:5173/?nosw=1
```

---

## Structure du projet

```
index.html                 coquille de l'app + icônes SVG
manifest.webmanifest       manifeste PWA (installation Android)
sw.js                      service worker (hors-ligne + mises à jour)
version.json               version publiée (source unique)
css/styles.css             design system complet
data/seed.js               catalogue local de 144 titres
js/store.js                collection locale, stats, import/export
js/api.js                  AniList, Open Library, Google Books
js/core.js                 helpers et composants visuels
js/screens-home.js         accueil + explorer
js/screens-library.js      librairie + statistiques
js/screens-settings.js     réglages
js/sheet.js                fiche détaillée d'un titre
js/app.js                  routeur, recherche, installation, mises à jour
icons/                     icônes PWA générées
scripts/serve.ps1          serveur local de test
scripts/generate-icons.ps1 génération des icônes
scripts/stamp-version.mjs  synchronisation de version (CI)
.github/workflows/deploy.yml déploiement GitHub Pages
```

---

## Données & confidentialité

- La collection est stockée dans le **localStorage** du navigateur, sur l'appareil.
- Aucune donnée n'est envoyée à un serveur Bulle : il n'y en a pas.
- Les recherches en ligne transmettent uniquement le texte saisi à AniList, Open Library et Google Books.
- Les couvertures sont chargées depuis ces services et mises en cache pour l'affichage hors-ligne.
- **Fais un export JSON de temps en temps** : vider les données du navigateur ou désinstaller l'app efface la collection locale.

---

## Crédits

- Couvertures, synopsis et métadonnées : [AniList](https://anilist.co), [Open Library](https://openlibrary.org), [Google Books](https://books.google.com).
- Tous les contenus restent la propriété de leurs éditeurs et ayants droit.
- Bulle est un projet personnel, sans affiliation avec ces services.

---

**Bulle v1.0.0** · faite pour les étagères qui débordent.
