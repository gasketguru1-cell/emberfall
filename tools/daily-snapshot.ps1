# Emberfall's nightly snapshot: when anything in the project changed today, it is saved as one git commit on the branch
# the project is on ("Daily snapshot <date>"). Nothing is pushed or uploaded; with no changes it does nothing.
# Run by the Windows task "Emberfall daily snapshot" (11:30 PM, or at the next start when the PC was off).
# Its log: tools\daily-snapshot.log (in the project, ignored by git). To stop it: Task Scheduler -> "Emberfall daily snapshot" -> Disable.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$log = Join-Path $PSScriptRoot 'daily-snapshot.log'
function Log($m) { Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $m) }
try {
    Set-Location $repo
    # (a git operation still running - a rebase, a merge - is left alone)
    foreach ($busy in 'rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD') {
        if (Test-Path (Join-Path $repo ".git\$busy")) { Log "skipped: a git $busy is in progress"; exit 0 }
    }
    $changes = git status --porcelain
    if (-not $changes) { Log 'no changes today'; exit 0 }
    git add -A
    $count = (git diff --cached --name-only | Measure-Object).Count
    $date = Get-Date -Format 'yyyy-MM-dd'
    git commit -q -m "Daily snapshot $date" -m "Automatic end-of-day snapshot of the game's working state ($count files changed)."
    $branch = git branch --show-current
    Log "committed $count files on $branch as $(git rev-parse --short HEAD)"
} catch {
    Log "failed: $($_.Exception.Message)"
    exit 1
}
