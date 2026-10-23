@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - Windows Firewall LAN Setup
:: Run as Administrator on the designated Central Server PC
:: ====================================================================

echo [1/2] Configuring Windows Defender Firewall for Central API Server (Port 4000)...
netsh advfirewall firewall delete rule name="AMA Ceramics Quotation Server (TCP 4000)" >nul 2>&1
netsh advfirewall firewall add rule name="AMA Ceramics Quotation Server (TCP 4000)" dir=in action=allow protocol=TCP localport=4000 profile=private,domain

echo [2/2] Verifying firewall rule registration...
netsh advfirewall firewall show rule name="AMA Ceramics Quotation Server (TCP 4000)"

echo.
echo ====================================================================
echo SUCCESS: Windows Firewall configured.
echo Client PCs on the local network can now connect to this PC on port 4000.
echo.
echo Your Local IP Address(es):
ipconfig | findstr /i "IPv4"
echo ====================================================================
pause
