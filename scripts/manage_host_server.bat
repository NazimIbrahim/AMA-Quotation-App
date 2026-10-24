@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - Central Host Server Manager
:: ====================================================================

title AMA Ceramics Host Server Control Panel
color 0B

:MENU
cls
echo ====================================================================
echo        AMA CERAMICS QUOTATION SYSTEM - HOST SERVER CONTROL
echo ====================================================================
echo.
echo Server Process Status:
schtasks /query /tn "AMACeramicsServer" 2>nul | findstr /i "AMACeramicsServer"
echo.
echo Local Server Health Check:
curl -s http://localhost:4000/api/health 2>nul
if %errorlevel% neq 0 (
    echo [OFFLINE] Server is currently NOT responding on port 4000.
) else (
    echo.
)
echo.
echo Host LAN IP Address(es) for Client Devices:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.254*' } | ForEach-Object { Write-Host ('   -> http://' + $_.IPAddress + ':4000') -ForegroundColor Yellow }"
echo.
echo ====================================================================
echo  1. Restart Central Server Service
echo  2. Stop Central Server Service
echo  3. Start Central Server Service
echo  4. Create Immediate Database Backup
echo  5. Open Server Logs Folder
echo  6. Re-run Full Host Server Setup
echo  7. Exit
echo ====================================================================
set /p choice="Choose an option (1-7): "

if "%choice%"=="1" goto RESTART
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto START
if "%choice%"=="4" goto BACKUP
if "%choice%"=="5" goto LOGS
if "%choice%"=="6" goto SETUP
if "%choice%"=="7" exit /b

echo Invalid option.
timeout /t 2 >nul
goto MENU

:RESTART
echo.
echo Restarting AMACeramicsServer scheduled task...
schtasks /end /tn "AMACeramicsServer" >nul 2>&1
timeout /t 1 >nul
schtasks /run /tn "AMACeramicsServer" >nul 2>&1
echo Done!
timeout /t 2 >nul
goto MENU

:STOP
echo.
echo Stopping AMACeramicsServer...
schtasks /end /tn "AMACeramicsServer" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Server stopped.
timeout /t 2 >nul
goto MENU

:START
echo.
echo Starting AMACeramicsServer...
schtasks /run /tn "AMACeramicsServer" >nul 2>&1
timeout /t 2 >nul
goto MENU

:BACKUP
echo.
echo Executing database backup...
call "%~dp0backup_database.bat"
pause
goto MENU

:LOGS
explorer "%~dp0..\logs"
goto MENU

:SETUP
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_host_server.ps1"
goto MENU
