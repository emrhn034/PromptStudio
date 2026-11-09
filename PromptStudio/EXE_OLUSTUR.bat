@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto error
node node_modules\electron\install.js
if errorlevel 1 goto error
call npm.cmd test
if errorlevel 1 goto error
call npm.cmd run dist
if errorlevel 1 goto error
echo.
echo KURULUM PAKETI OLUSTURULDU: release klasorune bakin.
pause
exit /b 0
:error
echo HATA: Node.js 22.12+, internet baglantisi ve yukaridaki ciktiyi kontrol edin.
pause
exit /b 1
