<#
.SYNOPSIS
  ccswitch — swap Claude Code auth profile (Windows / PowerShell port).

.DESCRIPTION
  Only replaces the `env` block in %USERPROFILE%\.claude\settings.json; leaves everything else intact.

  Profiles (priority order):
    9router  (DEFAULT)  https://9router.acegalaxy.co/v1   — remote router
    local               http://127.0.0.1:20128/v1         — local router (fallback 1)
    original            https://api.anthropic.com          — Anthropic direct (fallback 2)

  Aliases: router->local, direct->original (backward compat).

.EXAMPLE
  ccswitch                # show current + health of all profiles
  ccswitch 9router        # remote router (default)
  ccswitch local          # local :20128 router
  ccswitch original       # straight to api.anthropic.com
  ccswitch check          # probe health of every profile
  ccswitch fallback       # first healthy profile: 9router -> local -> original
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Command = "status"
)

$ErrorActionPreference = "Stop"
# Windows PowerShell 5.1: make sure TLS 1.2 is enabled for the health probes
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$Settings  = Join-Path $ClaudeDir "settings.json"
$Profiles  = Join-Path $ClaudeDir "profiles"
$Order     = @("9router", "local", "original")

function Die($msg) { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }

function Get-Canon($name) {
  switch ($name) {
    "router" { "local" }
    "direct" { "original" }
    default  { $name }
  }
}

# probe a profile's base url /models endpoint; returns http status code (string)
function Test-Profile($name) {
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { return "000" }
  try {
    $p = Get-Content $prof -Raw | ConvertFrom-Json
  } catch { return "000" }

  $base = if ($p.ANTHROPIC_BASE_URL) { $p.ANTHROPIC_BASE_URL } else { "https://api.anthropic.com" }
  $auth = if ($p.ANTHROPIC_AUTH_TOKEN) { $p.ANTHROPIC_AUTH_TOKEN } else { $p.ANTHROPIC_API_KEY }
  $url  = ($base.TrimEnd("/")) + "/models"

  $headers = @{}
  if ($auth) {
    $headers["Authorization"] = "Bearer $auth"
    if ($p.ANTHROPIC_API_KEY) { $headers["x-api-key"] = $p.ANTHROPIC_API_KEY }
  }
  # api.anthropic.com answers /v1/models only with the anthropic-version header;
  # without it a healthy endpoint false-reports DOWN.
  if ($base -like "*api.anthropic.com*") { $headers["anthropic-version"] = "2023-06-01" }
  # no -SkipHttpErrorCheck: that flag is PS7-only; catching the error works on 5.1 and 7
  try {
    $resp = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 4 -UseBasicParsing
    return [string][int]$resp.StatusCode
  } catch {
    $r = $_.Exception.Response
    if ($r -and $r.StatusCode) { return [string][int]$r.StatusCode }
    return "000"
  }
}

function Show-Current {
  $s = Get-Content $Settings -Raw | ConvertFrom-Json
  $base = if ($s.env.ANTHROPIC_BASE_URL) { $s.env.ANTHROPIC_BASE_URL } else { "https://api.anthropic.com (original)" }
  Write-Host "current base: $base"
}

function Show-Health {
  foreach ($p in $Order) {
    $c = Test-Profile $p
    $tag = if ($c -eq "200") { "OK" } else { "DOWN" }
    Write-Host "  $p`: $c $tag"
  }
}

function Set-ProfileEnv($rawName) {
  $name = Get-Canon $rawName
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { Die "profile not found: $prof" }
  if (-not (Test-Path $Settings)) { Die "settings not found: $Settings" }

  try {
    $profObj = Get-Content $prof -Raw | ConvertFrom-Json
  } catch { Die "profile $prof is not valid JSON" }

  Copy-Item $Settings "$Settings.bak" -Force
  $s = Get-Content $Settings -Raw | ConvertFrom-Json
  # Add-Member: plain `$s.env = ...` throws when settings.json has no env block yet
  $s | Add-Member -NotePropertyName env -NotePropertyValue $profObj -Force
  # depth 10 preserves nested hooks/permissions objects
  $s | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8

  Write-Host "✅ switched to '$name' profile (backup: $Settings.bak)" -ForegroundColor Green
  if ($name -eq "original" -and "$($s.env.ANTHROPIC_API_KEY)" -match "your-anthropic") {
    Write-Host "⚠️  original profile still has placeholder key — edit $Profiles\original.json then re-run." -ForegroundColor Yellow
  }
  Write-Host "↻ restart Claude Code (quit + reopen) to load new env."
}

switch ($Command) {
  { $_ -in @("9router", "local", "original", "router", "direct") } {
    $name = Get-Canon $Command
    $c = Test-Profile $name
    if ($c -ne "200") { Write-Host "⚠️  '$name' health=$c (not 200) — switching anyway, may be down" -ForegroundColor Yellow }
    Set-ProfileEnv $name
  }
  "check" { Show-Health }
  "fallback" {
    # Prefer first healthy router; `original` (Anthropic-direct) is the guaranteed
    # SAFE-HARBOR terminal: apply even if its probe ≠ 200, so Claude never stays
    # stuck on a dead router. Probe is advisory (can false-negative).
    foreach ($p in @("9router", "local")) {
      $c = Test-Profile $p
      if ($c -eq "200") { Write-Host "→ first healthy: $p"; Set-ProfileEnv $p; exit 0 }
      Write-Host "  $p down ($c), trying next…"
    }
    $oc = Test-Profile "original"
    if ($oc -eq "200") { Write-Host "→ safe-harbor: original ($oc)" }
    elseif ($oc -match '^4') { Write-Host "⚠️  original probe=$oc (key sai/placeholder) — vẫn switch, NHƯNG Claude sẽ lỗi tới khi điền ANTHROPIC_API_KEY thật vào profiles/original.json" -ForegroundColor Yellow }
    else { Write-Host "⚠️  original probe=$oc — forcing anyway (safe harbor; probe có thể false-negative)" -ForegroundColor Yellow }
    Set-ProfileEnv "original"
  }
  "clear" {
    if (-not (Test-Path $Settings)) { Die "settings not found: $Settings" }
    Copy-Item $Settings "$Settings.bak" -Force
    $s = Get-Content $Settings -Raw | ConvertFrom-Json
    if ($s.PSObject.Properties.Name -contains "env") { $s.PSObject.Properties.Remove("env") }
    $s | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8
    Write-Host "✅ removed env block (backup: $Settings.bak) — reverts to Anthropic-direct default." -ForegroundColor Green
    Write-Host "↻ restart Claude Code (quit + reopen) to load new env."
  }
  { $_ -in @("status", "") } {
    Show-Current
    Show-Health
    $names = (Get-ChildItem $Profiles -Filter *.json | ForEach-Object { $_.BaseName }) -join " "
    Write-Host "profiles: $names"
  }
  default { Die "usage: ccswitch [9router|local|original|check|fallback|clear|status]" }
}
