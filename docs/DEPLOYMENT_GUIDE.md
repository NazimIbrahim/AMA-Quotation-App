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

The entire Central Server environment can be installed and configured in **1 click** using either method below:

### Option A: Standalone Setup Executable (Recommended for Non-Technical Users)
1. Download `AMA-Ceramics-Host-Server-Setup-1.0.0.exe` from GitHub Releases.
2. Run the installer as Administrator.
3. The wizard extracts the server files, installs and initializes PostgreSQL 16, creates the database schema, opens Windows Firewall port 4000, and registers the background boot service automatically.
4. Note the displayed Host Server IP address (e.g. `http://172.20.10.2:4000`).

### Option B: 1-Click Setup Batch Launcher (From Source / Repository)
1. Open the project root folder on the Host PC (`D:\AMA-Qutation App`).
2. Double-click `Setup-Host-Server.bat`.
3. Accept the Administrator UAC prompt.
4. The automated script will:
   - Verify/configure Node.js and PostgreSQL 16
   - Create the `ama_quotations` database and run `schema.sql`
   - Build the server bundle (`dist/server.js`)
   - Add the Windows Firewall inbound rule for TCP Port 4000
   - Register the Windows Task Scheduler background service `AMACeramicsServer` (auto-boot at startup)
   - Perform a health check and print the LAN IP address for client connections.

### Managing the Host Server
A desktop shortcut named **"AMA Host Server Control"** is placed on the host desktop. Double-clicking it opens an interactive menu allowing you to:
- Check server online/offline health status
- View active host IP addresses
- Restart or stop the server service
- Take immediate on-demand database backups
- Open server logs

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
