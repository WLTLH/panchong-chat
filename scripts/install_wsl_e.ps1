#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"
$log = "E:\WSL\install_log.txt"
New-Item -ItemType Directory -Force -Path "E:\WSL\Ubuntu" | Out-Null
function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}
"" | Set-Content $log -Encoding UTF8
Log "=== WSL install start (admin) ==="
Log ("User: " + [System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Log ("IsAdmin: " + $isAdmin)

$dism = "$env:SystemRoot\System32\dism.exe"
$wsl = "$env:SystemRoot\System32\wsl.exe"

foreach ($feat in @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")) {
  Log ("Enable feature: " + $feat)
  $p = Start-Process -FilePath $dism -ArgumentList "/online","/enable-feature","/featurename:$feat","/all","/norestart" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "E:\WSL\dism_$feat.txt" -RedirectStandardError "E:\WSL\dism_$feat.err.txt"
  Log ("dism exit: " + $p.ExitCode)
  Get-Content "E:\WSL\dism_$feat.txt" -ErrorAction SilentlyContinue | Select-Object -Last 8 | ForEach-Object { Log $_ }
}

Log "Set default WSL version 2"
& $wsl --set-default-version 2 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }

# Download Ubuntu rootfs if missing
$tar = "E:\WSL\ubuntu-noble-wsl-amd64.rootfs.tar.gz"
$url = "https://cloud-images.ubuntu.com/wsl/releases/noble/current/ubuntu-noble-wsl-amd64-24.04lts.rootfs.tar.gz"
if (-not (Test-Path $tar)) {
  Log "Downloading Ubuntu rootfs to E:\WSL (may take several minutes)..."
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $tar -UseBasicParsing
    Log ("Download OK, size=" + (Get-Item $tar).Length)
  } catch {
    Log ("Download failed: " + $_.Exception.Message)
    # try Microsoft store appx via winget if available
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
      Log "Trying winget install Ubuntu..."
      & winget install -e --id Canonical.Ubuntu.2404 --accept-package-agreements --accept-source-agreements 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
    }
  }
}

# Import if we have tar and no distro yet
$existing = & $wsl -l -q 2>$null
Log ("Existing distros: [" + (($existing | Out-String).Trim()) + "]")
if ((Test-Path $tar) -and (-not ($existing -match "Ubuntu"))) {
  Log "Importing Ubuntu into E:\WSL\Ubuntu ..."
  & $wsl --import Ubuntu "E:\WSL\Ubuntu" $tar --version 2 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
  & $wsl --set-default Ubuntu 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
}

Log "Final status:"
& $wsl -l -v 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
& $wsl --status 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
Log "=== done ==="
"DONE" | Set-Content "E:\WSL\INSTALL_DONE.txt" -Encoding UTF8
