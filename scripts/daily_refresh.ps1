# Nightly refresh of the Results page.
#
#   1. pull fresh M1 bars for the symbols portfolio #99 trades
#   2. re-run each member's ENGINE over that lake and re-export the curve
#
# Step 2 is what makes this worth scheduling: the members are stored as
# `calc_mode=report`, whose trades are frozen at the date their MT5 .html was
# generated. `export_portfolio.py` overrides them to engine mode for the site
# only, so the curve follows the data instead of the upload.
#
# Fired by Strategy Lab's own launcher (`run_backend_detached.ps1`), detached
# and age-gated, so opening the lab is what brings the site's curve up to date.
#
# The site still has to be rebuilt/redeployed to publish the new JSON.

# `-MaxAgeHours` makes this safe to fire on every Strategy Lab start: it does
# nothing if the exported JSON is already younger than that. Opening the lab
# four times before lunch should pull the lake once, not four times.
param([double]$MaxAgeHours = 0)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$log = Join-Path $root "refresh.log"
function Say($m) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Write-Output $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

# Strategy Lab's OWN venv, not whatever `python` resolves to. A scheduled-task
# session does not inherit an interactive shell's PATH: the bare name there
# found a bare CPython with no pyarrow, and every parquet in the lake read back
# as "unreadable" — which `data_download.refresh` treats as a corrupt file and
# answers with a FULL re-download. Pinning the venv is what keeps a nightly job
# from re-pulling the whole lake over a missing import.
$py = "d:\01.Documents\11.Trading Career\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  $py = (Get-Command python -ErrorAction SilentlyContinue |
         Where-Object { $_.Source -and $_.Source -notlike "*WindowsApps*" } |
         Select-Object -First 1).Source
}
if (-not $py) { Say "refresh: FAILED - no python found"; exit 1 }

# The child's own output is the only evidence of WHY a run failed, so it goes
# into the log as well — a scheduled job that records nothing but an exit code
# cannot be diagnosed the next morning.
#
# cmd does the stderr merge, NOT PowerShell. In 5.1 a native command's stderr
# under `2>&1` comes back as ErrorRecords, and with ErrorActionPreference Stop
# the first warning line aborts the run before the real error is ever logged.
function Run($script) {
  Say "run $script"
  $out = Join-Path $env:TEMP ("psr_" + [guid]::NewGuid().ToString("N") + ".txt")
  & cmd /c "`"$py`" `"$script`" > `"$out`" 2>&1"
  $code = $LASTEXITCODE
  if (Test-Path $out) {
    Get-Content $out | ForEach-Object {
      Write-Output $_
      Add-Content -Path $log -Value ("    " + $_) -Encoding utf8
    }
    Remove-Item $out -Force
  }
  if ($code -ne 0) { throw "$script exited $code" }
}

$data = Join-Path $root "src\data\portfolio99.json"
if ($MaxAgeHours -gt 0 -and (Test-Path $data)) {
  $age = ((Get-Date) - (Get-Item $data).LastWriteTime).TotalHours
  if ($age -lt $MaxAgeHours) {
    Say ("refresh: skipped - data is {0:N1}h old (< {1}h)" -f $age, $MaxAgeHours)
    exit 0
  }
}

$env:PYTHONIOENCODING = "utf-8"
Say "refresh: start ($py)"
try {
  Run "scripts\refresh_lake.py"
  Run "scripts\export_portfolio.py"
  Say "refresh: done"
} catch {
  Say "refresh: FAILED - $_"
  exit 1
}
