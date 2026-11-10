# =========================================================
# BULLE — calendrier des sorties françaises
# Sources : Manga-News (mangas) · BDGest (BD franco-belge)
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

  # Coffrets : « Coffret T01 à T06 », « Coffret Starter »…
  $box = [regex]::Match($Title, '(?i)Coffret[^0-9]*T\s*(\d+)\s*(?:à|a|-|–|—)\s*T\s*(\d+)')
  if ($box.Success) {
    $result.label = 'Coffret T' + $box.Groups[1].Value + ' à T' + $box.Groups[2].Value
    $result.series = [regex]::Replace($Title, '(?i)\s*-\s*Coffret.*$', '').Trim(' ', '-', '–', '—')
    return $result
  }
  if ($Title -match '(?i)Coffret') {
    $result.label = 'Coffret'
    $result.series = [regex]::Replace($Title, '(?i)\s*-\s*Coffret.*$', '').Trim(' ', '-', '–', '—')
    return $result
  }

  # Numéro de tome : Vol.12, Tome 12, T12, T.12
  $volumeMatch = [regex]::Match($Title, '(?i)\bVol\.?\s*(\d+)\s*$')
  if (-not $volumeMatch.Success) { $volumeMatch = [regex]::Match($Title, '(?i)\bTome\s*(\d+)\s*$') }
  if (-not $volumeMatch.Success) { $volumeMatch = [regex]::Match($Title, '(?i)\bT\.?\s*(\d+)\s*$') }
  if ($volumeMatch.Success) {
    $result.volume = [int]$volumeMatch.Groups[1].Value
    $result.label = 'Tome ' + $result.volume
    $series = [regex]::Replace($Title, '(?i)\s*(?:\bVol\.?|\bTome|\bT\.?)\s*\d+\s*$', '')
    $result.series = $series.Trim(' ', '-', '–', '—')
    return $result
  }

  if ($Title -match '(?i)Intégrale') {
    $result.label = 'Intégrale'
    $result.series = [regex]::Replace($Title, '(?i)\s*-\s*Intégrale.*$', '').Trim(' ', '-', '–', '—')
    return $result
  }

  $result.series = $Title.Trim()
  return $result
}

function Normalize-Series {
  param([string]$Series)
  $editionTail = '(?i)\s*-\s*(?:Deluxe|Perfect Edition|Star Edition|Black Edition|Final Edition|Edition Perfect|Edition Prestige|Edition Immortelle|Edition Monarque|Smash édition|Édition double|Édition paillettes|Édition Collector|Edition Collector|Full Color.*|Gallery Edition.*|Nouvelle édition.*|Coffret.*|Intégrale.*|(?:Édition|Edition)\s+[^\-]+)$'
  $value = [regex]::Replace($Series, $editionTail, '')
  $value = [regex]::Replace($value, '\s*\([^)]*/[^)]*\)\s*', ' ')
  $value = [regex]::Replace($value, '\s+', ' ').Trim(' ', '-', '–', '—')
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
    [string]$Summary
  )
  $seriesClean = Normalize-Series $Series
  if (-not $seriesClean) { $seriesClean = $Title }
  $idBase = ($Kind + '|' + $seriesClean + '|' + $Volume + '|' + $Date + '|' + $Title).ToLowerInvariant()
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
# BDGest — calendrier franco-belge
# ---------------------------------------------------------
function Get-BdgestReleases {
  param([datetime]$Month)
  $items = New-Object System.Collections.Generic.List[object]
  $year = $Month.Year
  $monthNumber = $Month.Month
  $url = 'https://www.bdgest.com/sorties_bd?DL=' + $monthNumber.ToString('00') + '%2F' + $year
  $html = Get-Html $url

  $sections = [regex]::Matches($html, '(?s)<section class="bdg-cal-day".*?</section>')
  foreach ($section in $sections) {
    $s = $section.Value
    $idMatch = [regex]::Match($s, 'id="([^"]+)"')
    if (-not $idMatch.Success) { continue }
    $id = $idMatch.Groups[1].Value
    $date = $null

    if ($id -match '^j(\d{2})(\d{2})$') {
      $day = [int]$Matches[1]
      $sectionMonth = [int]$Matches[2]
      $sectionYear = $year
      if ($sectionMonth -lt ($monthNumber - 6)) { $sectionYear += 1 }
      elseif ($sectionMonth -gt ($monthNumber + 6)) { $sectionYear -= 1 }
      try { $date = [datetime]::new($sectionYear, $sectionMonth, $day) } catch { $date = $null }
    } elseif ($id -match '^m(\d{2})(\d{4})$') {
      $sectionMonth = [int]$Matches[1]
      $sectionYear = [int]$Matches[2]
      try { $date = [datetime]::new($sectionYear, $sectionMonth, 1) } catch { $date = $null }
    }

    if (-not $date) { continue }
    if ($date.Year -ge 2090) { continue }
    $dateText = $date.ToString('yyyy-MM-dd')

    $albums = [regex]::Matches($s, '(?s)<li>\s*<a class="cv bdt-img" href="([^"]+)" title="([^"]+)".*?<img src="([^"]+)"')
    foreach ($album in $albums) {
      $albumUrl = [System.Net.WebUtility]::HtmlDecode($album.Groups[1].Value)
      $rawTitle = [System.Net.WebUtility]::HtmlDecode($album.Groups[2].Value)
      $cover = [System.Net.WebUtility]::HtmlDecode($album.Groups[3].Value)
      if (-not $rawTitle) { continue }

      $tail = $s.Substring($album.Index)
      $editorMatch = [regex]::Match($tail, '(?s)<span class="ed">(.*?)</span>')
      $publisher = if ($editorMatch.Success) { Clean-Html $editorMatch.Groups[1].Value } else { '' }

      $volume = 0
      $label = ''
      $series = $rawTitle

      $hashMatch = [regex]::Match($rawTitle, '^(.*?)\s+#(\d+)\b(?:\s*-\s*.*)?$')
      if ($hashMatch.Success) {
        $series = $hashMatch.Groups[1].Value
        $volume = [int]$hashMatch.Groups[2].Value
        $label = 'Tome ' + $volume
      } else {
        $tomeMatch = [regex]::Match($rawTitle, '^(.*?)\s*[-–—]\s*Tome\s*(\d+)\b(?:\s*[-–—].*)?$')
        if ($tomeMatch.Success) {
          $series = $tomeMatch.Groups[1].Value
          $volume = [int]$tomeMatch.Groups[2].Value
          $label = 'Tome ' + $volume
        } elseif ($rawTitle -match '(?i)Intégrale') {
          $label = 'Intégrale'
          $series = [regex]::Replace($rawTitle, '(?i)\s*Intégrale.*$', '')
        }
      }

      $series = [regex]::Replace($series, '\s*\([^)]*/[^)]*\)\s*', ' ')
      $series = [regex]::Replace($series, '\s+', ' ').Trim(' ', '-', '–', '—')
      if (-not $series) { $series = $rawTitle }

      $items.Add((New-Release -Kind 'bd' -Series $series -Title $rawTitle -Volume $volume -Label $label -Date $dateText -Author '' -Publisher $publisher -Cover $cover -Url $albumUrl -Summary ''))
    }
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
      $key = $item.kind + '|' + $item.series.ToLowerInvariant() + '|' + $item.volume + '|' + $item.date
      if ($item.volume -eq 0) { $key += '|' + $item.title.ToLowerInvariant() }
      if ($seen.Add($key)) { $all.Add($item) }
    }
    Write-Host ("Manga-News {0:yyyy-MM} : {1} sorties" -f $month, $manga.Count)
  } catch {
    $errors += ('Manga-News ' + $month.ToString('yyyy-MM') + ' : ' + $_.Exception.Message)
    Write-Warning $errors[-1]
  }

  try {
    $bd = Get-BdgestReleases -Month $month
    foreach ($item in $bd) {
      $key = $item.kind + '|' + $item.series.ToLowerInvariant() + '|' + $item.volume + '|' + $item.date
      if ($item.volume -eq 0) { $key += '|' + $item.title.ToLowerInvariant() }
      if ($seen.Add($key)) { $all.Add($item) }
    }
    Write-Host ("BDGest {0:yyyy-MM} : {1} sorties" -f $month, $bd.Count)
  } catch {
    $errors += ('BDGest ' + $month.ToString('yyyy-MM') + ' : ' + $_.Exception.Message)
    Write-Warning $errors[-1]
  }
}

$sorted = @($all | Sort-Object { $_.date }, { $_.kind }, { $_.series }, { $_.volume })

$payload = [ordered]@{
  generated = $now.ToString('yyyy-MM-dd')
  updatedAt = $now.ToUniversalTime().ToString('o')
  sources   = @('Manga-News', 'BDGest')
  months    = @($months | ForEach-Object { $_.ToString('yyyy-MM') })
  errors    = @($errors)
  items     = $sorted
}

$json = $payload | ConvertTo-Json -Depth 6 -Compress
$js = @"
/* =========================================================
   BULLE — calendrier des sorties françaises
   Généré automatiquement le $($now.ToString('yyyy-MM-dd HH:mm')) UTC.
   Sources : Manga-News (mangas) · BDGest (BD franco-belge).
   Ne pas modifier à la main : relancer scripts/fetch-releases.ps1
   ========================================================= */
window.RELEASES = $json;
"@

$directory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
[IO.File]::WriteAllText($OutputPath, $js, (New-Object Text.UTF8Encoding($false)))

$mangaCount = @($sorted | Where-Object { $_.kind -eq 'manga' }).Count
$bdCount = @($sorted | Where-Object { $_.kind -eq 'bd' }).Count
Write-Host ""
Write-Host ("Calendrier écrit : {0}" -f $OutputPath)
Write-Host ("{0} sorties : {1} mangas, {2} BD" -f $sorted.Count, $mangaCount, $bdCount)
if ($errors.Count) {
  Write-Host ("{0} source(s) en erreur :" -f $errors.Count) -ForegroundColor Yellow
  $errors | ForEach-Object { Write-Host (' - ' + $_) -ForegroundColor Yellow }
}
