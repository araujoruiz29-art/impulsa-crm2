@echo off
title Caminante CRM - Servidor Local
cd /d "%~dp0"
echo ===================================================
echo   Iniciando Caminante Corporativo CRM (Puerto 3000)
echo ===================================================
echo.
echo Iniciando servidor... el navegador se abrira en 3 segundos.
echo (No cierres esta ventana mientras uses el CRM)
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
node node_modules\next\dist\bin\next start -p 3000
pause
