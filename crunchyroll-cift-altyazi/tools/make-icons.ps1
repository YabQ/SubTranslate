# Eklenti simgelerini (16/32/48/128 px) üretir: koyu zemin üzerinde
# turuncu (çeviri) ve beyaz (orijinal) iki altyazı çubuğu.
# Kullanım: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

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

foreach ($size in 16, 32, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Chrome Web Magazasi: 128 px simgede 96x96 cizim + her yanda 16 px saydam bosluk
    $pad = if ($size -eq 128) { 16 } else { 0 }
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

    if ($size -ge 32) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 244, 117, 33)), ([single]($s / 40))
        $g.DrawPath($pen, $bg)
    }

    $file = Join-Path $outDir ("icon{0}.png" -f $size)
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "OK: $file"
}
