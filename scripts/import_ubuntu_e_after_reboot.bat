@echo off
chcp 65001 >nul
echo 判充：重启后把 Ubuntu 导入到 E:\WSL
echo 请右键本文件 - 以管理员身份运行
powershell -NoProfile -ExecutionPolicy Bypass -File "e:\判充\chat\scripts\import_ubuntu_e.ps1"
pause
