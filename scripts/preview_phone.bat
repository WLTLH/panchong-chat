@echo off
chcp 65001 >nul
set CLI=D:\360安全浏览器下载\360Safe\微信web开发者工具\cli.bat
set PROJECT=e:\判充\chat
set OUT=%~dp0preview_qr
if not exist "%OUT%" mkdir "%OUT%"

echo.
echo === 判充 · 同步到手机 ===
echo 1) 打开微信开发者工具
echo 2) 设置 - 安全设置 - 服务端口：开启
echo 3) 用本微信扫预览码（开发者身份）
echo.

"%CLI%" open --project "%PROJECT%"
if errorlevel 1 (
  echo 打开项目失败，请先手动打开「判充」项目后再运行本脚本。
  pause
  exit /b 1
)

echo 正在生成预览二维码...
"%CLI%" preview --project "%PROJECT%" --qr-format image --qr-output "%OUT%\qr.png" --info-output "%OUT%\info.json"
if errorlevel 1 (
  echo.
  echo 命令行预览失败时，请在开发者工具顶部点「预览」，用手机微信扫码。
  pause
  exit /b 1
)

echo.
echo 预览码已生成：%OUT%\qr.png
start "" "%OUT%\qr.png"
echo 用手机微信扫码即可打开最新代码。
pause
