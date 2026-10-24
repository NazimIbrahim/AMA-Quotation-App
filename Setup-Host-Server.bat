@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - 1-Click Host Server Setup Launcher
:: Double-click this file to set up the central LAN server automatically.
:: ====================================================================

title AMA Ceramics Quotation System - Host Setup

:: Check for administrative rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c `\"\"%~f0\"\"`' -Verb RunAs"
    exit /b
)

:: Run master setup PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_host_server.ps1"
