# Detect the host's LAN IP, update .env, and start the stack.
# Run this instead of "docker compose up -d --build" when deploying on a new machine
# or after a network/IP change.

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Bluetooth|Teredo|VirtualBox|VMware|WSL'
  } |
  Select-Object -First 1).IPAddress

if (-not $ip) {
    Write-Warning 'Could not detect a LAN IP address - falling back to localhost.'
    $ip = 'localhost'
}

Write-Host "Detected server IP: $ip"

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-Error '.env not found. Copy .env.example and fill in your values first.'
    exit 1
}

$content = Get-Content $envFile
$content = $content -replace '^FRONTEND_URL=.*', "FRONTEND_URL=http://${ip}:3000"
$content = $content -replace '^API_URL=.*',      "API_URL=http://${ip}/api"
$content | Set-Content $envFile

Write-Host 'Updated .env:'
Write-Host "  FRONTEND_URL=http://${ip}:3000"
Write-Host "  API_URL=http://${ip}/api"
Write-Host ''

docker compose up -d --build
