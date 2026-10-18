@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Once https://nodejs.org adresinden Node.js LTS kurun.
 pause
 exit /b 1
)
call npm install
if errorlevel 1 (
 pause
 exit /b 1
)
node setup.cjs
pause
