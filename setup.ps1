<#
.SYNOPSIS
  ccswitch setup (Windows / PowerShell).

.DESCRIPTION
  Installs ccswitch.ps1 + profile templates + SessionStart health hook into %USERPROFILE%\.claude,
  then registers a `ccswitch` function in your PowerShell profile. Never overwrites existing
  profile files that already hold real keys — templates are only copied when missing.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$Src       = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$Profiles  = Join-Path $ClaudeDir "profiles"
$Hooks     = Join-Path $ClaudeDir "hooks"
$Settings  = Join-Path $ClaudeDir "settings.json"

Write-Host "▶ ccswitch setup — installing into $ClaudeDir"

New-Item -ItemType Directory -Force -Path $Profiles, $Hooks | Out-Null

# 1. tool (always refreshed — no secrets inside)
Copy-Item (Join-Path $Src "ccswitch.ps1") (Join-Path $ClaudeDir "ccswitch.ps1") -Force
Copy-Item (Join-Path $Src "hooks\check-router.sh") (Join-Path $Hooks "check-router.sh") -Force
Write-Host "  ✓ ccswitch.ps1 + hooks\check-router.sh"

# 2. profile templates — copy ONLY if missing (never clobber real keys)
foreach ($p in @("9router", "local", "original")) {
  $dst = Join-Path $Profiles "$p.json"
  if (Test-Path $dst) {
    Write-Host "  • profiles\$p.json exists — kept (edit manually to update key)"
  } else {
    Copy-Item (Join-Path $Src "profiles\$p.json") $dst -Force
    Write-Host "  ✓ profiles\$p.json (template — fill in your key)"
  }
}

# 3. ensure settings.json exists + wire SessionStart hook idempotently
if (-not (Test-Path $Settings)) { "{}" | Set-Content $Settings -Encoding UTF8 }
$HookCmd = "bash ~/.claude/hooks/check-router.sh"
$s = Get-Content $Settings -Raw | ConvertFrom-Json
$already = $false
if ($s.hooks -and $s.hooks.SessionStart) {
  foreach ($grp in $s.hooks.SessionStart) {
    foreach ($h in $grp.hooks) { if ($h.command -eq $HookCmd) { $already = $true } }
  }
}
if (-not $already) {
  Copy-Item $Settings "$Settings.bak" -Force
  if (-not $s.hooks) { $s | Add-Member -NotePropertyName hooks -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $s.hooks.SessionStart) { $s.hooks | Add-Member -NotePropertyName SessionStart -NotePropertyValue @() -Force }
  $entry = [pscustomobject]@{ hooks = @([pscustomobject]@{ type = "command"; command = $HookCmd }) }
  $s.hooks.SessionStart = @($s.hooks.SessionStart) + $entry
  $s | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8
  Write-Host "  ✓ wired SessionStart health hook into settings.json"
} else {
  Write-Host "  • SessionStart hook already wired — skipped"
}

# 4. register `ccswitch` function in PowerShell profile
$psProfile = $PROFILE.CurrentUserAllHosts
$profileDir = Split-Path -Parent $psProfile
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
if (-not (Test-Path $psProfile)) { New-Item -ItemType File -Force -Path $psProfile | Out-Null }
$fnLine = 'function ccswitch { & powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\ccswitch.ps1" @args }'
if (-not (Select-String -Path $psProfile -SimpleMatch "function ccswitch" -Quiet)) {
  Add-Content $psProfile "`n$fnLine"
  Write-Host "  ✓ added ccswitch function to $psProfile"
} else {
  Write-Host "  • ccswitch function already in $psProfile — skipped"
}

Write-Host ""
Write-Host "✅ Installed. Next steps:" -ForegroundColor Green
Write-Host "   1. Fill your key:   notepad `$env:USERPROFILE\.claude\profiles\9router.json   (replace <your-9router-key>)"
Write-Host "   2. Reload profile:  . `$PROFILE   then run: ccswitch 9router"
Write-Host "   3. Restart Claude Code (quit + reopen) to load the new env."
Write-Host ""
Write-Host "Note: the health hook uses 'bash' (Git Bash / WSL). If you have neither, the hook is skipped harmlessly." -ForegroundColor DarkGray
