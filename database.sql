-- ========================================================
-- Musthafa Hussain - Blood Bank Management System (BBMS) Database Script
-- Compatible with MySQL Server 8.0 & MySQL Workbench
-- ========================================================

CREATE DATABASE IF NOT EXISTS blood_bank_db;
USE blood_bank_db;

-- ========================================================
-- 1. TABLE: donors
-- Stores donor personal details, blood group, contact & eligibility
-- ========================================================
CREATE TABLE IF NOT EXISTS donors (
    donor_id INT PRIMARY KEY,
    donor_name VARCHAR(100) NOT NULL,
    blood_group VARCHAR(10) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(20) NOT NULL,
    contact VARCHAR(25) NOT NULL,
    city VARCHAR(100) NOT NULL,
    last_donation_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Eligible'
);

-- ========================================================
-- 2. TABLE: blood_stock
-- Tracks available blood units & stock health for every blood type
-- ========================================================
CREATE TABLE IF NOT EXISTS blood_stock (
    stock_id INT PRIMARY KEY,
    blood_group VARCHAR(10) NOT NULL UNIQUE,
    units INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Sufficient',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================================================
-- 3. TABLE: blood_requests
-- Manages hospital/patient blood requisitions, urgency & status
-- ========================================================
CREATE TABLE IF NOT EXISTS blood_requests (
    request_id INT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(150) NOT NULL,
    blood_group VARCHAR(10) NOT NULL,
    units_requested INT NOT NULL,
    urgency VARCHAR(30) NOT NULL DEFAULT 'Normal',
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    request_date DATE NOT NULL,
    contact_person VARCHAR(100) NOT NULL
);

-- ========================================================
-- INITIAL SEED DATA FOR DONORS
-- ========================================================
INSERT INTO donors (donor_id, donor_name, blood_group, age, gender, contact, city, last_donation_date, status) VALUES
(101, 'Aarav Sharma', 'A+', 28, 'Male', '+91 98765-43210', 'Mumbai', '2026-08-15', 'Eligible'),
(102, 'Priya Patel', 'O+', 24, 'Female', '+91 98234-56789', 'Ahmedabad', '2026-09-10', 'Eligible'),
(103, 'Rahul Verma', 'B+', 32, 'Male', '+91 97123-89012', 'Delhi', '2026-10-01', 'Eligible'),
(104, 'Sneha Reddy', 'AB+', 26, 'Female', '+91 96543-21098', 'Hyderabad', '2026-07-20', 'Eligible'),
(105, 'Vikram Singh', 'O-', 35, 'Male', '+91 95432-10987', 'Jaipur', '2026-06-12', 'Eligible'),
(106, 'Ananya Iyer', 'A-', 29, 'Female', '+91 94321-09876', 'Chennai', '2026-10-25', 'Recently Donated'),
(107, 'Karan Malhotra', 'B-', 41, 'Male', '+91 93210-98765', 'Bengaluru', '2026-05-18', 'Eligible'),
(108, 'Neha Joshi', 'AB-', 23, 'Female', '+91 92109-87654', 'Pune', '2026-04-14', 'Deferred')
ON DUPLICATE KEY UPDATE 
    donor_name = VALUES(donor_name),
    blood_group = VALUES(blood_group),
    age = VALUES(age),
    gender = VALUES(gender),
    contact = VALUES(contact),
    city = VALUES(city),
    last_donation_date = VALUES(last_donation_date),
    status = VALUES(status);

-- ========================================================
-- INITIAL SEED DATA FOR BLOOD_STOCK (8 Standard Blood Groups)
-- Statuses: Sufficient (>= 15), Moderate (6 - 14), Critical (<= 5)
-- ========================================================
INSERT INTO blood_stock (stock_id, blood_group, units, status) VALUES
(1, 'A+', 24, 'Sufficient'),
(2, 'A-', 8, 'Moderate'),
(3, 'B+', 30, 'Sufficient'),
(4, 'B-', 5, 'Critical'),
(5, 'AB+', 18, 'Sufficient'),
(6, 'AB-', 3, 'Critical'),
(7, 'O+', 35, 'Sufficient'),
(8, 'O-', 4, 'Critical')
ON DUPLICATE KEY UPDATE
    blood_group = VALUES(blood_group),
    units = VALUES(units),
    status = VALUES(status);

-- ========================================================
-- INITIAL SEED DATA FOR BLOOD_REQUESTS
-- ========================================================
INSERT INTO blood_requests (request_id, patient_name, hospital_name, blood_group, units_requested, urgency, status, request_date, contact_person) VALUES
(501, 'Ramesh Nair', 'City Care Hospital', 'O-', 2, 'Critical', 'Pending', '2026-11-04', 'Dr. S. Kulkarni (98877-11223)'),
(502, 'Kavita Menon', 'Apollo Health Institute', 'B+', 3, 'Urgent', 'Approved', '2026-11-05', 'Dr. R. Mehta (97766-22334)'),
(503, 'Aditya Saxena', 'Fortis Specialty Center', 'AB-', 1, 'Critical', 'Pending', '2026-11-06', 'Dr. A. Roy (96655-33445)'),
(504, 'Sunita Das', 'Max Super Specialty Hospital', 'A+', 2, 'Normal', 'Fulfilled', '2026-11-02', 'Staff Nurse Tina (95544-44556)'),
(505, 'Manish Guha', 'Lilavati Medical Center', 'B-', 1, 'Urgent', 'Approved', '2026-11-05', 'Dr. V. Rao (94433-55667)')
ON DUPLICATE KEY UPDATE
    patient_name = VALUES(patient_name),
    hospital_name = VALUES(hospital_name),
    blood_group = VALUES(blood_group),
    units_requested = VALUES(units_requested),
    urgency = VALUES(urgency),
    status = VALUES(status),
    request_date = VALUES(request_date),
    contact_person = VALUES(contact_person);

-- ========================================================
-- USEFUL VIEWS FOR MYSQL WORKBENCH REPORTING
-- ========================================================
CREATE OR REPLACE VIEW vw_critical_blood_shortage AS
SELECT stock_id, blood_group, units, status, last_updated 
FROM blood_stock 
WHERE units <= 5;

CREATE OR REPLACE VIEW vw_pending_requests AS
SELECT request_id, patient_name, hospital_name, blood_group, units_requested, urgency, request_date, contact_person
FROM blood_requests
WHERE status = 'Pending'
ORDER BY FIELD(urgency, 'Critical', 'Urgent', 'Normal'), request_date ASC;

CREATE OR REPLACE VIEW vw_eligible_donors AS
SELECT donor_id, donor_name, blood_group, age, contact, city, last_donation_date
FROM donors
WHERE status = 'Eligible'
ORDER BY blood_group, donor_name;

-- ========================================================
-- VERIFICATION QUERIES FOR MYSQL WORKBENCH
-- ========================================================
SELECT '=== DONORS ===' AS Table_Name;
SELECT * FROM donors;

SELECT '=== BLOOD STOCK ===' AS Table_Name;
SELECT * FROM blood_stock;

SELECT '=== BLOOD REQUESTS ===' AS Table_Name;
SELECT * FROM blood_requests;

SELECT '=== CRITICAL SHORTAGE ALERT ===' AS Table_Name;
SELECT * FROM vw_critical_blood_shortage;
