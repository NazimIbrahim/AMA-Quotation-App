# AMA Ceramics Quotation System

An enterprise-grade, multi-user Windows desktop quotation management system designed specifically for ceramic tile showrooms, building material distributors, and sales teams. 

Engineered from the ground up to deliver **sub-500ms response times** and operate smoothly on **low-end office computers with 4 GB RAM**, connecting over a local area network (LAN) to a centralized PostgreSQL database.

---

## Key Features

### 1. Operations & Quotation Management
- **Hierarchical Quotation Structure**: Organize line items by room/area (Living Room, Kitchen, Master Bathroom, Balcony, etc.) with tile size, finish, grade, quantity (boxes/sq.ft), rate, and custom discounts.
- **Automated Financial Calculations**: Real-time GST computation (CGST, SGST, IGST), line discounts, and automated conversion of total amounts into words (Indian numbering system).
- **In-App PDF Generation & Preview**: Instant, client-side preview modal with zoom, download, and direct-to-printer capabilities for professional, branded quotation documents and payment receipts.
- **Workflow State Management**: Multi-stage approval lifecycle (*Draft*, *In-Review*, *Approved*, *Closed*, *Rejected*) with concurrency protection and collision-free sequential numbering (`AMA-YYYY-XXXXX`).

### 2. Dedicated Salesperson Dashboard & Team Hub
- **Sales Team Overview**: Quick-filter by sales associate with avatar chips, contact info, and individual sales target badges.
- **Real-Time KPI Cards**:
  - **Monthly Target vs Actual**: Live achievement tracker with visual progress bar.
  - **Total Quotations Issued**: Volume metrics broken down by status (*Approved*, *Review*, *Draft*).
  - **Collections Realized**: Cash, Bank Transfer, NEFT/RTGS, and UPI payments received.
  - **Outstanding Balance Due**: Real-time receivables tracking per sales representative.
- **On-the-Fly Salesperson Onboarding**: Instant registration modal for adding sales associates with credentials and monthly targets.

### 3. Payments, Receipts & Receivables
- Track customer advances, milestone payments, and settlement receipts.
- Instant receipt printing with payment reference numbers (`RCP-YYYY-XXXXX`).
- Real-time customer balance updates and accounts reconciliation.

### 4. Enterprise Architecture & Low-Memory Optimizations
- **Client App Memory Footprint**: Minimalist Electron + React + Vite architecture (~60 MB idle RAM, peak ~110 MB under heavy export loads).
- **Virtualization & Pagination**: High-performance paginated queries and debounced search capable of effortlessly navigating 10,000+ quotation datasets.
- **Real-time LAN Synchronization**: Efficient WebSocket event bus notifying connected client workstations instantly of quotation updates, payment approvals, and customer records.
- **Offline Resiliency & Auto-Reconnect**: Automatic heartbeat monitoring with one-click LAN server configuration wizard.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Electron 33 (Context isolation, secure IPC, minimal preload footprint) |
| **User Interface** | React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Frontend Bundler** | Vite 5 (Optimized chunking, uncompressed bundle ~185 KB) |
| **Backend API** | Node.js, Express, TypeScript, WebSocket (`ws`) |
| **Database** | PostgreSQL 16 (Connection pooling, row-level locks, transactions) |
| **Installer** | Electron Builder (NSIS Windows x64 Installer) |

---

## Getting Started

### 1. Central Host Server Setup (Run on the Designated Server PC)

You can set up the host server automatically using **either** of the following single setup methods:

#### Method A: 1-Click Setup Executable (Easiest)
1. Download [**`AMA-Ceramics-Host-Server-Setup-1.3.0.exe`**](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/download/v1.3/AMA-Ceramics-Host-Server-Setup-1.3.0.exe) from [**Latest Releases (v1.3)**](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/tag/v1.3).
2. Run the installer as Administrator.
   - Configures PostgreSQL 16 database & initializes the `ama_quotations` schema and seed data.
   - Configures Windows Defender Firewall inbound rule (Port 4000).
   - Registers a silent Windows background service (`AMACeramicsServer`) that auto-starts on boot.
   - Displays the Host PC's LAN IP address (e.g., `http://192.168.1.100:4000`).
   - Places an **AMA Host Server Control** shortcut on your Desktop to monitor, restart, and backup the server.

#### Method B: 1-Click Setup Batch Script (From Source / Git)
1. Clone or download this repository on the Host PC.
2. Double-click [**`Setup-Host-Server.bat`**](Setup-Host-Server.bat) in the root folder.
3. Allow the Administrator UAC prompt. The script performs all configuration unattended and outputs your LAN IP address.

---

### 2. Client Installation (Run on all Office / Sales Workstations)

1. Download [**`AMA-Ceramics-Quotation-System-Setup-1.3.0.exe`**](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/download/v1.3/AMA-Ceramics-Quotation-System-Setup-1.3.0.exe) from [**Latest Releases (v1.3)**](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/tag/v1.3).
2. Run the installer on each Windows workstation (supports Windows 10/11 x64, 4 GB RAM machines).
3. Launch **AMA Ceramics Quotation System** from the Desktop shortcut.
4. On first launch, enter your Host Server LAN address:
   ```
   http://<HOST-SERVER-IP>:4000
   ```
   *(e.g., `http://192.168.1.100:4000` or the IP displayed during Host Setup)*.
5. Click **Test Connection**, then save and log in with your assigned role credentials:
   - **Administrator**: `admin` / `adminpassword123`
   - **Store Manager**: `manager` / `managerpassword123`
   - **Sales Associate**: `yasmin` / `salespassword123`
   - **Accounts**: `accounts` / `accountspassword123`

---

## Development & Building from Source

### Client (Electron + React)
```cmd
cd client
npm install
npm run dev              # Run Vite development server
npm run electron:dev     # Launch Electron in development mode
npm run build            # Compile TypeScript and bundle frontend
npm run package:win      # Build Windows NSIS setup executable
```

### Server (Node.js API)
```cmd
cd server
npm install
npm run dev              # Run development server with live reload
npm run build            # Compile TypeScript to dist/
npm start                # Run production server
```

---

## Security & Reliability
- **Strict Role-Based Access Control (RBAC)**: Admin, Manager, Salesperson, and Accounts roles.
- **Electron Security**: Node integration disabled in renderers, context isolation enforced, strictly validated IPC channels.
- **Data Integrity**: Financial transactions wrapped in PostgreSQL ACID transactions; audit logging recorded for all critical entity mutations.
- **Automated Backups**: Built-in automated database snapshot and restore tools.

---

## License & Copyright
Copyright &copy; 2026 AMA Ceramics Pvt Ltd. All rights reserved.
