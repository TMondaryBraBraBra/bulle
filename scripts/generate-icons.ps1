param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-TailPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$scale) {
  $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
  $points = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF(($x + $w * 0.20), ($y + $h * 0.72))),
    (New-Object System.Drawing.PointF(($x + $w * 0.10), ($y + $h + 42 * $scale))),
    (New-Object System.Drawing.PointF(($x + $w * 0.42), ($y + $h * 0.92)))
  )
  $tail.AddPolygon($points)
  return $tail
}

function New-BulleIcon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = $size / 512.0
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $c1 = [System.Drawing.ColorTranslator]::FromHtml('#ff4d6d')
  $c2 = [System.Drawing.ColorTranslator]::FromHtml('#ff8a5b')
  $c3 = [System.Drawing.ColorTranslator]::FromHtml('#8b6cff')

  if ($maskable) {
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c3, 45.0)
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
    $blend.Colors = [System.Drawing.Color[]]@($c1, $c2, $c3)
    $blend.Positions = [float[]]@(0.0, 0.52, 1.0)
    $bg.InterpolationColors = $blend
    $g.FillRectangle($bg, $rect)
    $bg.Dispose()
  } else {
    $bgPath = New-RoundedRectPath 0 0 $size $size (108 * $scale)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c3, 45.0)
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
    $blend.Colors = [System.Drawing.Color[]]@($c1, $c2, $c3)
    $blend.Positions = [float[]]@(0.0, 0.52, 1.0)
    $bg.InterpolationColors = $blend
    $g.FillPath($bg, $bgPath)
    $bg.Dispose()
    $bgPath.Dispose()
  }

  $factor = if ($maskable) { 0.80 } else { 1.0 }
  $bw = 300 * $scale * $factor
  $bh = 212 * $scale * $factor
  $bx = ($size - $bw) / 2
  $by = ($size - $bh) / 2 - (18 * $scale * $factor)
  $br = 72 * $scale * $factor

  $bubble = New-RoundedRectPath $bx $by $bw $bh $br
  $tail = New-TailPath $bx $by $bw $bh $scale

  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
  $g.TranslateTransform(0, 10 * $scale)
  $g.FillPath($shadowBrush, $bubble)
  $g.FillPath($shadowBrush, $tail)
  $g.ResetTransform()
  $shadowBrush.Dispose()

  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPath($white, $bubble)
  $g.FillPath($white, $tail)
  $white.Dispose()
  $bubble.Dispose()
  $tail.Dispose()

  $dotR = 18 * $scale * $factor
  $dotY = $by + $bh / 2 - $dotR
  $gap = $bw * 0.20
  $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#0b0b12'))
  $startX = $bx + $bw / 2 - $gap
  for ($i = 0; $i -lt 3; $i++) {
    $cx = $startX + $i * $gap - $dotR
    $g.FillEllipse($dotBrush, [float]$cx, [float]$dotY, [float]($dotR * 2), [float]($dotR * 2))
  }
  $dotBrush.Dispose()

  $path = Join-Path $outDir $file
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "  $file ($size x $size)" -ForegroundColor DarkGray
}

Write-Host "Generation des icones Bulle..." -ForegroundColor Magenta
New-BulleIcon 512 'icon-512.png' $false
New-BulleIcon 192 'icon-192.png' $false
New-BulleIcon 512 'maskable-512.png' $true
New-BulleIcon 192 'maskable-192.png' $true
New-BulleIcon 180 'apple-touch-icon.png' $false
New-BulleIcon 32 'favicon-32.png' $false
Write-Host "OK -> $outDir" -ForegroundColor Green
