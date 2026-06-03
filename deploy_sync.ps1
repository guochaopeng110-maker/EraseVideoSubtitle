# deploy_sync.ps1
$srcDir = "f:\Projects\Interective-Video\EraseVideoSubtitle"
$destDir = "E:\InnoSetupPackages\EraseSubtitle"
$appDestDir = "$destDir\app"

Write-Host "Starting sync from Next.js standalone build to deployment directory..." -ForegroundColor Cyan

# Ensure destination exists
if (!(Test-Path $appDestDir)) {
    New-Item -ItemType Directory -Force -Path $appDestDir
}

# 1. Copy standalone files
Write-Host "Copying standalone build files..."
Copy-Item -Path "$srcDir\.next\standalone\*" -Destination $appDestDir -Recurse -Force

# 2. Copy static files
Write-Host "Copying static files to .next/static..."
$staticDest = "$appDestDir\.next\static"
if (!(Test-Path $staticDest)) {
    New-Item -ItemType Directory -Force -Path $staticDest
}
Copy-Item -Path "$srcDir\.next\static\*" -Destination $staticDest -Recurse -Force

# 3. Copy public files
Write-Host "Copying public folder assets..."
$publicDest = "$appDestDir\public"
if (!(Test-Path $publicDest)) {
    New-Item -ItemType Directory -Force -Path $publicDest
}
Copy-Item -Path "$srcDir\public\*" -Destination $publicDest -Recurse -Force

Write-Host "Synchronization complete!" -ForegroundColor Green
