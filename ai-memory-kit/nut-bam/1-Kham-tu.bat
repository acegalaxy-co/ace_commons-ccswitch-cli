@echo off
REM Nhap dup de KHAM + DON tu bo nho (chay bac si).
cd /d "%~dp0\.."
echo Dang kham tu bo nho...
echo.
node tools\memory-doctor.mjs --fix
echo.
pause
