# Builds data/covers-fr.js from Manga-News (French editions).
# Kept ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 files as ANSI.
param(
  [int]$Limit = 0,
  [string]$Only = ''
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$seedPath = Join-Path $root 'data\seed.js'
$outPath = Join-Path $root 'data\covers-fr.js'
$reportPath = Join-Path $root 'scripts\french-covers-report.json'
$cacheDir = Join-Path $env:TEMP 'bulle-mn-cache'
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir | Out-Null }

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
$BASE = 'https://www.manga-news.com/'

# Exact series URLs for titles the Manga-News search engine handles poorly.
$MANUAL_SERIES = @{
  'anilist:53390' = 'index.php/serie/Attaque-Des-Titans-l'
  'anilist:74489' = 'index.php/serie/Ere-des-cristaux-l'
  'anilist:101583' = 'index.php/serie/Sexy-Cosplay-Doll'
  'anilist:30651' = 'index.php/serie/Nausicaa'
  'anilist:31325' = 'index.php/serie/Phenix-Loiseau-de-feu'
  'anilist:54705' = 'index.php/serie/Fleurs-du-mal'
  'anilist:99324' = 'index.php/serie/Iruma-a-lecole-des-demons'
  'anilist:30044' = 'index.php/serie/Gintama'
  'anilist:100664' = 'index.php/serie/Miss-Nagatoro'
  'anilist:87395' = 'index.php/serie/Grand-Blue4'
  'anilist:87225' = 'index.php/serie/Tsukimichi-Moonlit-Fantasy'
  'anilist:31706' = 'index.php/serie/Jojos-bizarre-adventure-Steel-Ball-Run'
  'anilist:39982' = 'index.php/serie/Usogui'
  'anilist:31303' = 'index.php/serie/Ashita-no-Joe'
  'anilist:30003' = 'index.php/serie/20th-century-boys'
  'anilist:30021' = 'index.php/serie/Death-Note'
  'anilist:30042' = 'index.php/serie/Dragon-Ball'
  'anilist:30002' = 'index.php/serie/Berserk-2Ed'
  'anilist:30001' = 'index.php/serie/Monster'
  'anilist:30664' = 'index.php/serie/Akira'
  'anilist:30656' = 'index.php/serie/Vagabond'
  'anilist:30028' = 'index.php/serie/Nana'
  'anilist:30657' = 'index.php/serie/Real'
  'anilist:30026' = 'index.php/serie/Hunter-X-hunter'
  'anilist:98263' = 'index.php/serie/Atelier-des-sorciers-l'
  'anilist:97852' = 'index.php/serie/Komi-cherche-ses-mots'
  'anilist:30584' = 'index.php/serie/Mirai-Nikki-Le-journal-du-futur'
  'anilist:30436' = 'index.php/serie/Spirale'
  'anilist:149544' = 'index.php/serie/The-Guy-She-Was-Interested-in-Wasnt-a-Guy-at-All'
  'anilist:122344' = 'index.php/serie/Magical-Revolution-La-Princesse-reincarnee-et-la-jeune-prodige'
  'anilist:87216' = 'index.php/serie/Rodeurs-de-la-nuit-les'
}

# Titles that must not inherit another series' French edition.
$EXCLUDED = @(
  'anilist:135129', # Vagabond: Saigo no Manga-ten (artbook)
  'anilist:97553'   # Three Days of Happiness (no French edition found)
)

# Extra search terms for titles whose French name differs from AniList's title.
$ALIASES = @{
  'anilist:53390' = @('Attaque des Titans')
  'anilist:74489' = @('Ere des cristaux')
  'anilist:101583' = @('Sexy Cosplay Doll')
  'anilist:30651' = @('Nausicaa')
  'anilist:31325' = @('Phenix oiseau de feu')
  'anilist:54705' = @('Fleurs du mal')
  'anilist:99324' = @('Iruma ecole des demons')
  'anilist:30044' = @('Gintama')
  'anilist:100664' = @('Nagatoro')
  'anilist:87395' = @('Grand Blue')
  'anilist:87225' = @('Tsukimichi')
  'anilist:31706' = @('Jojo Steel Ball Run')
  'anilist:30003' = @('20th Century Boys')
  'anilist:30021' = @('Death Note')
  'anilist:30042' = @('Dragon Ball')
  'anilist:30002' = @('Berserk')
  'anilist:30001' = @('Monster Urasawa')
  'anilist:30664' = @('Akira')
  'anilist:30656' = @('Vagabond Inoue')
  'anilist:30028' = @('Nana Yazawa')
  'anilist:30657' = @('Real Inoue')
}

function Read-Seed {
  $raw = [IO.File]::ReadAllText($seedPath, [Text.Encoding]::UTF8)
  $start = $raw.IndexOf('window.SEED')
  if ($start -lt 0) { throw 'window.SEED introuvable.' }
  $json = $raw.Substring($start + 'window.SEED'.Length).Trim()
  $json = $json.Substring($json.IndexOf('{')).Trim().TrimEnd(';')
  return $json | ConvertFrom-Json
}

function Get-CachePath([string]$url) {
  $md5 = [Security.Cryptography.MD5]::Create()
  $bytes = [Text.Encoding]::UTF8.GetBytes($url)
  $hash = [BitConverter]::ToString($md5.ComputeHash($bytes)).Replace('-', '')
  return Join-Path $cacheDir ($hash + '.html')
}

function Get-Html([string]$url, [switch]$NoCache) {
  $cachePath = Get-CachePath $url
  if (-not $NoCache -and (Test-Path $cachePath)) {
    return [IO.File]::ReadAllText($cachePath, [Text.Encoding]::UTF8)
  }
  $tmp = Join-Path $cacheDir ([guid]::NewGuid().ToString('N') + '.tmp')
  $attempts = 0
  while ($true) {
    $attempts += 1
    curl.exe -s -L --compressed -A $UA -o $tmp $url | Out-Null
    if (Test-Path $tmp) {
      $html = [IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      if ($html.Length -gt 800 -and $html -notmatch 'Acces refuse|Access denied|403 Forbidden') {
        [IO.File]::WriteAllText($cachePath, $html, [Text.Encoding]::UTF8)
        Start-Sleep -Milliseconds 900
        return $html
      }
    }
    if ($attempts -ge 4) { throw ('Page vide ou refusee : ' + $url) }
    Start-Sleep -Seconds (2 * $attempts)
  }
}

function Strip-Tags([string]$value) {
  if (-not $value) { return '' }
  $value = $value -replace '<br\s*/?>', ' '
  $value = $value -replace '<[^>]+>', ''
  $value = $value -replace '&amp;', '&' -replace '&quot;', '"' -replace '&#0?39;', "'" -replace '&apos;', "'" -replace '&lt;', '<' -replace '&gt;', '>'
  $value = $value -replace '&nbsp;', ' '
  return ($value -replace '\s+', ' ').Trim()
}

function Clean-FrenchTitle([string]$value) {
  if (-not $value) { return '' }
  $title = $value.Trim()
  $match = [regex]::Match($title, '^(.*?)\s*\((l''|le|la|les)\)\s*$', 'IgnoreCase')
  if ($match.Success) {
    $rest = $match.Groups[1].Value.Trim()
    $article = $match.Groups[2].Value.ToLowerInvariant()
    if ($article -eq "l'") { return "L'" + $rest }
    $article = $article.Substring(0, 1).ToUpperInvariant() + $article.Substring(1)
    return $article + ' ' + $rest
  }
  return $title
}

function Normalize([string]$value) {
  if (-not $value) { return '' }
  $formD = $value.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $formD.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
  }
  $text = $sb.ToString().ToLowerInvariant()
  $text = $text -replace '&amp;', '&' -replace '&#0?39;', "'"
  $text = $text -replace '[^a-z0-9]+', ' '
  return $text.Trim()
}

function TitleScore([string]$left, [string]$right) {
  $a = Normalize $left
  $b = Normalize $right
  if (-not $a -or -not $b) { return 0 }
  if ($a -eq $b) { return 100 }
  if ($a.Contains($b) -or $b.Contains($a)) { return 88 }
  $ta = @($a.Split(' ') | Where-Object { $_.Length -gt 1 })
  $tb = @($b.Split(' ') | Where-Object { $_.Length -gt 1 })
  if (-not $ta.Count -or -not $tb.Count) { return 0 }
  $common = 0
  foreach ($token in $ta) { if ($tb -contains $token) { $common += 1 } }
  return [Math]::Round(100 * $common / [Math]::Max($ta.Count, $tb.Count))
}

function Search-Series([string]$query) {
  $url = $BASE + 'index.php/recherche/?q=' + [uri]::EscapeDataString($query) + '&cat=manga-serie-vf'
  $html = Get-Html $url
  $matches = [regex]::Matches($html, '(?s)<li class="resManga">.*?<a href="([^"]+)"[^>]*>.*?<img src="([^"]+)".*?<span class="searchTitle">(.*?)</span>.*?<span class="searchAut">(.*?)</span>')
  $out = @()
  foreach ($match in $matches) {
    $title = Strip-Tags $match.Groups[3].Value
    $title = $title -replace '\s*\(\d{4}\)\s*$', ''
    $out += [pscustomobject]@{
      title = $title
      author = Strip-Tags $match.Groups[4].Value
      url = $match.Groups[1].Value
      image = $match.Groups[2].Value
    }
  }
  return $out
}

function Get-SeriesDetails([string]$url) {
  $html = Get-Html $url
  $title = ''
  $match = [regex]::Match($html, '(?s)<h1 class="entry-page-title">(.*?)</h1>')
  if ($match.Success) { $title = Strip-Tags $match.Groups[1].Value }
  if (-not $title) {
    $match = [regex]::Match($html, '(?s)<li class="trad">.*?<strong>Titre traduit</strong>.*?<span class="entry-data-wrapper">\s*:\s*(.*?)</span>')
    if ($match.Success) { $title = Strip-Tags $match.Groups[1].Value }
  }

  $altTitle = ''
  $match = [regex]::Match($html, '(?s)<h2 class="entry-page-title-trad">(.*?)</h2>')
  if ($match.Success) { $altTitle = Strip-Tags $match.Groups[1].Value }

  $title = Clean-FrenchTitle $title
  $altTitle = Clean-FrenchTitle $altTitle

  $cover = ''
  $match = [regex]::Match($html, '<img class="entryPicture" src="([^"]+)"')
  if ($match.Success) { $cover = $match.Groups[1].Value }

  $description = ''
  $match = [regex]::Match($html, '(?s)<div id="summary".*?<div class="bigsize">(.*?)</div>')
  if ($match.Success) { $description = Strip-Tags $match.Groups[1].Value }

  $publisher = ''
  $match = [regex]::Match($html, '(?s)<li class="book-edit-vf">.*?<span class="entry-data-wrapper">(.*?)</span>')
  if ($match.Success) {
    $pub = [regex]::Match($match.Groups[1].Value, '>([^<>]+)</a>')
    if ($pub.Success) { $publisher = Strip-Tags $pub.Groups[1].Value }
  }

  $genres = @()
  $match = [regex]::Match($html, '(?s)<li class="book-genre">(.*?)</li>')
  if ($match.Success) {
    foreach ($genre in [regex]::Matches($match.Groups[1].Value, '>([^<>]+)</a>')) {
      $value = Strip-Tags $genre.Groups[1].Value
      if ($value -and $genres -notcontains $value) { $genres += $value }
    }
  }

  $year = $null
  $match = [regex]::Match($html, '(?s)<li class="book-origin">.*?</span>\s*([A-Za-z]+)\s*-\s*(\d{4})')
  if ($match.Success) { $year = [int]$match.Groups[2].Value }

  return [pscustomobject]@{
    title = $title
    altTitle = $altTitle
    cover = $cover
    description = $description
    publisher = $publisher
    genres = $genres
    year = $year
  }
}

function Get-VolumeCovers([string]$seriesUrl) {
  $editionsUrl = $seriesUrl -replace '/serie/', '/serie/editions/'
  $html = Get-Html $editionsUrl
  $volumes = @{}
  $blocks = [regex]::Matches($html, '(?s)<div class="serieVolumesImgBlock list-1-item">(.*?)</div>')
  foreach ($block in $blocks) {
    $numberMatch = [regex]::Match($block.Groups[1].Value, '/vol-([0-9]+)')
    $imageMatch = [regex]::Match($block.Groups[1].Value, '<img src="([^"]+)"')
    if (-not $numberMatch.Success -or -not $imageMatch.Success) { continue }
    $number = [int]$numberMatch.Groups[1].Value
    $cover = $imageMatch.Groups[1].Value
    if ($number -gt 0 -and -not $volumes.ContainsKey($number)) {
      $volumes[$number] = $cover
    }
  }
  return $volumes
}

function Get-AniListTitles {
  $seed = Read-Seed
  $items = @{}
  foreach ($row in $seed.rows) {
    foreach ($item in $row.items) {
      if (-not $items.ContainsKey($item.id)) { $items[$item.id] = $item }
    }
  }
  $ids = @($items.Values | Where-Object { $_.kind -eq 'manga' -and $_.source -eq 'anilist' } | ForEach-Object { [int]($_.id -replace 'anilist:', '') })
  $all = @()
  for ($i = 0; $i -lt $ids.Count; $i += 50) {
    $chunk = $ids[$i..([Math]::Min($i + 49, $ids.Count - 1))]
    $query = 'query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:MANGA){id title{romaji english native} synonyms}}}'
    $body = @{ query = $query; variables = @{ ids = $chunk } } | ConvertTo-Json -Depth 6 -Compress
    $response = Invoke-RestMethod -Uri 'https://graphql.anilist.co' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60
    $all += $response.data.Page.media
    Start-Sleep -Milliseconds 700
  }
  return [pscustomobject]@{ items = $items; anilist = $all }
}

function Expand-ReportEntries($node, [System.Collections.ArrayList]$target) {
  if ($null -eq $node) { return }
  if ($node -is [System.Array]) {
    foreach ($child in $node) { Expand-ReportEntries $child $target }
    return
  }
  $names = @($node.PSObject.Properties.Name)
  if (($names -contains 'value') -and ($names -contains 'Count')) {
    Expand-ReportEntries $node.value $target
    return
  }
  if ($names -contains 'id') { [void]$target.Add($node) }
}

function Add-SearchTerms([System.Collections.ArrayList]$terms, [string]$value) {  if (-not $value) { return }
  $value = $value.Trim()
  if ($value.Length -lt 2) { return }
  if ($value -match '[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]') { return }
  if (-not ($terms -contains $value)) { [void]$terms.Add($value) }
}

function Main {
  $source = Get-AniListTitles
  $anilistById = @{}
  foreach ($media in $source.anilist) { $anilistById[[string]$media.id] = $media }

  $output = [ordered]@{}
  $report = @()
  $partial = [bool]($Only -or $Limit -gt 0)

  if ($partial -and (Test-Path $outPath)) {
    $rawExisting = [IO.File]::ReadAllText($outPath, [Text.Encoding]::UTF8)
    $startExisting = $rawExisting.IndexOf('window.FR_COVERS')
    if ($startExisting -ge 0) {
      $jsonExisting = $rawExisting.Substring($startExisting + 'window.FR_COVERS'.Length).Trim()
      $jsonExisting = $jsonExisting.Substring($jsonExisting.IndexOf('{')).Trim().TrimEnd(';')
      $existing = $jsonExisting | ConvertFrom-Json
      foreach ($prop in $existing.PSObject.Properties) { $output[$prop.Name] = $prop.Value }
    }
  }
  if ($partial -and (Test-Path $reportPath)) {
    $rawReport = [IO.File]::ReadAllText($reportPath, [Text.Encoding]::UTF8)
    if ($rawReport.Trim()) {
      $parsedReport = $rawReport | ConvertFrom-Json
      $reportList = New-Object System.Collections.ArrayList
      Expand-ReportEntries $parsedReport $reportList
      $report = @($reportList)
    }
  }

  $manga = @($source.items.Values | Where-Object { $_.kind -eq 'manga' -and $_.source -eq 'anilist' } | Sort-Object title)
  if ($Only) {
    $needles = @($Only -split '\|' | ForEach-Object { Normalize $_ } | Where-Object { $_ })
    $manga = @($manga | Where-Object {
      $titleNorm = Normalize $_.title
      $idNorm = Normalize $_.id
      $hit = $false
      foreach ($needle in $needles) {
        if ($titleNorm.Contains($needle) -or $idNorm.Contains($needle)) { $hit = $true; break }
      }
      $hit
    })
  }
  if ($Limit -gt 0) { $manga = @($manga | Select-Object -First $Limit) }
  $index = 0

  foreach ($item in $manga) {
    $index += 1
    $number = $item.id -replace 'anilist:', ''
    $media = $anilistById[$number]
    $terms = New-Object System.Collections.ArrayList
    if ($ALIASES.ContainsKey($item.id)) {
      foreach ($alias in $ALIASES[$item.id]) { Add-SearchTerms $terms $alias }
    }
    if ($media) {
      Add-SearchTerms $terms $media.title.english
      Add-SearchTerms $terms $media.title.romaji
      Add-SearchTerms $terms $media.title.native
      foreach ($synonym in @($media.synonyms)) { Add-SearchTerms $terms $synonym }
    }
    Add-SearchTerms $terms $item.title

    $candidates = @()
    $seenUrls = @{}
    foreach ($term in $terms) {
      try {
        $results = Search-Series $term
      } catch {
        Write-Warning ("Recherche impossible pour {0} ({1}) : {2}" -f $item.title, $term, $_.Exception.Message)
        continue
      }
      foreach ($result in $results) {
        if ($seenUrls.ContainsKey($result.url)) { continue }
        $seenUrls[$result.url] = $true
        $score = TitleScore $item.title $result.title
        foreach ($alias in @($ALIASES[$item.id])) {
          $aliasScore = TitleScore $alias $result.title
          if ($aliasScore -gt $score) { $score = $aliasScore }
        }
        $penalty = 0
        if ($result.title -match '(?i)roman|artbook|anthologie|spin.?off|gag|light.?novel|fanbook|guide|philosophie|encyclopedie|illustration|novel|coffret|integrale|edition collector|compilation') { $penalty = 30 }
        $candidates += [pscustomobject]@{
          title = $result.title
          author = $result.author
          url = $result.url
          score = [Math]::Max(0, $score - $penalty)
        }
      }
      if (($candidates | Measure-Object -Property score -Maximum).Maximum -ge 95) { break }
      Start-Sleep -Milliseconds 250
    }

    $candidates = @($candidates | Sort-Object -Property score -Descending | Select-Object -First 8)
    $chosen = $null
    $details = $null
    $volumes = @{}
    $expected = if ($item.volumes) { [int]$item.volumes } else { 0 }
    $excluded = $EXCLUDED -contains $item.id

    if (-not $excluded -and $MANUAL_SERIES.ContainsKey($item.id)) {
      $manualUrl = $BASE + $MANUAL_SERIES[$item.id]
      try {
        $details = Get-SeriesDetails $manualUrl
        $volumes = Get-VolumeCovers $manualUrl
        if ($volumes.Count) {
          if (-not $details.title) { $details.title = $item.title }
          $chosen = [pscustomobject]@{ title = $details.title; url = $manualUrl; score = 100 }
        }
      } catch {
        Write-Warning ("Serie manuelle impossible pour {0} : {1}" -f $item.title, $_.Exception.Message)
      }
    }

    if (-not $chosen -and -not $excluded) {
      foreach ($candidate in $candidates) {
        if ($candidate.score -lt 55) { continue }
        try {
          $candidateDetails = Get-SeriesDetails $candidate.url
          $candidateVolumes = Get-VolumeCovers $candidate.url
          if (-not $candidateDetails.title -or $candidateVolumes.Count -lt 1) { continue }
          if ($expected -gt 0 -and $candidateVolumes.Count -lt [Math]::Max(2, [Math]::Floor($expected * 0.35))) { continue }
          $chosen = $candidate
          $details = $candidateDetails
          $volumes = $candidateVolumes
          break
        } catch {
          Write-Warning ("Fiche impossible pour {0} : {1}" -f $candidate.url, $_.Exception.Message)
        }
      }
    }

    $status = 'unmatched'
    if ($excluded) {
      $output.Remove($item.id)
    } elseif ($chosen -and $details) {
      if (-not $details.title) { $details.title = $item.title }
      $status = 'matched'
      $volumeMap = [ordered]@{}
      foreach ($key in ($volumes.Keys | Sort-Object)) { $volumeMap[[string]$key] = $volumes[$key] }
      $output[$item.id] = [ordered]@{
        title = $details.title
        altTitle = $details.altTitle
        cover = $details.cover
        publisher = $details.publisher
        description = $details.description
        genres = @($details.genres)
        year = $details.year
        url = $chosen.url
        volumes = $volumeMap
      }
    }

    $report = @($report | Where-Object { $_.id -ne $item.id })
    $report += [pscustomobject]@{
      id = $item.id
      title = $item.title
      expectedVolumes = $item.volumes
      status = $status
      matchedTitle = if ($details) { $details.title } else { '' }
      matchedUrl = if ($chosen) { $chosen.url } else { '' }
      cover = if ($details) { $details.cover } else { '' }
      volumeCovers = $volumes.Count
      candidates = @($candidates | Select-Object -First 4)
    }

    Write-Host ("[{0}/{1}] {2} -> {3} ({4} volumes)" -f $index, $manga.Count, $item.title, $status, $volumes.Count)
  }

  # Final guard: never ship a French edition for explicitly excluded titles.
  foreach ($id in $EXCLUDED) { $output.Remove($id) }

  $lines = @()
  $lines += '/* French edition covers and volume covers - generated from Manga-News.'
  $lines += '   Do not edit by hand: run scripts/fetch-french-covers.ps1 */'
  $lines += 'window.FR_COVERS = ' + ($output | ConvertTo-Json -Depth 8) + ';'
  [IO.File]::WriteAllText($outPath, ($lines -join "`r`n"), [Text.Encoding]::UTF8)

  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8
  $reportTotal = @($report).Count
  $reportMatched = @($report | Where-Object { $_.status -eq 'matched' }).Count
  Write-Host ('OK : {0} series avec jaquettes FR, {1} sans correspondance sur {2}.' -f $reportMatched, ($reportTotal - $reportMatched), $reportTotal)
  Write-Host ('Ecrit : ' + $outPath)
  Write-Host ('Rapport : ' + $reportPath)
}

Main
