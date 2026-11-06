# 🩸 Musthafa Hussain - Blood Bank Management System (BBMS)

A web-based **Blood Bank Management System** developed by **Musthafa Hussain**, built with **Node.js, Express, and MySQL**, connected directly to **MySQL Workbench** with responsive interfaces matching the Hostel Management System architecture.

---

## 📋 Database Tables (3 Tables)

The database `blood_bank_db` manages three interconnected tables:

### 1. `donors`
Stores volunteer blood donors, blood groups, contact information, and medical eligibility.
- `donor_id` (INT PRIMARY KEY)
- `donor_name` (VARCHAR(100) NOT NULL)
- `blood_group` (VARCHAR(10) NOT NULL) — `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`
- `age` (INT NOT NULL)
- `gender` (VARCHAR(20) NOT NULL) — `Male`, `Female`, `Other`
- `contact` (VARCHAR(25) NOT NULL)
- `city` (VARCHAR(100) NOT NULL)
- `last_donation_date` (DATE NULL)
- `status` (VARCHAR(30) NOT NULL) — `Eligible`, `Recently Donated`, `Deferred`

### 2. `blood_stock`
Tracks real-time reserve inventory across all 8 standard blood types.
- `stock_id` (INT PRIMARY KEY)
- `blood_group` (VARCHAR(10) NOT NULL UNIQUE)
- `units` (INT NOT NULL DEFAULT 0)
- `status` (VARCHAR(30) NOT NULL) — `Sufficient` (>= 15), `Moderate` (6–14), `Critical` (<= 5)
- `last_updated` (TIMESTAMP)

### 3. `blood_requests`
Manages hospital and patient blood requisitions with urgency classification and auto-deduction.
- `request_id` (INT PRIMARY KEY)
- `patient_name` (VARCHAR(100) NOT NULL)
- `hospital_name` (VARCHAR(150) NOT NULL)
- `blood_group` (VARCHAR(10) NOT NULL)
- `units_requested` (INT NOT NULL)
- `urgency` (VARCHAR(30) NOT NULL) — `Critical`, `Urgent`, `Normal`
- `status` (VARCHAR(30) NOT NULL) — `Pending`, `Approved`, `Fulfilled`, `Rejected`
- `request_date` (DATE NOT NULL)
- `contact_person` (VARCHAR(100) NOT NULL)

---

## 🗄️ MySQL Workbench Connection Guide

The system is configured to connect to your local MySQL 8.0 server:
- **Host**: `localhost`
- **Port**: `3306`
- **User**: `root`
- **Password**: `root` (or configured via environment variable `DB_PASSWORD`)
- **Database**: `blood_bank_db`

### How to View & Manage in MySQL Workbench:
1. Open **MySQL Workbench 8.0**.
2. Click on your local MySQL connection (e.g., **Local instance MySQL80**).
3. In the left **Navigator** sidebar under **Schemas**, look for `blood_bank_db`.
4. Expand `blood_bank_db` -> **Tables** to see:
   - `donors`
   - `blood_stock`
   - `blood_requests`
5. Right-click any table and select **Select Rows - Limit 1000** to view live data.
6. To re-import or reset data at any time, open `database.sql` inside MySQL Workbench:
   - Go to **File -> Open SQL Script...**
   - Select `C:\Users\Dell\.gemini\antigravity\scratch\blood-bank-management\database.sql`
   - Click the ⚡ **Execute (Lightning bolt)** button.

### Useful Workbench Views & Queries Included in `database.sql`:
```sql
USE blood_bank_db;

-- 1. Check all blood stock with status
SELECT * FROM blood_stock ORDER BY units ASC;

-- 2. View critical blood shortages (<= 5 units)
SELECT * FROM vw_critical_blood_shortage;

-- 3. View pending emergency hospital requests
SELECT * FROM vw_pending_requests;

-- 4. View eligible donors ready for donation drive
SELECT * FROM vw_eligible_donors;
```

---

## 📁 Project Structure

```
blood-bank-management/
├── index.html           # Executive Dashboard (Live stats, 8 blood group cards, recent tables)
├── donors.html          # List All Donors (Filter by group/status, search, actions)
├── insert-donor.html    # Register New Donor form (Inserts into table: donors)
├── update-donor.html    # Update Donor info (Step 1 Fetch, Step 2 Edit & Save)
├── search-donor.html    # Search Required Donor (Detailed profile card lookup)
├── delete-donor.html    # Delete Donor (Preview card with confirmation)
├── stock.html           # Blood Stock Inventory (Visual units counters, quick +/- adjustments)
├── requests.html        # Hospital Requisitions (Approve, Fulfill with auto-stock deduction, Reject)
├── insert-request.html  # Submit Blood Requisition form (Inserts into table: blood_requests)
├── style.css            # Medical Crimson & Slate modern stylesheet
├── client-api.js        # Universal frontend connector to MySQL REST API + offline fallback
├── server.js            # Node.js Express REST API connected to MySQL Workbench
├── database.sql         # Complete MySQL schema, tables, views, and seed data
├── start.bat            # One-click Windows startup batch script
├── test-api.js          # Automated end-to-end integration test suite
├── package.json         # Dependencies (express, mysql2, cors)
├── donors.json          # Standalone fallback storage
├── blood_stock.json     # Standalone fallback storage
└── blood_requests.json  # Standalone fallback storage
```

---

## 🚀 How to Run the Application

### Method 1: Using `start.bat` (Recommended for Windows)
Simply double-click `start.bat` in the folder:
`C:\Users\Dell\.gemini\antigravity\scratch\blood-bank-management\start.bat`

It will launch the Express server and open `http://localhost:3000` automatically in your default browser.

### Method 2: From PowerShell / Command Line
1. Open PowerShell:
   ```powershell
   cd C:\Users\Dell\.gemini\antigravity\scratch\blood-bank-management
   ```
2. Start the server:
   ```powershell
   node server.js
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Method 3: Run Automated Test Suite
To verify all REST API endpoints and MySQL Workbench integration:
```powershell
node test-api.js
```
