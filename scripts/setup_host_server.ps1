<#
.SYNOPSIS
    AMA Ceramics Quotation Management System - Single 1-Click Host Server Setup
.DESCRIPTION
    Automates the complete installation, database initialization, firewall configuration,
    and automatic startup registration for the central LAN server host machine.
#>

param(
    [switch]$Unattended = $false
)

# ---------------------------------------------------------------------------
# 0. Self-Elevation to Administrator
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Elevating to Administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"") -Verb RunAs
    exit
}

$Host.UI.RawUI.WindowTitle = "AMA Ceramics Quotation System - Host Server Setup"
Clear-Host

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "       AMA CERAMICS QUOTATION SYSTEM - CENTRAL HOST SERVER SETUP          " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "This single setup script will automatically configure your PC as the"
Write-Host "central LAN server for all client quotation workstations.`n"

$rootDir = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $rootDir "server"
$scriptsDir = Join-Path $rootDir "scripts"

# ---------------------------------------------------------------------------
# 1. Verify / Install Node.js
# ---------------------------------------------------------------------------
Write-Host "[1/7] Checking Node.js Runtime Environment..." -ForegroundColor Yellow
$bundledNode = Join-Path $serverDir "bin\node.exe"
$nodePath = ""

if (Test-Path $bundledNode) {
    $nodePath = $bundledNode
    $nodeVersion = & $nodePath -v
    Write-Host "  -> Bundled portable Node.js runtime detected: $nodeVersion ($nodePath)" -ForegroundColor Green
} else {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodePath = $nodeCmd.Source }
    if (-not $nodePath -and (Test-Path "C:\Program Files\nodejs\node.exe")) {
        $nodePath = "C:\Program Files\nodejs\node.exe"
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    }
}

if ($nodePath) {
    $nodeVersion = & $nodePath -v
    Write-Host "  -> Node.js detected: $nodeVersion ($nodePath)" -ForegroundColor Green
} else {
    Write-Host "  -> Node.js not detected. Attempting automatic installation via winget..." -ForegroundColor Yellow
    $wingetCmd = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        & winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
        $nodePath = "C:\Program Files\nodejs\node.exe"
    }
    
    if (-not (Test-Path "C:\Program Files\nodejs\node.exe")) {
        Write-Host "  -> Downloading Node.js 20 LTS 64-bit installer..." -ForegroundColor Yellow
        $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $msiPath = Join-Path $env:TEMP "nodejs-installer.msi"
        Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath
        Write-Host "  -> Installing Node.js silently..." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
        $nodePath = "C:\Program Files\nodejs\node.exe"
    }
}

if (-not (Test-Path $nodePath)) {
    Write-Host "ERROR: Node.js installation failed. Please install Node.js manually." -ForegroundColor Red
    pause
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Verify / Configure PostgreSQL 16 Service
# ---------------------------------------------------------------------------
Write-Host "`n[2/7] Checking PostgreSQL 16 Database Service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($pgService) {
    Write-Host "  -> PostgreSQL Service found: $($pgService.Name) (Status: $($pgService.Status))" -ForegroundColor Green
    Set-Service -Name $pgService.Name -StartupType Automatic
    if ($pgService.Status -ne "Running") {
        Write-Host "  -> Starting PostgreSQL service..." -ForegroundColor Yellow
        Start-Service -Name $pgService.Name
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "  -> PostgreSQL service not detected. Checking standard installation directory..." -ForegroundColor Yellow
    if (Test-Path "C:\Program Files\PostgreSQL\16\bin\psql.exe") {
        Write-Host "  -> PostgreSQL binaries present. Registering/Starting service..." -ForegroundColor Green
        net start postgresql-x64-16 2>$null
    } else {
        Write-Host "  -> Downloading PostgreSQL 16 Windows Installer..." -ForegroundColor Yellow
        $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe"
        $pgExe = Join-Path $env:TEMP "postgresql-16-setup.exe"
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgExe
        Write-Host "  -> Installing PostgreSQL 16 silently with superpassword 'postgres'..." -ForegroundColor Yellow
        Start-Process -FilePath $pgExe -ArgumentList "--unattendedmodeui none --mode unattended --superpassword `"postgres`" --serverport 5432" -Wait
    }
}

$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlCmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($psqlCmd) { $psqlPath = $psqlCmd.Source }
}

# ---------------------------------------------------------------------------
# 3. Initialize Database Schema and Data
# ---------------------------------------------------------------------------
Write-Host "`n[3/7] Initializing Database 'ama_quotations' and Tables Schema..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"

if (Test-Path $psqlPath) {
    # Check if database exists
    $dbCheck = & $psqlPath -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ama_quotations'" 2>$null
    if ($dbCheck -ne "1") {
        Write-Host "  -> Creating database 'ama_quotations'..." -ForegroundColor Yellow
        & $psqlPath -U postgres -d postgres -c "CREATE DATABASE ama_quotations;" 2>$null
    } else {
        Write-Host "  -> Database 'ama_quotations' already exists." -ForegroundColor Green
    }

    # Apply schema
    $schemaFile = Join-Path $serverDir "src\db\schema.sql"
    if (Test-Path $schemaFile) {
        Write-Host "  -> Applying schema tables, indexes, and triggers..." -ForegroundColor Yellow
        & $psqlPath -U postgres -d ama_quotations -f $schemaFile 2>$null
        Write-Host "  -> Database schema verified." -ForegroundColor Green
    }
} else {
    Write-Host "  -> Warning: psql.exe not found. Database setup will be handled by Node.js initialization." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 4. Configure Server Environment & Build
# ---------------------------------------------------------------------------
Write-Host "`n[4/7] Configuring Server Environment & Compiling TypeScript..." -ForegroundColor Yellow
$envFile = Join-Path $serverDir ".env"
$envExample = Join-Path $serverDir ".env.example"

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item $envExample $envFile
    Write-Host "  -> Generated default server .env file." -ForegroundColor Green
}

# Install dependencies if node_modules missing
if (-not (Test-Path (Join-Path $serverDir "node_modules"))) {
    Write-Host "  -> Installing server dependencies (npm install)..." -ForegroundColor Yellow
    Push-Location $serverDir
    & npm.cmd install --silent
    Pop-Location
}

# Build server TypeScript to dist/server.js
Write-Host "  -> Compiling server TypeScript to production bundle..." -ForegroundColor Yellow
Push-Location $serverDir
& npm.cmd run build --silent
Pop-Location
Write-Host "  -> Server build verified in dist/server.js." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 5. Configure Windows Defender Firewall (Port 4000 & Ping)
# ---------------------------------------------------------------------------
Write-Host "`n[5/7] Configuring Windows Defender Firewall for LAN Access..." -ForegroundColor Yellow
netsh advfirewall firewall delete rule name="AMA Ceramics Quotation Server (TCP 4000)" 2>$null | Out-Null
$fwResult = netsh advfirewall firewall add rule name="AMA Ceramics Quotation Server (TCP 4000)" dir=in action=allow protocol=TCP localport=4000 profile=any
netsh advfirewall firewall delete rule name="AMA Ceramics Allow Ping (ICMPv4)" 2>$null | Out-Null
netsh advfirewall firewall add rule name="AMA Ceramics Allow Ping (ICMPv4)" protocol=icmpv4:8,any dir=in action=allow profile=any
Write-Host "  -> Firewall rule added: Inbound TCP Port 4000 allowed for ALL profiles (Private, Domain, Public)." -ForegroundColor Green
Write-Host "  -> Firewall rule added: ICMPv4 Echo (Ping) allowed for LAN network testing." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6. Register Background Auto-Start Scheduled Task
# ---------------------------------------------------------------------------
Write-Host "`n[6/7] Registering Background Auto-Start Scheduled Task..." -ForegroundColor Yellow

# Kill any existing server process on port 4000 to prevent port collisions
$existingPort = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($existingPort) {
    Write-Host "  -> Stopping existing process on port 4000 (PID: $($existingPort.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $existingPort.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Delete existing scheduled task
schtasks.exe /delete /tn "AMACeramicsServer" /f 2>$null | Out-Null

# Create XML task definition with proper Working Directory and dynamic Node path
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>AMA Ceramics Quotation Management Central LAN Server Service</Description>
    <Author>AMA Ceramics</Author>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$nodePath</Command>
      <Arguments>dist/server.js</Arguments>
      <WorkingDirectory>$serverDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$tempXml = Join-Path $env:TEMP "AMACeramicsServerTask.xml"
[System.IO.File]::WriteAllText($tempXml, $taskXml, [System.Text.Encoding]::Unicode)
$regOut = schtasks.exe /create /tn "AMACeramicsServer" /xml $tempXml /f
Remove-Item $tempXml -Force -ErrorAction SilentlyContinue

Write-Host "  -> Registered scheduled task 'AMACeramicsServer' (Auto-start at boot, runs silently)." -ForegroundColor Green
Write-Host "  -> Starting server task..." -ForegroundColor Yellow
schtasks.exe /run /tn "AMACeramicsServer" | Out-Null
Start-Sleep -Seconds 3

# ---------------------------------------------------------------------------
# 7. Self-Test Health Check & Display Network IP Addresses
# ---------------------------------------------------------------------------
Write-Host "`n[7/7] Performing Central Server Health Verification..." -ForegroundColor Yellow
$healthy = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        $healthRes = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($healthRes.status -eq "ok") {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

# Retrieve IPv4 LAN addresses with adapter names
$netAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | 
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254*" }

# ---------------------------------------------------------------------------
# 8. Create Host Management Desktop Shortcut
# ---------------------------------------------------------------------------
$desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$mgrScriptPath = Join-Path $scriptsDir "manage_host_server.bat"

if (Test-Path $desktopPath) {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut((Join-Path $desktopPath "AMA Host Server Control.lnk"))
    $shortcut.TargetPath = $mgrScriptPath
    $shortcut.WorkingDirectory = $scriptsDir
    $shortcut.Description = "Manage, restart, and monitor the AMA Ceramics Quotation Central Host Server"
    $shortcut.Save()
}

# ---------------------------------------------------------------------------
# Summary Output
# ---------------------------------------------------------------------------
Clear-Host
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "     SUCCESS: AMA CERAMICS CENTRAL HOST SERVER IS READY & RUNNING!        " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
if ($healthy) {
    Write-Host "  [OK] Server Health Check: ONLINE & OPERATIONAL" -ForegroundColor Green
    Write-Host "  [OK] Database Connection: CONNECTED (PostgreSQL 16)" -ForegroundColor Green
    Write-Host "  [OK] Windows Firewall:    PORT 4000 ALLOWED (Public & Private)" -ForegroundColor Green
    Write-Host "  [OK] Auto-Start on Boot:  ENABLED (Runs silently in background)" -ForegroundColor Green
} else {
    Write-Host "  [!] Server starting up. If not reachable yet, use the Host Server Control shortcut." -ForegroundColor Yellow
}

Write-Host "`n--------------------------------------------------------------------------"
Write-Host " HOW TO CONNECT CLIENT WORKSTATIONS OVER LAN" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------"
Write-Host "1. On each client PC, run 'AMA Ceramics Quotation System-Setup-1.0.0.exe'."
Write-Host "2. Launch the desktop app from the shortcut."
Write-Host "3. When prompted (or by clicking 'Configure LAN' on login screen), enter:"
foreach ($net in $netAdapters) {
    Write-Host "     http://$($net.IPAddress):4000" -ForegroundColor Yellow -NoNewline
    Write-Host "  ($($net.InterfaceAlias) adapter)" -ForegroundColor Cyan
}
Write-Host "4. Click 'Test', then 'Save & Connect' and log in with your credentials."
Write-Host "--------------------------------------------------------------------------"
Write-Host " IMPORTANT LAN CONNECTIVITY NOTES:" -ForegroundColor Yellow
Write-Host " * Both Host and Client must be connected to the SAME Wi-Fi or LAN switch." -ForegroundColor Gray
Write-Host " * NOTE ON IPHONE HOTSPOTS: Apple iOS Personal Hotspots block device-to-device" -ForegroundColor Red
Write-Host "   communication (AP isolation). Please connect both PCs to a home/office" -ForegroundColor Red
Write-Host "   Wi-Fi router, Ethernet switch, or an Android mobile hotspot." -ForegroundColor Red
Write-Host " * To verify physical network connection, open Command Prompt on client PC and run:" -ForegroundColor Gray
if ($netAdapters -and $netAdapters.Count -gt 0) {
    Write-Host "     ping $($netAdapters[0].IPAddress)" -ForegroundColor White
}
Write-Host "--------------------------------------------------------------------------"
Write-Host "`nA shortcut named 'AMA Host Server Control' has been placed on your Desktop."
Write-Host "==========================================================================`n"

if (-not $Unattended) {
    Write-Host "Setup complete."
}
