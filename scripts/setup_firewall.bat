@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - Windows Firewall LAN Setup
:: Run as Administrator on the designated Central Server PC
:: ====================================================================

title AMA Ceramics Firewall Configuration

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c `\"\"%~f0\"\"`' -Verb RunAs"
    exit /b
)

echo [1/3] Configuring Windows Defender Firewall for Central API Server (TCP Port 4000 across ALL network profiles)...
netsh advfirewall firewall delete rule name="AMA Ceramics Quotation Server (TCP 4000)" >nul 2>&1
netsh advfirewall firewall add rule name="AMA Ceramics Quotation Server (TCP 4000)" dir=in action=allow protocol=TCP localport=4000 profile=any

echo [2/3] Enabling LAN ICMP Echo (Ping) so client PCs can verify physical connectivity...
netsh advfirewall firewall delete rule name="AMA Ceramics Allow Ping (ICMPv4)" >nul 2>&1
netsh advfirewall firewall add rule name="AMA Ceramics Allow Ping (ICMPv4)" protocol=icmpv4:8,any dir=in action=allow profile=any

echo [3/3] Verifying firewall rules...
netsh advfirewall firewall show rule name="AMA Ceramics Quotation Server (TCP 4000)" | findstr /i "Enabled Direction Profiles Protocol LocalPort Action"

echo.
echo ====================================================================
echo SUCCESS: Windows Firewall configured for all LAN / Wi-Fi connections.
echo.
echo Host LAN IP Address(es) to enter on Client PCs:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.254*' } | ForEach-Object { Write-Host ('   -> http://' + $_.IPAddress + ':4000  (' + $_.InterfaceAlias + ')') -ForegroundColor Yellow }"
echo ====================================================================
echo.
pause
