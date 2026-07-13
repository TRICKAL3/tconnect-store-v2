@echo off
cd /d "%~dp0"
echo TConnect at http://localhost:5174
echo If compile hangs, run: npm run start:fresh
echo.
start http://localhost:5174
npm start
