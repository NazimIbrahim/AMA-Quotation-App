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

### Prerequisites
- **Client Workstation**: Windows 10 or 11 (64-bit), 4 GB RAM minimum.
- **Server PC**: Windows 10/11 or Windows Server with Node.js 18+ and PostgreSQL 16.

---

### Client Installation (Desktop App)
1. Download the latest installer from [**Releases**](https://github.com/NazimIbrahim/AMA-Quotation-App/releases).
2. Run `AMA Ceramics Quotation System-Setup-1.0.0.exe`.
3. Follow the setup wizard or run silently via command line:
   ```cmd
   "AMA Ceramics Quotation System-Setup-1.0.0.exe" /S
   ```
4. On first launch, enter your LAN Server IP address (e.g., `http://192.168.1.100:4000`) in the server setup prompt.

---

### Central Server Setup (Designated Host PC)

1. **Install PostgreSQL 16**:
   - Create a database named `ama_quotations`.
   - Execute the initialization schema:
     ```cmd
     psql -U postgres -d ama_quotations -f server/src/db/schema.sql
     ```

2. **Configure Environment**:
   - Copy `server/.env.example` to `server/.env` and update credentials:
     ```env
     PORT=4000
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=ama_quotations
     DB_USER=postgres
     DB_PASSWORD=your_password
     JWT_SECRET=your_secure_random_key
     ```

3. **Install Dependencies & Start**:
   ```cmd
   cd server
   npm install
   npm run build
   npm start
   ```

4. **Firewall Configuration**:
   - Open TCP Port 4000 in Windows Defender Firewall:
     ```cmd
     netsh advfirewall firewall add rule name="AMA Quotation Server" dir=in action=allow protocol=TCP localport=4000
     ```

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
