@echo off
title Global Link Logistics - Launcher
cd /d "%~dp0"

echo ===================================================
echo   Global Link Logistics - Local Dev Environment
echo ===================================================
echo [1/3] Starting Embedded PostgreSQL Database (Port 5432)...
start "GlobalLink-Postgres" cmd /k "cd /d ""%~dp0backend"" && node scripts/start-embedded-pg.js"

timeout /t 3 /nobreak > nul

echo [2/3] Starting Backend API Server (Port 3000)...
start "GlobalLink-Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/3] Starting Frontend Customer Portal (Port 5173)...
start "GlobalLink-Frontend" cmd /k "cd /d ""%~dp0frontend\customer"" && npm run dev"

echo.
echo ===================================================
echo   All services launched in separate windows!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   Database: postgresql://logistics:password@localhost:5432/globallink
echo ===================================================
echo.
pause
