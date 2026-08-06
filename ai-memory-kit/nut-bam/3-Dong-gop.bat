@echo off
REM Nhap dup de DONG GOP NGUOC cai tien phan KHUNG cho maintainer (tu quet ro, khong goi du lieu rieng).
cd /d "%~dp0\.."
echo DONG GOP NGUOC
set /p d="Mo ta ngan de xuat cua ban: "
set /p b="Ten cong ty/ban de quet ro chan (cach nhau dau phay, co the bo trong): "
if "%b%"=="" ( node tools\dong-gop.mjs "%d%" ) else ( node tools\dong-gop.mjs "%d%" --block "%b%" )
echo.
pause
