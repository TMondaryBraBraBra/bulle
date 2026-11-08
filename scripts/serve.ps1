param(
  [int]$Port = 5173,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = (Get-Location).Path }

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.mjs'  = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Impossible d'ouvrir $prefix" -ForegroundColor Red
  Write-Host "Essaie un autre port : .\scripts\serve.ps1 -Port 8080" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "  Bulle - serveur local" -ForegroundColor Magenta
Write-Host "  $prefix" -ForegroundColor Cyan
Write-Host "  Dossier : $root" -ForegroundColor DarkGray
Write-Host "  Ctrl+C pour arreter." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoOpen) { Start-Process $prefix | Out-Null }

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $relative = [Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }

    $candidate = Join-Path $root $relative
    $full = [IO.Path]::GetFullPath($candidate)
    if (-not $full.StartsWith([IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }

    if (Test-Path $full -PathType Container) {
      $full = Join-Path $full 'index.html'
    }

    if (-not (Test-Path $full -PathType Leaf)) {
      $response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('404 - introuvable')
      $response.ContentType = 'text/plain; charset=utf-8'
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
      continue
    }

    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $response.Headers.Set('Cache-Control', 'no-cache, no-store, must-revalidate')
    $response.Headers.Set('Service-Worker-Allowed', '/')

    try {
      $bytes = [IO.File]::ReadAllBytes($full)
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $response.StatusCode = 500
    } finally {
      $response.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
