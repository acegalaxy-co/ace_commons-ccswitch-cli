@echo off
REM Nhap dup de NANG CAP mot tu bo nho da cai (cu) len ban kit MOI. Giu nguyen du lieu cua ban.
cd /d "%~dp0\.."
echo NANG CAP tu bo nho
set /p p="Dan duong dan THU MUC BO NHO cua ban roi Enter: "
if "%p%"=="" ( echo Bo trong -^> huy. & pause & exit /b )
node tools\nang-cap.mjs "%p%"
echo.
pause
