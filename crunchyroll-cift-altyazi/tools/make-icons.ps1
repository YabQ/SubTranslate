# Eklenti simgelerini (16/32/48/128 px) ve Opera mağazasının istediği 64 px
# mağaza simgesini üretir: koyu zemin üzerinde turuncu (çeviri) ve beyaz
# (orijinal) iki altyazı çubuğu.
# Kullanım: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot '..\icons'
$storeDir = Join-Path $PSScriptRoot '..\store\gorseller\opera'
New-Item -ItemType Directory -Force $iconDir | Out-Null
New-Item -ItemType Directory -Force $storeDir | Out-Null

function New-RoundedRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [Math]::Min($r * 2, [Math]::Min($w, $h))
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Write-Icon([int]$size, [int]$pad, [string]$file) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $g.TranslateTransform($pad, $pad)
    $s = [single]($size - 2 * $pad)
    $bg = New-RoundedRect 0 0 ($s - 0.5) ($s - 0.5) ($s * 0.22)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF 0, 0), (New-Object System.Drawing.PointF $s, $s),
        [System.Drawing.Color]::FromArgb(255, 36, 38, 46), [System.Drawing.Color]::FromArgb(255, 18, 19, 24))
    $g.FillPath($bgBrush, $bg)

    $barH = [Math]::Max(2.4, $s * 0.14)
    $orange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 244, 117, 33))
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 246, 246, 248))
    $top = New-RoundedRect ($s * 0.24) ($s * 0.40) ($s * 0.52) $barH ($barH / 2)
    $bottom = New-RoundedRect ($s * 0.14) ($s * 0.62) ($s * 0.72) $barH ($barH / 2)
    $g.FillPath($orange, $top)
    $g.FillPath($white, $bottom)

    if ($s -ge 32) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 244, 117, 33)), ([single]($s / 40))
        $g.DrawPath($pen, $bg)
    }

    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "OK: $file"
}

# Eklenti simgeleri. Chrome Web Magazasi 128 px simgede 96x96 cizim +
# her yanda 16 px saydam bosluk istiyor, kucuk boyutlarda bosluk yok.
foreach ($size in 16, 32, 48, 128) {
    $pad = if ($size -eq 128) { 16 } else { 0 }
    Write-Icon $size $pad (Join-Path $iconDir ("icon{0}.png" -f $size))
}

# Opera magaza simgesi: 64x64, kucuk gorunecegi icin bosluksuz.
Write-Icon 64 0 (Join-Path $storeDir 'magaza-simgesi-64.png')
