@echo off
chcp 65001 >nul
set CLI=D:\360安全浏览器下载\360Safe\微信web开发者工具\cli.bat
set PROJECT=e:\判充\chat
set ENV=cloud1-0g25dj4k5e2c4e64

echo 需先在开发者工具：设置 - 安全设置 - 开启服务端口
echo 部署云函数到 %ENV% ...
"%CLI%" cloud functions deploy --env %ENV% --names login reportAnalysis updateVip -r --project "%PROJECT%"
pause
