# Generate app icons and avatar (deterministic, no external services)
# Usage: powershell -ExecutionPolicy Bypass -File gen-icons.ps1
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Save-MasterIcon {
    param([string]$Path, [int]$Size)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Full-bleed background (iOS applies its own rounded mask)
    $bgColor = [System.Drawing.Color]::FromArgb(46, 125, 91)
    $bg = New-Object System.Drawing.SolidBrush -ArgumentList @($bgColor)
    $g.FillRectangle($bg, 0, 0, $Size, $Size)

    # Amber accent dot, top-right
    $dotColor = [System.Drawing.Color]::FromArgb(217, 118, 63)
    $dot = New-Object System.Drawing.SolidBrush -ArgumentList @($dotColor)
    $d = [int]($Size * 0.18)
    $g.FillEllipse($dot, [int]($Size * 0.72), [int]($Size * 0.10), $d, $d)

    # Centered white character
    $fontSize = [float]($Size * 0.52)
    $font = New-Object System.Drawing.Font -ArgumentList @("Microsoft YaHei", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.Brushes]::White
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
    $g.DrawString([char]0x660E, $font, $brush, $rect, $fmt)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

function Save-Avatar {
    param([string]$Path, [int]$Size)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Amber circle with white character
    $circleColor = [System.Drawing.Color]::FromArgb(217, 118, 63)
    $circle = New-Object System.Drawing.SolidBrush -ArgumentList @($circleColor)
    $pad = [int]($Size * 0.02)
    $g.FillEllipse($circle, $pad, $pad, $Size - 2 * $pad, $Size - 2 * $pad)

    $fontSize = [float]($Size * 0.50)
    $font = New-Object System.Drawing.Font -ArgumentList @("Microsoft YaHei", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.Brushes]::White
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
    $g.DrawString([char]0x660E, $font, $brush, $rect, $fmt)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

function Resize-Icon {
    param([string]$Source, [string]$Path, [int]$Size)
    $src = [System.Drawing.Image]::FromFile($Source)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $Size, $Size)
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $src.Dispose()
}

$master = Join-Path $scriptDir "icon-1024.png"
Save-MasterIcon -Path $master -Size 1024
Resize-Icon -Source $master -Path (Join-Path $scriptDir "icon-180.png") -Size 180
Resize-Icon -Source $master -Path (Join-Path $scriptDir "icon-192.png") -Size 192
Resize-Icon -Source $master -Path (Join-Path $scriptDir "icon-512.png") -Size 512
Save-Avatar -Path (Join-Path $scriptDir "avatar.png") -Size 512

Write-Output "ICONS_GENERATED"
