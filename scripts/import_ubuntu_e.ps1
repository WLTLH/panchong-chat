#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"
$log = "E:\WSL\import_log.txt"
function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}
"" | Set-Content $log -Encoding UTF8
$wsl = "$env:SystemRoot\System32\wsl.exe"
$tar = "E:\WSL\ubuntu-noble-wsl-amd64.rootfs.tar.gz"
Log "=== Import Ubuntu to E:\WSL\Ubuntu ==="
Log ("tar exists=" + (Test-Path $tar) + " size=" + ($(if (Test-Path $tar){(Get-Item $tar).Length}else{0})))

$existing = (& $wsl -l -q 2>$null | Out-String).Trim()
Log ("existing=[" + $existing + "]")
if ($existing -match "Ubuntu") {
  Log "Ubuntu already installed."
} elseif (Test-Path $tar) {
  New-Item -ItemType Directory -Force -Path "E:\WSL\Ubuntu" | Out-Null
  # Prefer WSL2; fall back to WSL1 if virtualization not ready
  Log "Import attempt WSL2..."
  $p = Start-Process -FilePath $wsl -ArgumentList "--import","Ubuntu","E:\WSL\Ubuntu",$tar,"--version","2" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "E:\WSL\import_out.txt" -RedirectStandardError "E:\WSL\import_err.txt"
  Log ("WSL2 import exit=" + $p.ExitCode)
  Get-Content "E:\WSL\import_out.txt","E:\WSL\import_err.txt" -ErrorAction SilentlyContinue -Encoding Unicode | ForEach-Object { Log $_ }
  $existing2 = (& $wsl -l -q 2>$null | Out-String).Trim()
  if (-not ($existing2 -match "Ubuntu")) {
    Log "Import attempt WSL1 fallback..."
    # clean partial
    Remove-Item "E:\WSL\Ubuntu\*" -Recurse -Force -ErrorAction SilentlyContinue
    $p2 = Start-Process -FilePath $wsl -ArgumentList "--import","Ubuntu","E:\WSL\Ubuntu",$tar,"--version","1" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "E:\WSL\import1_out.txt" -RedirectStandardError "E:\WSL\import1_err.txt"
    Log ("WSL1 import exit=" + $p2.ExitCode)
    Get-Content "E:\WSL\import1_out.txt","E:\WSL\import1_err.txt" -ErrorAction SilentlyContinue -Encoding Unicode | ForEach-Object { Log $_ }
  }
  & $wsl --set-default Ubuntu 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
}

Log "wsl -l -v:"
& $wsl -l -v 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }

# smoke test
Log "Running uname..."
& $wsl -d Ubuntu -e uname -a 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
Log "=== import done ==="
"IMPORT_DONE" | Set-Content "E:\WSL\IMPORT_DONE.txt" -Encoding UTF8
