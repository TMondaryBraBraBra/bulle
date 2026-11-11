# =========================================================
# BULLE — calendrier des sorties françaises
# Sources : Manga-News (mangas) · Bédé.fr (BD franco-belge)
# Génère data/releases-fr.js, utilisé par l'onglet Sorties.
# Fonctionne sous Windows PowerShell et PowerShell 7 (GitHub Actions).
# =========================================================
param(
  [int]$MonthsAhead = 3,
  [string]$OutputPath = ""
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not $OutputPath) {
  $OutputPath = Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'data') 'releases-fr.js'
}

$UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
$Curl = if ($env:OS -eq 'Windows_NT') { 'curl.exe' } else { 'curl' }

function Get-Html {
  param([string]$Url)
  $tmp = [IO.Path]::GetTempFileName()
  try {
    & $Curl -s -L --max-time 45 -A $UserAgent -o $tmp $Url | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Téléchargement impossible ($LASTEXITCODE) : $Url" }
    return [IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Clean-Html {
  param([string]$Value)
  if (-not $Value) { return '' }
  $text = [regex]::Replace($Value, '(?s)<[^>]+>', ' ')
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  $text = [regex]::Replace($text, '\s+', ' ').Trim()
  return $text
}

function Get-VolumeInfo {
  param([string]$Title)
  $result = [ordered]@{ volume = 0; label = ''; series = $Title.Trim() }
  $value = $Title.Trim()

  # Coffrets : « Coffret T01 à T06 », « Coffret Tomes 04 à 06 »…
  $box = [regex]::Match($value, '(?i)Coffret\s*(?:Tomes?|T\.?)\s*(\d+)\s*(?:à|a|-|–|—)\s*(?:Tomes?|T\.?)\s*(\d+)')
  if ($box.Success) {
    $result.label = 'Coffret T' + [int]$box.Groups[1].Value + ' à T' + [int]$box.Groups[2].Value
    $result.series = [regex]::Replace($value, '(?i)\s*[-:]?\s*Coffret.*$', '').Trim(' ', '-', ':', ',', '–', '—')
    return $result
  }
  if ($value -match '(?i)Coffret') {
    $result.label = 'Coffret'
    $result.series = [regex]::Replace($value, '(?i)\s*[-:]?\s*Coffret.*$', '').Trim(' ', '-', ':', ',', '–', '—')
    return $result
  }

  # Intégrales : « Intégrale », « la petite intégrale », « intégrale T5 + T6 »…
  if ($value -match '(?i)int[ée]grale') {
    $result.label = 'Intégrale'
    $result.series = [regex]::Replace($value, '(?i)\s*[-:,]?\s*(?:la\s+petite\s+|nouvelle\s+|l''\s*)?int[ée]grale.*$', '').Trim(' ', '-', ':', ',', '–', '—', '(')
    return $result
  }

  # Numéro de tome : Tome 12, T12, T.12, Vol.12, Volume 12, Livre 2
  $volumeMatch = [regex]::Match($value, '(?i)\b(?:Tome|T|Vol\.?|Volume|Livre)\s*\.?\s*(\d{1,4})\b')
  if ($volumeMatch.Success) {
    $result.volume = [int]$volumeMatch.Groups[1].Value
    $result.label = 'Tome ' + $result.volume
    $series = $value.Substring(0, $volumeMatch.Index)
    $result.series = $series.Trim(' ', '-', ':', ',', '–', '—')
    return $result
  }

  # « Série - 12 : sous-titre »
  $numberMatch = [regex]::Match($value, '^(.+?)\s*[-–—]\s*(\d{1,3})\s*(?::|[-–—]|$)')
  if ($numberMatch.Success -and [int]$numberMatch.Groups[2].Value -le 300) {
    $result.volume = [int]$numberMatch.Groups[2].Value
    $result.label = 'Tome ' + $result.volume
    $result.series = $numberMatch.Groups[1].Value.Trim(' ', '-', ':', ',', '–', '—')
    return $result
  }

  $result.series = $value
  return $result
}

function Normalize-Series {
  param([string]$Series)
  $editionTail = '(?i)\s*-\s*(?:Deluxe|Perfect Edition|Star Edition|Black Edition|Final Edition|Edition Perfect|Edition Prestige|Edition Immortelle|Edition Monarque|Smash édition|Édition double|Édition paillettes|Édition Collector|Edition Collector|Full Color.*|Gallery Edition.*|Nouvelle édition.*|Coffret.*|Intégrale.*|(?:Édition|Edition)\s+[^\-]+)$'
  $value = [regex]::Replace($Series, $editionTail, '')
  $value = [regex]::Replace($value, '(?i)\s+nouvelle\s+édition.*$', '')
  $value = [regex]::Replace($value, '\s+luxes?$', '')
  $value = [regex]::Replace($value, '\s*-\s*\((?:collector|deluxe|intégrale)\)\s*$', '')
  $value = [regex]::Replace($value, '(?i)\s*\([^)]*int[ée]grale[^)]*\)\s*$', '')
  $value = [regex]::Replace($value, '\s*\([^)]*/[^)]*\)\s*', ' ')
  $value = [regex]::Replace($value, '\s+', ' ').Trim(' ', '-', ':', ',', '–', '—', '.', ';')
  $value = [regex]::Replace($value, '\s*\($', '')
  return $value
}

function New-Release {
  param(
    [string]$Kind,
    [string]$Series,
    [string]$Title,
    [int]$Volume,
    [string]$Label,
    [string]$Date,
    [string]$Author,
    [string]$Publisher,
    [string]$Cover,
    [string]$Url,
    [string]$Summary,
    [string]$ExternalId = ""
  )
  $seriesClean = Normalize-Series $Series
  if (-not $seriesClean) { $seriesClean = $Title }
  $idBase = ($Kind + '|' + $seriesClean + '|' + $Volume + '|' + $Date + '|' + $Title + '|' + $ExternalId).ToLowerInvariant()
  $hash = 0
  foreach ($ch in $idBase.ToCharArray()) { $hash = (($hash * 31) + [int][char]$ch) -band 0x7fffffff }
  return [ordered]@{
    id        = 'release:' + $Kind + ':' + $hash.ToString('x')
    kind      = $Kind
    series    = $seriesClean
    title     = $Title
    volume    = $Volume
    label     = $Label
    date      = $Date
    author    = $Author
    publisher = $Publisher
    cover     = $Cover
    url       = $Url
    summary   = $Summary
  }
}

# ---------------------------------------------------------
# Manga-News — planning mensuel
# ---------------------------------------------------------
function Get-MangaNewsReleases {
  param([datetime]$Month)
  $items = New-Object System.Collections.Generic.List[object]
  $year = $Month.Year
  $monthNumber = $Month.Month
  $firstUrl = "https://www.manga-news.com/index.php/planning/?p_year=$year&p_month=$monthNumber"

  $firstHtml = Get-Html $firstUrl
  $maxPage = 1
  [regex]::Matches($firstHtml, 'planning/\?[^"'']*?page=(\d+)') | ForEach-Object {
    $page = [int]$_.Groups[1].Value
    if ($page -gt $maxPage) { $maxPage = $page }
  }
  if ($maxPage -gt 20) { $maxPage = 20 }

  for ($page = 1; $page -le $maxPage; $page += 1) {
    $html = if ($page -eq 1) { $firstHtml } else { Get-Html ($firstUrl + '&page=' + $page) }
    $blocks = [regex]::Matches($html, '(?s)<div class="section-list-2-item.*?(?=<div class="section-list-2-item|</main>|</body>)')
    foreach ($block in $blocks) {
      $b = $block.Value
      $titleMatch = [regex]::Match($b, '(?s)<a class="title"[^>]*href="([^"]+)"[^>]*>(.*?)</a>')
      if (-not $titleMatch.Success) { continue }

      $url = [System.Net.WebUtility]::HtmlDecode($titleMatch.Groups[1].Value)
      $rawTitle = [regex]::Replace($titleMatch.Groups[2].Value, '(?s)<span class="data-item titlevo">.*?</span>', '')
      $title = Clean-Html $rawTitle
      if (-not $title) { continue }

      $dateMatch = [regex]::Match($b, 'Sortie le\s+(\d{2})/(\d{2})/(\d{4})')
      if (-not $dateMatch.Success) { continue }
      $date = [datetime]::new([int]$dateMatch.Groups[3].Value, [int]$dateMatch.Groups[2].Value, [int]$dateMatch.Groups[1].Value).ToString('yyyy-MM-dd')

      $coverMatch = [regex]::Match($b, '<img class="entryPicture"[^>]*src="([^"]+)"')
      $cover = if ($coverMatch.Success) { [System.Net.WebUtility]::HtmlDecode($coverMatch.Groups[1].Value) } else { '' }

      $authorMatch = [regex]::Match($b, '(?s)<span class="data-item author">(.*?)(?=<span class="data-item editor"|$)')
      $author = Clean-Html ($authorMatch.Groups[1].Value -replace '(?i)Auteur\(s\)\s*:', '')

      $editorMatch = [regex]::Match($b, '(?s)<span class="data-item editor">(.*?)(?=<div class="summary"|$)')
      $publisher = Clean-Html ($editorMatch.Groups[1].Value -replace '(?i)Editeur\s*:', '')

      $summaryMatch = [regex]::Match($b, '(?s)<div class="summary">(.*?)</div>')
      $summary = if ($summaryMatch.Success) { Clean-Html $summaryMatch.Groups[1].Value } else { '' }
      if ($summary.Length -gt 420) { $summary = $summary.Substring(0, 417).Trim() + '…' }

      $volumeInfo = Get-VolumeInfo $title
      $series = $volumeInfo.series
      if (-not $series) { $series = $title }

      $items.Add((New-Release -Kind 'manga' -Series $series -Title $title -Volume $volumeInfo.volume -Label $volumeInfo.label -Date $date -Author $author -Publisher $publisher -Cover $cover -Url $url -Summary $summary))
    }
  }

  return $items
}

# ---------------------------------------------------------
# Bédé.fr — calendrier franco-belge
# ---------------------------------------------------------
function Get-BedeReleases {
  param([datetime]$Month)
  $items = New-Object System.Collections.Generic.List[object]
  $monthNames = @('janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre')
  $pageUrl = 'https://www.bede.fr/sorties-bd-' + $monthNames[$Month.Month - 1] + '-' + $Month.Year
  $html = Get-Html $pageUrl

  $articles = [regex]::Matches($html, '(?s)<article[^>]*itemtype="https://schema\.org/Book".*?</article>')
  foreach ($article in $articles) {
    $a = $article.Value
    $titleMatch = [regex]::Match($a, 'data-title="([^"]+)"')
    if (-not $titleMatch.Success) { continue }
    $title = [System.Net.WebUtility]::HtmlDecode($titleMatch.Groups[1].Value).Trim()
    if (-not $title) { continue }

    $dateMatch = [regex]::Match($a, 'itemprop="datePublished"\s+content="([^"]+)"')
    if (-not $dateMatch.Success) { continue }
    $date = $dateMatch.Groups[1].Value
    if ($date -notmatch '^\d{4}-\d{2}-\d{2}$') { continue }

    $albumMatch = [regex]::Match($a, 'data-album="([^"]+)"')
    $albumId = if ($albumMatch.Success) { $albumMatch.Groups[1].Value.ToLowerInvariant() } else { '' }
    $url = if ($albumId) { $pageUrl + '#' + $albumId } else { $pageUrl }

    $publisherMatch = [regex]::Match($a, '(?s)itemprop="publisher"[^>]*>(.*?)</div>')
    $publisher = if ($publisherMatch.Success) { Clean-Html $publisherMatch.Groups[1].Value } else { '' }

    $coverMatch = [regex]::Match($a, '<img[^>]*src="(https://cdn\.bede\.fr/[^"]+)"')
    $cover = if ($coverMatch.Success) { [System.Net.WebUtility]::HtmlDecode($coverMatch.Groups[1].Value) } else { '' }

    $volumeInfo = Get-VolumeInfo $title
    $series = $volumeInfo.series
    if (-not $series) { $series = $title }

    $items.Add((New-Release -Kind 'bd' -Series $series -Title $title -Volume $volumeInfo.volume -Label $volumeInfo.label -Date $date -Author '' -Publisher $publisher -Cover $cover -Url $url -Summary '' -ExternalId $albumId))
  }

  return $items
}

# ---------------------------------------------------------
# Génération
# ---------------------------------------------------------
$now = Get-Date
$months = @()
for ($offset = 0; $offset -le $MonthsAhead; $offset += 1) {
  $months += (Get-Date -Year $now.Year -Month $now.Month -Day 1).AddMonths($offset)
}

$all = New-Object System.Collections.Generic.List[object]
$seen = New-Object System.Collections.Generic.HashSet[string]
$errors = @()

foreach ($month in $months) {
  try {
    $manga = Get-MangaNewsReleases -Month $month
    foreach ($item in $manga) {
      if ($seen.Add($item.id)) { $all.Add($item) }
    }
    Write-Host ("Manga-News {0:yyyy-MM} : {1} sorties" -f $month, $manga.Count)
  } catch {
    $errors += ('Manga-News ' + $month.ToString('yyyy-MM') + ' : ' + $_.Exception.Message)
    Write-Warning $errors[-1]
  }

  try {
    $bd = Get-BedeReleases -Month $month
    foreach ($item in $bd) {
      if ($seen.Add($item.id)) { $all.Add($item) }
    }
    Write-Host ("Bédé.fr {0:yyyy-MM} : {1} sorties" -f $month, $bd.Count)
  } catch {
    $errors += ('Bédé.fr ' + $month.ToString('yyyy-MM') + ' : ' + $_.Exception.Message)
    Write-Warning $errors[-1]
  }
}

$sorted = @($all | Sort-Object { $_.date }, { $_.kind }, { $_.series }, { $_.volume })
$mangaCount = @($sorted | Where-Object { $_.kind -eq 'manga' }).Count
$bdCount = @($sorted | Where-Object { $_.kind -eq 'bd' }).Count

# Garde-fou : ne jamais remplacer un calendrier complet par un calendrier vide.
if (Test-Path -LiteralPath $OutputPath) {
  $oldText = [IO.File]::ReadAllText($OutputPath, [Text.Encoding]::UTF8)
  $oldManga = ([regex]::Matches($oldText, '"kind"\s*:\s*"manga"')).Count
  $oldBd = ([regex]::Matches($oldText, '"kind"\s*:\s*"bd"')).Count
  if ($mangaCount -eq 0 -and $oldManga -gt 0) {
    throw ("Garde-fou : aucune sortie manga récupérée, alors que le calendrier existant en contient {0}. Fichier conservé." -f $oldManga)
  }
  if ($bdCount -eq 0 -and $oldBd -gt 0) {
    throw ("Garde-fou : aucune sortie BD récupérée, alors que le calendrier existant en contient {0}. Fichier conservé." -f $oldBd)
  }
}

$payload = [ordered]@{
  generated = $now.ToString('yyyy-MM-dd')
  updatedAt = $now.ToUniversalTime().ToString('o')
  sources   = @('Manga-News', 'Bédé.fr')
  months    = @($months | ForEach-Object { $_.ToString('yyyy-MM') })
  errors    = @($errors)
  items     = $sorted
}

$json = $payload | ConvertTo-Json -Depth 6 -Compress
$js = @"
/* =========================================================
   BULLE — calendrier des sorties françaises
   Généré automatiquement le $($now.ToUniversalTime().ToString('yyyy-MM-dd HH:mm')) UTC.
   Sources : Manga-News (mangas) · Bédé.fr (BD franco-belge).
   Ne pas modifier à la main : relancer scripts/fetch-releases.ps1
   ========================================================= */
window.RELEASES = $json;
"@

$directory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
[IO.File]::WriteAllText($OutputPath, $js, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("Calendrier écrit : {0}" -f $OutputPath)
Write-Host ("{0} sorties : {1} mangas, {2} BD" -f $sorted.Count, $mangaCount, $bdCount)
if ($errors.Count) {
  Write-Host ("{0} source(s) en erreur :" -f $errors.Count) -ForegroundColor Yellow
  $errors | ForEach-Object { Write-Host (' - ' + $_) -ForegroundColor Yellow }
}
