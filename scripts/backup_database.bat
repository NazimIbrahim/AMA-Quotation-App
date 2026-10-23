@echo off
:: ====================================================================
:: AMA Ceramics Quotation System - Automated Database Backup Script
:: Can be scheduled via Windows Task Scheduler for daily night backups
:: ====================================================================

set "BACKUP_DIR=%~dp0..\backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Timestamp format YYYY-MM-DD_HHMM
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,4%"
set "BACKUP_FILE=%BACKUP_DIR%\ama_quotations_backup_%TIMESTAMP%.sql"

echo Creating PostgreSQL backup to: %BACKUP_FILE%

set "PGPASSWORD=postgres"
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h localhost -p 5432 -U postgres -d ama_quotations -F p -f "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo Backup completed successfully.
) else (
    echo Backup failed with error code %errorlevel%.
)
