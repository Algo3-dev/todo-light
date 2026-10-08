@echo off
rem NOTE: keep this file ASCII only (no Japanese). See AGENTS.md.
rem This project has no EXE build (Electron runtime is downloaded by TodoGadget.bat).
rem Flow: quality gate only

node --test "%~dp0..\app\*.test.js"
if errorlevel 1 exit /b 1

exit /b 0
