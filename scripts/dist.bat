@echo off
rem NOTE: keep this file ASCII only (no Japanese). See AGENTS.md.
rem Creates the distribution zip. Runs the quality gate (build.bat) first.
setlocal
call "%~dp0build.bat"
if errorlevel 1 exit /b 1

set "ROOT=%~dp0.."
set /p VER=<"%ROOT%\VERSION"
set "OUT=%ROOT%\dist\TodoGadget"

if exist "%ROOT%\dist" rmdir /s /q "%ROOT%\dist"
mkdir "%OUT%"

xcopy /e /i /y /q "%ROOT%\app" "%OUT%\app" >nul
del "%OUT%\app\*.test.js" 2>nul
copy /y "%ROOT%\TodoGadget.bat" "%OUT%" >nul
copy /y "%ROOT%\TodoGadget.vbs" "%OUT%" >nul
copy /y "%ROOT%\AddToStartup.bat" "%OUT%" >nul
copy /y "%ROOT%\RemoveFromStartup.bat" "%OUT%" >nul
copy /y "%ROOT%\README.md" "%OUT%" >nul
copy /y "%ROOT%\VERSION" "%OUT%" >nul

rem Zip the folder itself so extracting creates a TodoGadget folder
powershell -NoProfile -Command "Compress-Archive -Force -Path '%OUT%' -DestinationPath '%ROOT%\dist\TodoGadget-%VER%.zip'"
if errorlevel 1 exit /b 1

endlocal
exit /b 0
