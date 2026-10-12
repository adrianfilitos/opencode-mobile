# make-qr.ps1 — genera un codigo QR (PNG) para una URL, para escanearlo con el movil.
# Uso:  powershell -File make-qr.ps1 -Url "http://192.168.1.100:49374/api/info"
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string]$Out,
  [int]$Size = 640
)

if (-not $Out) {
  $stem = ($Url -replace '[^A-Za-z0-9]+', '_').Trim('_')
  if ($stem.Length -gt 60) { $stem = $stem.Substring(0, 60) }
  $Out = Join-Path $PSScriptRoot ("qr_" + $stem + ".png")
}

$encoded = [System.Uri]::EscapeDataString($Url)
$api = "https://api.qrserver.com/v1/create-qr-code/?size=${Size}x${Size}&margin=12&data=$encoded"

try {
  Invoke-WebRequest -Uri $api -OutFile $Out -TimeoutSec 25 -UseBasicParsing
  Write-Host "OK  QR -> $Out"
  Write-Host "URL -> $Url"
} catch {
  Write-Host "ERROR generando el QR: $($_.Exception.Message)"
  exit 1
}
