@echo off
setlocal
set "VBS=%~dp0TodoGadget.vbs"
set "WD=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$q=[char]34; $lnk=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\TodoGadget.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($lnk); $s.TargetPath=Join-Path $env:SystemRoot 'System32\wscript.exe'; $s.Arguments=$q+$env:VBS+$q; $s.WorkingDirectory=$env:WD; $s.Save()"
if errorlevel 1 goto fail
echo Registered: TodoGadget will start when you sign in to Windows.
echo (If you move this folder, run AddToStartup.bat again.)
pause
exit /b 0
:fail
echo Failed to create the startup shortcut.
pause
exit /b 1
