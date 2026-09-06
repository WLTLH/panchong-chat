@echo off
chcp 65001 >nul
echo 正在打开云开发续费/套餐页面...
start "" "https://console.cloud.tencent.com/tcb/env/index?envId=cloud1-0g25dj4k5e2c4e64"
timeout /t 2 >nul
start "" "https://console.cloud.tencent.com/tcb/package?envId=cloud1-0g25dj4k5e2c4e64"
timeout /t 2 >nul
start "" "https://console.cloud.tencent.com/tcb/env/billing?envId=cloud1-0g25dj4k5e2c4e64"
echo.
echo 环境 ID: cloud1-0g25dj4k5e2c4e64
echo 请用微信扫码登录腾讯云，在「套餐/计费」里选个人版续费或升级后付款。
pause
