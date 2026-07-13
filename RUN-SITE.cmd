@echo off
cd /d "%~dp0"
echo.
echo === TCONNECT - wait for "Compiled successfully" ===
echo === Then open: http://localhost:3180/
echo === (API uses port 4001 - if that's already running, ignore api errors.)
echo.
npm run local
pause
