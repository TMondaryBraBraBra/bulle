# Generates data/seed.js from AniList (manga) + Open Library (BD/comics)
# Kept ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 files as ANSI.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'data'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function Read-JsonFile([string]$path) {
  $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  return $raw.TrimStart([char]0xFEFF) | ConvertFrom-Json
}

function Get-WebJson([string]$url) {
  $lastError = $null
  for ($i = 0; $i -lt 3; $i++) {
    try {
      $res = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ 'User-Agent' = 'BulleCatalogDemo/1.0 (personal use)' } -TimeoutSec 40
      $raw = [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
      return $raw.TrimStart([char]0xFEFF) | ConvertFrom-Json
    } catch {
      $lastError = $_
      Start-Sleep -Milliseconds 1500
    }
  }
  throw $lastError
}

function Clean-Text([string]$s) {
  if (-not $s) { return '' }
  $s = $s -replace '<br\s*/?>', ' '
  $s = $s -replace '<[^>]+>', ''
  $s = $s -replace '&amp;', '&' -replace '&quot;', '"' -replace '&#039;', "'" -replace '&apos;', "'" -replace '&lt;', '<' -replace '&gt;', '>'
  $s = $s -replace '\s+', ' '
  return $s.Trim()
}

function Normalize-Text([string]$s) {
  if (-not $s) { return '' }
  return ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLower()
}

function Get-AniList([string]$genre, [string]$sort, [int]$perPage = 16) {
  $q = @'
query ($page: Int, $perPage: Int, $genre: String, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(genre: $genre, type: MANGA, sort: $sort, isAdult: false, countryOfOrigin: "JP", format_in: [MANGA, ONE_SHOT]) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      description
      genres
      format
      status
      volumes
      chapters
      averageScore
      popularity
      startDate { year }
      siteUrl
      staff(perPage: 3) { edges { role node { name { full } } } }
    }
  }
}
'@
  $vars = @{ page = 1; perPage = $perPage }
  if ($genre) { $vars.genre = $genre }
  if ($sort) { $vars.sort = @($sort) }
  $body = @{ query = $q; variables = $vars } | ConvertTo-Json -Depth 8 -Compress
  $res = Invoke-WebRequest -UseBasicParsing -Uri 'https://graphql.anilist.co' -Method POST -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 40
  $raw = [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
  $json = $raw.TrimStart([char]0xFEFF) | ConvertFrom-Json
  if ($json.errors) { throw ($json.errors | ConvertTo-Json -Compress) }
  return $json.data.Page.media
}

function Convert-AniListItem($m) {
  $title = $m.title.english
  if (-not $title) { $title = $m.title.romaji }
  if (-not $title) { $title = $m.title.native }
  $authors = @()
  if ($m.staff -and $m.staff.edges) {
    foreach ($e in $m.staff.edges) {
      if ($e.node.name.full -and ($authors -notcontains $e.node.name.full)) { $authors += $e.node.name.full }
    }
  }
  $desc = Clean-Text $m.description
  if ($desc.Length -gt 1100) { $desc = $desc.Substring(0, 1100).TrimEnd() + '...' }
  $cover = $m.coverImage.extraLarge
  if (-not $cover) { $cover = $m.coverImage.large }
  return [pscustomobject]@{
    id          = "anilist:$($m.id)"
    source      = 'anilist'
    kind        = 'manga'
    subtype     = 'Manga'
    title       = $title
    author      = ($authors -join ', ')
    cover       = $cover
    banner      = $m.bannerImage
    description = $desc
    genres      = @($m.genres)
    year        = $m.startDate.year
    volumes     = $m.volumes
    chapters    = $m.chapters
    score       = $m.averageScore
    popularity  = $m.popularity
    siteUrl     = $m.siteUrl
    accent      = $m.coverImage.color
  }
}

$rows = @()
$seen = @{}

Write-Host 'Fetching manga from AniList...'
$mangaRows = Read-JsonFile (Join-Path $PSScriptRoot 'manga-rows.json')
foreach ($row in $mangaRows) {
  try {
    $media = Get-AniList -genre $row.genre -sort $row.sort -perPage 16
    $items = @()
    foreach ($m in $media) {
      $it = Convert-AniListItem $m
      if ($seen.ContainsKey($it.id)) { continue }
      $seen[$it.id] = $true
      $items += $it
      if ($items.Count -ge 14) { break }
    }
    if ($items.Count -ge 6) {
      $rows += [pscustomobject]@{
        id       = $row.id
        title    = $row.title
        subtitle = $row.subtitle
        kind     = 'manga'
        items    = $items
      }
      Write-Host ("  {0}: {1} items" -f $row.id, $items.Count)
    }
  } catch {
    Write-Warning ("  AniList failed for {0}: {1}" -f $row.id, $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 450
}

# ---------- BD / comics via Open Library ----------
$bd = Read-JsonFile (Join-Path $PSScriptRoot 'bd-list.json')
$byCat = @{ franco = @(); graphic = @(); comics = @() }

Write-Host 'Fetching BD from Open Library...'
foreach ($entry in $bd) {
  $baseUrl = 'https://openlibrary.org/search.json?q=' + [Uri]::EscapeDataString($entry.query) + '&limit=8&fields=key,title,author_name,cover_i,first_publish_year,subject,first_sentence'
  $urls = @()
  if ($entry.cat -eq 'franco') { $urls += ($baseUrl + '&language=fre') }
  $urls += $baseUrl
  $tokens = @($entry.query -split '[^a-zA-Z0-9]+' | Where-Object { $_.Length -ge 4 })
  $normTokens = @($tokens | ForEach-Object { Normalize-Text $_ })
  $doc = $null
  try {
    foreach ($u in $urls) {
      try { $data = Get-WebJson $u } catch { continue }
      foreach ($d in $data.docs) {
        if (-not $d.cover_i -or -not $d.title) { continue }
        $lower = Normalize-Text $d.title
        $hit = $false
        foreach ($tok in $normTokens) {
          if ($lower.Contains($tok)) { $hit = $true; break }
        }
        if ($hit) { $doc = $d; break }
      }
      if ($doc) { break }
    }
    if (-not $doc) { Write-Warning ("  no good match for {0}" -f $entry.title); continue }
    $desc = ''
    if ($doc.first_sentence) { $desc = Clean-Text ($doc.first_sentence -join ' ') }
    $authors = ''
    if ($doc.author_name) { $authors = ($doc.author_name | Select-Object -First 2) -join ', ' }
    $subtype = switch ($entry.cat) { 'franco' { 'Franco-belge' } 'graphic' { 'Roman graphique' } default { 'Comics' } }
    $key = "$($doc.key)" -replace '/works/', ''
    $item = [pscustomobject]@{
      id          = "ol:$key"
      source      = 'openlibrary'
      kind        = 'bd'
      subtype     = $subtype
      title       = $entry.title
      author      = $authors
      cover       = "https://covers.openlibrary.org/b/id/$($doc.cover_i)-L.jpg"
      banner      = $null
      description = $desc
      genres      = @($subtype)
      year        = $doc.first_publish_year
      volumes     = $null
      chapters    = $null
      score       = $null
      popularity  = $null
      siteUrl     = "https://openlibrary.org/$($doc.key)"
      accent      = $null
    }
    $byCat[$entry.cat] += $item
    Write-Host ("  {0} -> {1}" -f $entry.title, $doc.title)
  } catch {
    Write-Warning ("  OL failed for {0}: {1}" -f $entry.title, $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 350
}

$bdRows = Read-JsonFile (Join-Path $PSScriptRoot 'bd-rows.json')
foreach ($r in $bdRows) {
  $items = @($byCat[$r.cat] | Select-Object -First $r.max)
  if ($items.Count -ge 4) {
    $rows += [pscustomobject]@{
      id       = $r.id
      title    = $r.title
      subtitle = $r.subtitle
      kind     = 'bd'
      items    = $items
    }
    Write-Host ("  {0}: {1} items" -f $r.id, $items.Count)
  }
}

# ---------- Build catalog ----------
$catalog = @()
$seenAll = @{}
foreach ($row in $rows) {
  foreach ($it in $row.items) {
    if (-not $seenAll.ContainsKey($it.id)) {
      $seenAll[$it.id] = $true
      $catalog += $it
    }
  }
}

$seed = [pscustomobject]@{
  generated = (Get-Date).ToString('yyyy-MM-dd')
  rows      = $rows
  catalog   = $catalog
}

$json = $seed | ConvertTo-Json -Depth 12 -Compress
$header = '/* Demo catalog - generated ' + $seed.generated + ' from AniList and Open Library */'
$js = $header + "`r`nwindow.SEED = " + $json + ";`r`n"
$outFile = Join-Path $outDir 'seed.js'
[IO.File]::WriteAllText($outFile, $js, (New-Object Text.UTF8Encoding($false)))
Write-Host ("Wrote {0} rows, {1} unique items -> {2}" -f $rows.Count, $catalog.Count, $outFile)
