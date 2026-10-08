@echo off
setlocal
cd /d "%~dp0"
set "VER=33.4.11"
rem SHA-256 of electron-v%VER%-win32-x64.zip (from the official SHASUMS256.txt). Update together with VER.
set "SHA256=f64c8a5a81d9b420b636fdba13e180f49d69f2198e1d86a8b01f858b17a9483c"
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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/electron/electron/releases/download/v%VER%/electron-v%VER%-win32-x64.zip' -OutFile '%RT%\electron.zip' } catch { Write-Host $_; exit 1 }; $h=(Get-FileHash -Algorithm SHA256 '%RT%\electron.zip').Hash; if ($h -ne '%SHA256%') { Write-Host ('Checksum mismatch: ' + $h); exit 2 }; try { Expand-Archive -Force -Path '%RT%\electron.zip' -DestinationPath '%RT%' } catch { Write-Host $_; exit 1 }"
if errorlevel 2 goto badsum
if errorlevel 1 goto dlfail
del "%RT%\electron.zip" 2>nul
ren "%RT%\electron.exe" TodoGadget.exe
if exist "%RT%\resources\default_app.asar" del "%RT%\resources\default_app.asar"
echo [Setup] Done.
goto run

:badsum
echo [Error] The downloaded file does not match the expected checksum. It was NOT run.
echo         Check your network (proxy / security software) and try again.
rmdir /s /q "%RT%" 2>nul
pause
exit /b 1

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
