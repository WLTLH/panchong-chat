param(
  [string]$EnvId = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-EnvId([string]$id) {
  if (-not $id) { return }
  $cfg = Join-Path $Root "utils\cloud_config.js"
  $text = Get-Content $cfg -Raw -Encoding UTF8
  $text = $text -replace "envId:\s*'[^']*'", "envId: '$id'"
  Set-Content $cfg $text -Encoding UTF8 -NoNewline

  $appJs = Join-Path $Root "app.js"
  $app = Get-Content $appJs -Raw -Encoding UTF8
  $app = $app -replace "cloudEnvId:\s*'[^']*'", "cloudEnvId: '$id'"
  Set-Content $appJs $app -Encoding UTF8 -NoNewline

  $rc = Join-Path $Root "cloudbaserc.json"
  $rcJson = Get-Content $rc -Raw -Encoding UTF8 | ConvertFrom-Json
  $rcJson.envId = $id
  ($rcJson | ConvertTo-Json -Depth 5) + "`n" | Set-Content $rc -Encoding UTF8
  Write-Host "已写入环境 ID: $id"
}

if (-not $EnvId) {
  $rcPath = Join-Path $Root "cloudbaserc.json"
  if (Test-Path $rcPath) {
    $rc = Get-Content $rcPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($rc.envId) { $EnvId = $rc.envId }
  }
}

if (-not $EnvId) {
  $EnvId = Read-Host "请输入云开发环境 ID（如 cloud1-xxx，在微信开发者工具-云开发-设置中复制）"
}

if (-not $EnvId) {
  Write-Error "未提供环境 ID，已中止"
}

Write-EnvId $EnvId

Write-Host "检查 CloudBase CLI 登录..."
$loginCheck = tcb env list -e $EnvId 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "需要登录腾讯云/微信云开发账号，浏览器会打开授权页..."
  tcb login
}

Write-Host "部署云函数 login / reportAnalysis / updateVip ..."
foreach ($fn in @("login", "reportAnalysis", "updateVip")) {
  tcb fn deploy $fn -e $EnvId --force
  if ($LASTEXITCODE -ne 0) {
    Write-Error "部署 $fn 失败"
  }
}

if (Test-Path (Join-Path $Root "database")) {
  Write-Host "部署数据库安全规则..."
  tcb database:deploy -e $EnvId
}

Write-Host ""
Write-Host "完成。请在微信开发者工具中重新编译小程序。"
Write-Host "集合 users / analysis_reports 会在首次写入时自动创建。"
