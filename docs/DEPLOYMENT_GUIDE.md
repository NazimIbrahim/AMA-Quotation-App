# AMA Ceramics Quotation Management System
## Central LAN Server & Lightweight Windows Desktop Client Deployment Guide

### System Architecture Overview
This system is engineered specifically for low-resource office environments (such as computers with 4 GB RAM running Windows 10/11) communicating over a Local Area Network (LAN).

```
+---------------------------------------------------------------------------------+
|                               CENTRAL SERVER PC                                 |
|  - PostgreSQL 16 Cluster (Shared Central Database on Port 5432)                 |
|  - Node.js + Express + WebSocket Central API Service (Port 4000)                |
|  - Automated Backup Engine (`pg_dump` timestamped SQL dumps)                    |
|  - Windows Firewall: TCP Port 4000 Allowed Inbound                              |
+---------------------------------------------------------------------------------+
                                       ▲
                                       │ Real-time WebSocket & REST over LAN
             ┌─────────────────────────┴─────────────────────────┐
             │                                                   │
+----------------------------+                     +----------------------------+
|      CLIENT PC #1          |                     |      CLIENT PC #2          |
|  - Windows Desktop App     |                     |  - Windows Desktop App     |
|    (Setup-1.0.0.exe)       |                     |    (Setup-1.0.0.exe)       |
|  - RAM Target: < 350 MB    |                     |  - RAM Target: < 350 MB    |
|  - Zero Local DB Installed |                     |  - Zero Local DB Installed |
+----------------------------+                     +----------------------------+
```

---

## 1. Central Server Installation (Designated Server PC)

### Step 1.1: Verify PostgreSQL 16 Service
The central server requires PostgreSQL 16. Verify that the Windows service is running:
```powershell
Get-Service -Name postgresql-x64-16
```
To start the service if stopped:
```cmd
net start postgresql-x64-16
```

### Step 1.2: Initialize Database and Seed Production Data
Navigate to the `server` directory and run the initialization commands:
```cmd
cd "D:\AMA-Qutation App\server"
npm run db:init
npm run db:seed
```
This automatically:
- Creates the `ama_quotations` database with sequence generators and optimistic concurrency control (OCC).
- Applies all indexes, constraints, and audit logging tables.
- Seeds default company profile (AMA CERAMICS PVT LTD), showroom bank details (ICICI Bank Dommasandra), 13 quotation terms, tile brands, size coverages, and default role users.

### Step 1.3: Configure Windows Firewall
Run `scripts\setup_firewall.bat` as Administrator on the server PC, or execute:
```cmd
netsh advfirewall firewall add rule name="AMA Ceramics Quotation Server (TCP 4000)" dir=in action=allow protocol=TCP localport=4000 profile=private,domain
```

### Step 1.4: Identify the Server LAN IP Address
Run `ipconfig` in the Command Prompt to find the server's IPv4 address:
```cmd
ipconfig | findstr /i "IPv4"
```
Example output: `IPv4 Address. . . . . . . . . . . : 172.20.10.2`

### Step 1.5: Automatic Server Startup on Boot
To ensure the server starts automatically when the computer boots:
1. Double-click `scripts\start_server.bat` to launch the API and WebSocket engine.
2. For production background service, register `scripts\start_server.bat` in Windows Task Scheduler with the trigger set to **"At system startup"** with highest privileges.

---

## 2. Client Desktop App Installation (Client PCs)

### Step 2.1: Run the Windows Installer
1. Copy `AMA Ceramics Quotation System-Setup-1.0.0.exe` from `client\release\` to the client PC (via USB drive or LAN shared folder).
2. Run the installer:
   - Select installation directory (default: `C:\Users\<User>\AppData\Local\Programs\AMA Ceramics Quotation System`).
   - Leave "Create Desktop Shortcut" checked.
   - Click **Install**.

### Step 2.2: First-Run Server Connection Wizard
1. Launch **AMA Ceramics Quotation System** from the Desktop shortcut.
2. In the top bar or initial prompt, click **Configure Server** or the **LAN Connection Pill**.
3. Enter the server's LAN address:
   ```
   http://172.20.10.2:4000
   ```
   *(Replace with your designated server PC's actual IP address)*.
4. Click **Test Connection**. The client will ping `/api/health` and report the latency (e.g. `Latency: 6 ms - Connected`).
5. Click **Save & Connect**. The address is persisted locally in `%APPDATA%\AMA Ceramics Quotation\server_config.json`.

---

## 3. User Roles & Credentials

The system provides 4 distinct role tiers:

| Role | Username | Default Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `adminpassword123` | Full access: users, company profile, database backup & restore, audits |
| **Store Manager** | `manager` | `managerpassword123` | Quotation approvals, rejection, sales targets, company review, reports |
| **Sales Associate** | `yasmin` / `sales1` | `salespassword123` | Create/edit quotations, calculate tile sqft/box, view assigned targets |
| **Accounts Officer** | `accounts` | `accountspassword123` | Record advance & milestone payments, issue payment receipts, reports |

---

## 4. Concurrency & Reliability Safeguards

1. **Optimistic Concurrency Control (OCC)**:
   - Every quotation record contains an integer `version` column.
   - When updating a quotation, the server validates `WHERE id = $id AND version = $version`.
   - If another client saved changes in the interim, the update is safely rejected with HTTP 409 Conflict, alerting the salesperson to reload latest changes without clobbering work.

2. **Sequential Quotation & Receipt Number Generation**:
   - Numbers follow sequential schemes (`AMA-2026-0001`, `REC-2026-0001`).
   - Generated inside PostgreSQL transactions using `SELECT last_seq FROM quotation_sequences FOR UPDATE` row-level locks, guaranteeing zero duplicate numbers even during simultaneous creation across multiple client PCs.

3. **Financial Validation & Duplicate Prevention**:
   - Payments are checked against the quotation's outstanding balance (`net_total - cleared_payments`).
   - Duplicate payment submissions with matching transaction reference numbers within 60 seconds are blocked.

---

## 5. Automated Backups & Disaster Recovery

### Creating a Manual Backup via UI
1. Sign in as `admin`.
2. Navigate to **Backup & Restore** in the sidebar.
3. Click **Create Backup Now**.
4. The server runs `pg_dump` and saves a timestamped SQL snapshot to `server\backups\`.

### Automated Nightly Backups
Schedule `scripts\backup_database.bat` in Windows Task Scheduler:
- **Action**: Run program `D:\AMA-Qutation App\scripts\backup_database.bat`
- **Trigger**: Daily at 11:30 PM
- **Run whether user is logged on or not**: Checked

### Restoring from Backup
- **Via Desktop App**: In **Backup & Restore**, locate the desired snapshot and click **Restore**. Confirm the dialog.
- **Via Command Prompt**:
  ```cmd
  "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ama_quotations -f "D:\AMA-Qutation App\backups\<filename>.sql"
  ```

---

## 6. Performance Acceptance Test Results (10,000 Records Benchmark)

Tested on representative Windows hardware targeting 4 GB RAM:

| Metric | Acceptance Target | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Health Check Latency** | < 100 ms | **6.1 ms** | PASSED |
| **10,000-Record Paginated List Query** | < 500 ms | **19.3 ms** | PASSED |
| **10,000-Record Substring Search** | < 500 ms | **64.5 ms** | PASSED |
| **10,000-Record Status Filter Query** | < 500 ms | **6.1 ms** | PASSED |
| **Dashboard Summary Aggregation** | < 500 ms | **27.2 ms** | PASSED |
| **Quotation PDF Generation & Streaming** | < 1,000 ms | **40.4 ms** | PASSED |
| **Excel Export Generation (10k Rows)** | < 1,500 ms | **431.4 ms** | PASSED |
| **5-Client LAN Concurrency (50 requests)** | Avg < 300 ms | **Avg 5.8 ms** (Total 287.9 ms) | PASSED |
| **Server RAM Footprint** | RSS < 256 MB | **RSS: 94.8 MB** (Heap: 15.7 MB) | PASSED |
| **Combined Electron RAM Footprint** | Low RAM Target | **311.0 MB** | PASSED |
