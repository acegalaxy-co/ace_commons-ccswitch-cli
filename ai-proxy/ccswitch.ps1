<#
.SYNOPSIS
  ccswitch — swap Claude Code auth profile (Windows / PowerShell port).

.DESCRIPTION
  Only replaces the `env` block in %USERPROFILE%\.claude\settings.json; leaves everything else intact.

  Targets (priority order):
    claude        (DEFAULT)  https://9router.proxy.example.com/v1  cc/* claude   — Claude via 9router
    codex                    (same base)                      cx/* gpt      — Codex/GPT via 9router
    deepseek                 (same base)                      ds/* deepseek — DeepSeek via 9router
    kimi                     http://127.0.0.1:20129/v1        kimi-k3      — Kimi via local adapter
    subscription             (no env block)                   — Claude Code OAuth login (safe-harbor)

  claude / codex / deepseek share the SAME base URL (9router); they differ only in the model prefix
  (cc/ vs cx/ vs ds/) and SHARE ONE 9router key. Kimi uses a local adapter + its own key.

  `subscription` is NOT a profile file: it removes the env block so Claude Code falls back to its
  own OAuth subscription login. No key, never probed — the guaranteed terminal.
  Aliases (backward compat): original->subscription, direct->subscription, clear==subscription.

.EXAMPLE
  ccswitch                # show current target + router-family health + subscription note
  ccswitch claude         # Claude via 9router (default)
  ccswitch codex          # Codex/GPT via 9router (cx/* models)
  ccswitch deepseek       # DeepSeek via 9router (ds/* models)
  ccswitch kimi           # Kimi via local Anthropic adapter
  ccswitch subscription   # remove env block -> Claude Code OAuth subscription
  ccswitch spawn <target> # launch a separate instance pinned to <target> via process env
                          #   (settings.json untouched). N terminals + N targets = N vendors in parallel.
  ccswitch check          # probe router health (all profiles)
  ccswitch fallback       # active router profile if healthy, else fall back to subscription
  ccswitch set-key [p]    # prompt (hidden) for a new key for profile p (default claude), then apply
  ccswitch set-host <url> [p]  # write a new base URL into profile p (default claude), then apply
  ccswitch update [src]   # sync host+key from profile src (default claude) into the others,
                          #   asking [y/N] before overwriting each target profile
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Command = "status",
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest = @()
)

$ErrorActionPreference = "Stop"
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$Settings  = Join-Path $ClaudeDir "settings.json"
$Profiles  = Join-Path $ClaudeDir "profiles"
$Order     = @("claude", "codex", "deepseek", "kimi")   # profile files; subscription is env-clear

function Die($msg) { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }

function Get-Canon($name) {
  switch ($name) {
    "original" { "subscription" }
    "direct"   { "subscription" }
    "clear"    { "subscription" }
    default    { $name }
  }
}

# probe a profile's base url /models endpoint; returns http status code (string)
function Test-Profile($name) {
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { return "000" }
  try {
    $p = Get-Content $prof -Raw | ConvertFrom-Json
  } catch { return "000" }

  $base = $p.ANTHROPIC_BASE_URL
  if (-not $base) { return "000" }   # subscription/OAuth has no URL to probe
  $auth = $p.ANTHROPIC_AUTH_TOKEN
  $url  = ($base.TrimEnd("/")) + "/models"

  $headers = @{}
  if ($auth) { $headers["Authorization"] = "Bearer $auth" }
  try {
    # NOTE: no -SkipHttpErrorCheck (PS7-only). On PS 5.1 non-2xx throws; catch reads the status.
    $resp = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 4 `
              -UseBasicParsing
    return [string]$resp.StatusCode
  } catch {
    if ($_.Exception.Response) { return [string][int]$_.Exception.Response.StatusCode }
    return "000"
  }
}

# claude / codex / deepseek share one base URL (9router) → tell them apart by model prefix.
# kimi uses the local adapter URL.
function Get-Tag($base, $model) {
  if (-not $base) { return "subscription" }
  if ($base -like "*127.0.0.1:20129*" -or $base -like "*localhost:20129*") { return "kimi" }
  if ($base -like "*9router.proxy.example.com*") {
    switch -Wildcard ($model) {
      "cx/*"  { return "codex" }
      "ds/*"  { return "deepseek" }
      "cc/*"  { return "claude" }
      "kimi*" { return "kimi" }
      default { return "claude" }
    }
  }
  return "custom"
}

function Show-Current {
  $s = Get-Content $Settings -Raw | ConvertFrom-Json
  $base  = $s.env.ANTHROPIC_BASE_URL
  $model = $s.env.ANTHROPIC_DEFAULT_OPUS_MODEL
  if ($base) {
    $tag = Get-Tag $base $model
    Write-Host "current: $tag ($base$(if ($model) { ", $model" }))"
  } else {
    Write-Host "current: subscription (no env block → OAuth login)"
  }
}

function Show-Health {
  foreach ($p in $Order) {
    $c = Test-Profile $p
    $tag = if ($c -eq "200") { "OK" } else { "DOWN" }
    Write-Host "  $p`: $c $tag"
  }
  Write-Host "  subscription: OAuth login (safe-harbor, no probe)"
}

# remove the env block -> Claude Code reverts to its own OAuth subscription login.
function Clear-Env {
  if (-not (Test-Path $Settings)) { Die "settings not found: $Settings" }
  Copy-Item $Settings "$Settings.bak" -Force
  $s = Get-Content $Settings -Raw | ConvertFrom-Json
  if ($s.PSObject.Properties.Name -contains "env") { $s.PSObject.Properties.Remove("env") }
  $s | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8
  Write-Host "✅ switched to 'subscription' — removed env block (backup: $Settings.bak)." -ForegroundColor Green
  Write-Host "   Claude Code will use its OAuth subscription login (run 'claude' + login if needed)."
  Write-Host "↻ restart Claude Code (quit + reopen) to load new env."
}

function Start-KimiAdapter($profPath) {
  try { $p = Get-Content $profPath -Raw | ConvertFrom-Json } catch { return }
  $base = $p.ANTHROPIC_BASE_URL
  if (-not ($base -like "*127.0.0.1:20129*" -or $base -like "*localhost:20129*")) { return }
  $adapter = Join-Path $ClaudeDir "kimi-anthropic-adapter.py"
  if (-not (Test-Path $adapter)) { Write-Host "kimi adapter missing: $adapter"; return }
  try { Invoke-WebRequest -Uri (($base.TrimEnd("/")) + "/models") -TimeoutSec 1 -UseBasicParsing | Out-Null; return } catch {}
  $key = $p.ANTHROPIC_AUTH_TOKEN
  if (-not $key -or $key -match '<your-kimi-key>') { Write-Host "kimi adapter not started: missing key"; return }
  $model = if ($p.ANTHROPIC_DEFAULT_OPUS_MODEL) { $p.ANTHROPIC_DEFAULT_OPUS_MODEL } else { "kimi-k3" }
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = "python"
  $psi.Arguments = "`"$adapter`" --host 127.0.0.1 --port 20129"
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.Environment["KIMI_API_KEY"] = $key
  $psi.Environment["KIMI_MODEL"] = $model
  [System.Diagnostics.Process]::Start($psi) | Out-Null
  $key = $null
  Start-Sleep -Milliseconds 200
  Write-Host "kimi adapter started at $($base.TrimEnd('/'))"
}

function Set-ProfileEnv($rawName) {
  $name = Get-Canon $rawName
  # subscription is not a profile file — it is the absence of an env block.
  if ($name -eq "subscription") { Clear-Env; return }
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { Die "profile not found: $prof" }
  if (-not (Test-Path $Settings)) { Die "settings not found: $Settings" }

  try {
    $profObj = Get-Content $prof -Raw | ConvertFrom-Json
  } catch { Die "profile $prof is not valid JSON" }

  Copy-Item $Settings "$Settings.bak" -Force
  $s = Get-Content $Settings -Raw | ConvertFrom-Json
  # PS 5.1: cannot assign to a property that does not exist yet -> use Add-Member (-Force overwrites).
  $s | Add-Member -NotePropertyName env -NotePropertyValue $profObj -Force
  # depth 10 preserves nested hooks/permissions objects
  $s | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8

  Write-Host "✅ switched to '$name' profile (backup: $Settings.bak)" -ForegroundColor Green
  Write-Host "↻ restart Claude Code (quit + reopen) to load new env."
  Start-KimiAdapter $prof
}

# set-key [profile] — prompt (hidden) for a new router key, write it into the profile, then apply.
function Set-ProfileKey($rawName) {
  $name = Get-Canon $rawName
  if ($name -eq "subscription") {
    Die "subscription uses Claude Code's OAuth login — no key to set. Run: ccswitch subscription, then 'claude' + login."
  }
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { Die "profile not found: $prof (run setup first)" }
  try { $p = Get-Content $prof -Raw | ConvertFrom-Json } catch { Die "profile $prof is not valid JSON" }

  $field = "ANTHROPIC_AUTH_TOKEN"

  $secure = Read-Host "▸ Paste new key for '$name' → $field (input hidden)" -AsSecureString
  $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $key    = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  if ([string]::IsNullOrEmpty($key)) { Die "no key entered — profile unchanged." }

  Copy-Item $prof "$prof.bak" -Force
  $p | Add-Member -NotePropertyName $field -NotePropertyValue $key -Force
  $p | ConvertTo-Json -Depth 10 | Set-Content $prof -Encoding UTF8
  $key = $null
  Write-Host "✅ key updated in profiles\$name.json (backup: $prof.bak)" -ForegroundColor Green
  Set-ProfileEnv $name
}

# set-host <url> [profile] — write a new ANTHROPIC_BASE_URL directly into the profile, then apply.
# URL is a required positional arg (not prompted): unlike a key, a base URL isn't a secret.
function Set-ProfileHost($rawHost, $rawName) {
  if ([string]::IsNullOrEmpty($rawHost)) { Die "usage: ccswitch set-host <url> [profile]" }
  $name = Get-Canon $rawName
  if ($name -eq "subscription") {
    Die "subscription uses Claude Code's OAuth login — no host to set."
  }
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { Die "profile not found: $prof (run setup first)" }
  try { $p = Get-Content $prof -Raw | ConvertFrom-Json } catch { Die "profile $prof is not valid JSON" }

  $field = "ANTHROPIC_BASE_URL"

  Copy-Item $prof "$prof.bak" -Force
  $p | Add-Member -NotePropertyName $field -NotePropertyValue $rawHost -Force
  $p | ConvertTo-Json -Depth 10 | Set-Content $prof -Encoding UTF8
  Write-Host "✅ host updated in profiles\$name.json (backup: $prof.bak)" -ForegroundColor Green
  Set-ProfileEnv $name
}

# update [src] — sync ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN from router profile `src` (default claude)
# into the other router profiles. Only these two fields are copied — the model-prefix fields
# stay untouched, since that's what makes claude/codex/deepseek distinct despite sharing one
# 9router host+token. Kimi is separate and never synced. Asks [y/N].
function Update-Profiles($rawSrc) {
  $src = Get-Canon $rawSrc
  if ($src -eq "subscription") { Die "subscription has no host/key to copy from." }
  if ($src -notin @("claude", "codex", "deepseek")) { Die "update only syncs router profiles (claude|codex|deepseek); kimi uses its own key." }
  $srcProf = Join-Path $Profiles "$src.json"
  if (-not (Test-Path $srcProf)) { Die "profile not found: $srcProf" }
  try { $srcObj = Get-Content $srcProf -Raw | ConvertFrom-Json } catch { Die "profile $srcProf is not valid JSON" }

  $base = $srcObj.ANTHROPIC_BASE_URL
  $tok  = $srcObj.ANTHROPIC_AUTH_TOKEN
  if (-not $base) { Die "profile $srcProf has no ANTHROPIC_BASE_URL to copy." }
  if (-not $tok)  { Die "profile $srcProf has no ANTHROPIC_AUTH_TOKEN to copy." }

  $updated = 0
  foreach ($p in @("claude", "codex", "deepseek")) {
    if ($p -eq $src) { continue }
    $dst = Join-Path $Profiles "$p.json"
    if (-not (Test-Path $dst)) { Write-Host "  • profiles\$p.json not found — skipped"; continue }
    $ans = Read-Host "  overwrite host+key in profiles\$p.json from '$src'? [y/N]"
    if ($ans -notmatch '^(y|yes)$') { Write-Host "    skipped $p."; continue }
    Copy-Item $dst "$dst.bak" -Force
    $dstObj = Get-Content $dst -Raw | ConvertFrom-Json
    $dstObj.ANTHROPIC_BASE_URL = $base
    $dstObj.ANTHROPIC_AUTH_TOKEN = $tok
    $dstObj | ConvertTo-Json -Depth 10 | Set-Content $dst -Encoding UTF8
    $updated++
    Write-Host "  ✓ profiles\$p.json synced from '$src' (backup: $dst.bak)"
  }
  if ($updated -eq 0) { Write-Host "no profiles updated."; return }
  Write-Host "✅ synced host+key from '$src' into $updated profile(s)." -ForegroundColor Green
}

# spawn <target> [claude-args…] — launch a SEPARATE Claude Code instance pinned to <target> via
# PROCESS ENV, leaving settings.json untouched. Open N terminals + spawn N targets = N vendors in
# parallel (a single instance reads one env → one model). subscription is env-clear → rejected.
# NOTE: same 9router account across targets = shared quota.
function Spawn-Target($rawName, $childArgs) {
  $name = Get-Canon $rawName
  if ($name -eq "subscription") {
    Die "spawn needs a real router target (claude|codex|deepseek|kimi). subscription is env-clear — run: ccswitch subscription, then plain 'claude'."
  }
  $prof = Join-Path $Profiles "$name.json"
  if (-not (Test-Path $prof)) { Die "profile not found: $prof (run setup first)" }
  try { $profObj = Get-Content $prof -Raw | ConvertFrom-Json } catch { Die "profile $prof is not valid JSON" }

  $c = Test-Profile $name
  if ($c -ne "200") { Write-Host "⚠️  '$name' health=$c (not 200) — spawning anyway, may be down" -ForegroundColor Yellow }

  # set every profile field into this process's env, then invoke claude (inherits env).
  foreach ($p in $profObj.PSObject.Properties) {
    Set-Item -Path ("Env:" + $p.Name) -Value $p.Value
  }
  Start-KimiAdapter $prof
  $Host.UI.RawUI.WindowTitle = "claude:$name"

  Write-Host "▶ spawning claude pinned to '$name' (process env only — settings.json untouched)"
  & claude @childArgs
}

switch ($Command) {
  { $_ -in @("claude", "codex", "deepseek", "kimi") } {
    # all route through 9router (differ only by model prefix) and share one token.
    $c = Test-Profile $Command
    if ($c -ne "200") { Write-Host "⚠️  '$Command' health=$c (not 200) — switching anyway, may be down" -ForegroundColor Yellow }
    Set-ProfileEnv $Command
  }
  { $_ -in @("subscription", "original", "direct", "clear") } {
    # all resolve to subscription (env-clear -> Claude Code OAuth login)
    Set-ProfileEnv "subscription"
  }
  "check" { Show-Health }
  "fallback" {
    # Keep the currently-active router profile if healthy (don't force claude when the user is on
    # deepseek). Resolve active target from settings.json's model prefix; default claude.
    # `subscription` is the guaranteed SAFE-HARBOR terminal — env-clear OAuth, always reachable.
    $s = Get-Content $Settings -Raw | ConvertFrom-Json
    $t = switch -Wildcard ($s.env.ANTHROPIC_DEFAULT_OPUS_MODEL) {
      "cx/*"  { "codex" }
      "ds/*"  { "deepseek" }
      "cc/*"  { "claude" }
      "kimi*" { "kimi" }
      default { "claude" }
    }
    $c = Test-Profile $t
    if ($c -eq "200") { Write-Host "→ router healthy: $t"; Set-ProfileEnv $t; exit 0 }
    Write-Host "  $t down ($c) → safe-harbor: subscription (OAuth)"
    Set-ProfileEnv "subscription"
  }
  "spawn" {
    # launch a separate instance pinned to target via process env (settings.json untouched);
    # forward remaining args to claude. Open multiple terminals to run vendors in parallel.
    $target = if ($Rest.Count -ge 1) { $Rest[0] } else { "claude" }
    $childArgs = if ($Rest.Count -ge 2) { $Rest[1..($Rest.Count - 1)] } else { @() }
    Spawn-Target $target $childArgs
  }
  "set-key" {
    $prof = if ($Rest.Count -ge 1) { $Rest[0] } else { "claude" }
    Set-ProfileKey $prof
  }
  "set-host" {
    $url  = if ($Rest.Count -ge 1) { $Rest[0] } else { "" }
    $prof = if ($Rest.Count -ge 2) { $Rest[1] } else { "claude" }
    Set-ProfileHost $url $prof
  }
  "update" {
    $src = if ($Rest.Count -ge 1) { $Rest[0] } else { "claude" }
    Update-Profiles $src
  }
  { $_ -in @("status", "") } {
    Show-Current
    Show-Health
    $names = (Get-ChildItem $Profiles -Filter *.json | ForEach-Object { $_.BaseName }) -join " "
    Write-Host "profiles: $names"
  }
  { $_ -in @("help", "--help", "-h") } {
    @"
ccswitch — swap Claude Code auth (edits only the ``env`` block in ~/.claude/settings.json)

USAGE
  ccswitch [command]

TARGETS (switch-in-place; RESTART Claude Code after — env loads at launch)
  claude              Claude via 9router          (cc/* models)   ⭐ default
  codex               Codex/GPT via 9router       (cx/* models)
  deepseek            DeepSeek via 9router         (ds/* models)
  kimi                Kimi via local adapter       (kimi-k3)
  subscription        remove env block → Claude Code OAuth login  (safe-harbor, no key)
                      aliases: original | direct | clear

  claude + codex + deepseek share ONE 9router base URL AND ONE token
  (fill the same key into all three profiles). Router down → all down → subscription.
  kimi uses ~/.claude/kimi-anthropic-adapter.py + http://127.0.0.1:20129/v1 + its own key.

COMMANDS
  status  (default)   show active target (by model prefix) + health + subscription
  check               probe health of every router profile + verify subscription
  fallback            keep active router if healthy, else drop to subscription
  spawn <target> [..] launch a SEPARATE pinned instance (settings.json untouched)
  set-key [profile]   paste a key (hidden) into a profile, then apply  (default: claude)
  set-host <url> [p]  write a base URL into a profile, then apply      (default: claude)
  update [src]        sync host+key from profile src into the others  (default: claude)
                      asks [y/N] before overwriting each target profile
  help | -h           this help

KEYS
  ccswitch set-key claude       # then: set-key codex, set-key deepseek with the SAME token
  ccswitch set-key kimi         # Kimi key (separate from 9router token)
  ccswitch set-host https://9router.proxy.example.com/v1 claude   # then: same URL for codex, deepseek
  ccswitch update claude        # or just re-sync: copies claude's host+key into codex + deepseek
  profiles live at ~/.claude/profiles/*.json  (local, never committed)
"@ | Write-Host
    exit 0
  }
  default { Die "usage: ccswitch [claude|codex|deepseek|kimi|subscription|spawn <target>|check|fallback|set-key [profile]|set-host <url> [profile]|update [src]|clear|status|help]" }
}
