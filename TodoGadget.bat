@echo off
setlocal
cd /d "%~dp0"
set "VER=33.4.11"
set "BASE=%LOCALAPPDATA%\TodoGadget"
set "RT=%BASE%\runtime"

if exist "%RT%\TodoGadget.exe" goto run
if exist "%~dp0runtime\TodoGadget.exe" goto migrate
goto download

:migrate
echo [Setup] Reusing the runtime from the old folder...
mkdir "%BASE%" 2>nul
xcopy /e /i /y /q "%~dp0runtime" "%RT%" >nul
if exist "%RT%\TodoGadget.exe" goto run

:download
echo [Setup] First run only: downloading Electron %VER% (about 115MB)...
if exist "%RT%" rmdir /s /q "%RT%"
mkdir "%RT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/electron/electron/releases/download/v%VER%/electron-v%VER%-win32-x64.zip' -OutFile '%RT%\electron.zip'; Expand-Archive -Force -Path '%RT%\electron.zip' -DestinationPath '%RT%'; exit 0 } catch { Write-Host $_; exit 1 }"
if errorlevel 1 goto dlfail
del "%RT%\electron.zip" 2>nul
ren "%RT%\electron.exe" TodoGadget.exe
if exist "%RT%\resources\default_app.asar" del "%RT%\resources\default_app.asar"
echo [Setup] Done.
goto run

:dlfail
echo [Error] Download failed. Check your internet connection and try again.
rmdir /s /q "%RT%" 2>nul
pause
exit /b 1

:run
rem App files are copied into the shared runtime on every launch (so updates apply)
xcopy /e /i /y /q "%~dp0app" "%RT%\resources\app" >nul
start "" "%RT%\TodoGadget.exe"
endlocal
