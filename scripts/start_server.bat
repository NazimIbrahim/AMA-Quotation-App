@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - Central Server Startup Script
:: Starts the Node.js API server and PostgreSQL connectivity
:: ====================================================================

title AMA Ceramics Quotation Central Server
cd /d "%~dp0..\server"

:: Ensure Node and PostgreSQL in PATH
set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\16\bin;%PATH%"

echo Starting AMA Ceramics Central LAN Server...
echo Ensuring PostgreSQL service is active...
net start postgresql-x64-16 >nul 2>&1

:: Run compiled server
node dist/server.js
if %errorlevel% neq 0 (
    echo.
    echo Server process terminated unexpectedly with code %errorlevel%.
    pause
)
