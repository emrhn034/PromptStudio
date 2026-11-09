@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
if exist "release\win-unpacked\PromptStudio.exe" (
  start "" "release\win-unpacked\PromptStudio.exe"
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 veya ustu gerekli. Kurulum paketini kullanabilir veya Node.js kurabilirsiniz.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 goto error
  node node_modules\electron\install.js
  if errorlevel 1 goto error
)
call npm.cmd start
if errorlevel 1 goto error
exit /b 0
:error
echo Uygulama baslatilamadi. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
