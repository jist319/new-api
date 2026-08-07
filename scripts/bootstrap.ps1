# scripts/bootstrap.ps1 — JistAI new-api dev workspace bootstrap (idempotent)
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1 [-Verify] [-SkipInstall]
param(
    [switch]$Verify,      # also run baseline checks (go build / bun typecheck / docker compose config)
    [switch]$SkipInstall  # skip dependency install (go mod download / bun install)
)
$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
$fail = $false

function Find-Tool([string]$Name, [string[]]$Candidates) {
    foreach ($c in $Candidates) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$Go = Find-Tool 'go.exe' @('D:\Codex\.tools\go\bin\go.exe')
$Bun = Find-Tool 'bun.cmd' @('C:\Users\jist3\AppData\Roaming\npm\bun.cmd')
if (-not $Bun) { $Bun = Find-Tool 'bun.exe' @('C:\Users\jist3\AppData\Roaming\npm\bun.exe') }

# Session PATH fallback so this works even before the machine PATH refresh takes effect.
if ($Go)   { $goBin = Split-Path $Go;   if ($env:Path -notlike "*$goBin*")  { $env:Path = "$goBin;$env:Path" } }
if ($Bun)  { $bunBin = Split-Path $Bun; if ($env:Path -notlike "*$bunBin*") { $env:Path = "$bunBin;$env:Path" } }

Write-Host "== JistAI new-api dev bootstrap ==" -ForegroundColor Cyan
Write-Host ("repo   : " + $RepoRoot)
if (-not $Go) { Write-Host "[ERR] go not found (expected D:\Codex\.tools\go\bin\go.exe)" -ForegroundColor Red; $fail = $true }
else { Write-Host ("go     : " + (& $Go version)) }
if (-not $Bun) { Write-Host "[ERR] bun not found (expected C:\Users\jist3\AppData\Roaming\npm\bun.cmd)" -ForegroundColor Red; $fail = $true }
else { Write-Host ("bun    : " + (& $Bun --version)) }

# Go env (idempotent; persisted to the user-level go env config)
if ($Go -and -not $fail) {
    & $Go env -w GOPROXY=https://goproxy.cn,direct | Out-Null
    & $Go env -w GOMODCACHE=D:\Codex\.tools\gopath\pkg\mod | Out-Null
    Write-Host ("goproxy: " + (& $Go env GOPROXY))
}

# Git summary
$branch = git rev-parse --abbrev-ref HEAD 2>$null
$head = git rev-parse --short HEAD 2>$null
$dirty = (git status --porcelain 2>$null | Measure-Object).Count
Write-Host ("git    : $branch @ $head" + $(if ($dirty -gt 0) { " (dirty: $dirty)" } else { " (clean)" }))

# Dependency install
if ($Go -and -not $fail -and -not $SkipInstall) {
    Write-Host "== go mod download ==" -ForegroundColor Cyan
    & $Go mod download
    if ($LASTEXITCODE -ne 0) { $fail = $true }
}
if ($Bun -and -not $fail -and -not $SkipInstall) {
    Write-Host "== bun install (web) ==" -ForegroundColor Cyan
    Push-Location "$RepoRoot\web"
    & $Bun install --registry https://registry.npmmirror.com
    if ($LASTEXITCODE -ne 0) { $fail = $true }
    Pop-Location
}

# Baseline verification (optional)
if ($Verify -and -not $fail) {
    Write-Host "== verify: go build ./... ==" -ForegroundColor Cyan
    & $Go build ./...
    if ($LASTEXITCODE -ne 0) { $fail = $true }
    if ($Bun) {
        Write-Host "== verify: bun run typecheck ==" -ForegroundColor Cyan
        Push-Location "$RepoRoot\web"
        & $Bun run typecheck
        if ($LASTEXITCODE -ne 0) { $fail = $true }
        Pop-Location
    }
    Write-Host "== verify: docker compose config --quiet ==" -ForegroundColor Cyan
    & docker compose config --quiet
    if ($LASTEXITCODE -ne 0) { $fail = $true }
}

if ($fail) { Write-Host "== bootstrap FAILED ==" -ForegroundColor Red; exit 1 }
Write-Host "== bootstrap OK ==" -ForegroundColor Green
exit 0