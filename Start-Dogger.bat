@echo off
rem Dogger launcher. Double-click to check GitHub for the newest development build,
rem start the local server, and open Dogger in Chrome. Extra options are passed on
rem to scripts\Start-Dogger.ps1, for example:  Start-Dogger.bat -Stop
rem Works from the repository folder, or from a shortcut or copy on the desktop.
setlocal
set "DOGGER_PS1=%~dp0scripts\Start-Dogger.ps1"
if exist "%DOGGER_PS1%" goto launch
rem Not running from the repository (a desktop copy): use the folder saved by the last launch.
set "DOGGER_REPO="
if exist "%LOCALAPPDATA%\Dogger\repo-path.txt" set /p "DOGGER_REPO="<"%LOCALAPPDATA%\Dogger\repo-path.txt"
if not defined DOGGER_REPO goto norepo
set "DOGGER_PS1=%DOGGER_REPO%\scripts\Start-Dogger.ps1"
if exist "%DOGGER_PS1%" goto launch
:norepo
echo.
echo Could not find the Dogger repository.
echo Run Start-Dogger.bat once from inside the Dogger folder so it can remember where it is.
echo.
pause
exit /b 1
:launch
rem 'start' gives the launcher its own window and lets this window close straight away,
rem so git is free to update this file while the launcher runs.
start "Dogger Launcher" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DOGGER_PS1%" %*
exit /b 0
