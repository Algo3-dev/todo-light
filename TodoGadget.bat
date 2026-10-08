@echo off
setlocal
cd /d "%~dp0"
set "VER=44.7.0"
rem SHA-256 of electron-v%VER%-win32-x64.zip (from the official SHASUMS256.txt). Update together with VER.
set "SHA256=eee30dc8fa1f5ea95490e59f44e46ea68dd24c6e93d22facf70fe5c2d4c2665c"
set "BASE=%LOCALAPPDATA%\TodoGadget"
set "RT=%BASE%\runtime"

rem Use the installed runtime only when it matches VER, so an Electron update applies on the next launch
set "CUR="
if exist "%RT%\electron.version" set /p CUR=<"%RT%\electron.version"
if exist "%RT%\TodoGadget.exe" if "%CUR%"=="%VER%" goto run

:download
rem Use full paths: a different find.exe earlier in PATH (e.g. Git for Windows) would break this check
"%SystemRoot%\System32\tasklist.exe" /fi "imagename eq TodoGadget.exe" 2>nul | "%SystemRoot%\System32\find.exe" /i "TodoGadget.exe" >nul
if not errorlevel 1 goto running
echo [Setup] Downloading Electron %VER% (about 160MB). This happens on the first run and after Electron updates...
if exist "%RT%" rmdir /s /q "%RT%"
mkdir "%RT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/electron/electron/releases/download/v%VER%/electron-v%VER%-win32-x64.zip' -OutFile '%RT%\electron.zip' } catch { Write-Host $_; exit 1 }; $f=[IO.File]::OpenRead('%RT%\electron.zip'); try { $h=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($f)).Replace('-','') } finally { $f.Close() }; if ($h -ne '%SHA256%') { Write-Host ('Checksum mismatch: ' + $h); exit 2 }; try { Expand-Archive -Force -Path '%RT%\electron.zip' -DestinationPath '%RT%' } catch { Write-Host $_; exit 1 }"
if errorlevel 2 goto badsum
if errorlevel 1 goto dlfail
del "%RT%\electron.zip" 2>nul
ren "%RT%\electron.exe" TodoGadget.exe
if exist "%RT%\resources\default_app.asar" del "%RT%\resources\default_app.asar"
>"%RT%\electron.version" echo %VER%
echo [Setup] Done.
goto run

:running
echo [Setup] TODO LIGHT is running with an older Electron. Quit it from the tray icon (right-click - Exit),
echo         then run this file again to apply the update.
pause
exit /b 1

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
