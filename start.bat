@echo off
title Musthafa Hussain - Blood Bank Management System (BBMS)
cd /d "%~dp0"

echo ===================================================
echo   Musthafa Hussain - Blood Bank Management System
echo   Connected to MySQL Server & MySQL Workbench
echo ===================================================
echo.
echo Database: blood_bank_db
echo Tables:
echo   1. donors
echo   2. blood_stock
echo   3. blood_requests
echo.
echo Starting Express API Server on http://localhost:3000 ...
echo.

start "" "http://localhost:3000"
node server.js
pause
