@echo off
title Impulsa CRM - Tunel HTTPS para Webhook Meta / WhatsApp
cd /d "%~dp0"
echo ===============================================================
echo   Iniciando Tunel HTTPS gratuito (Cloudflare Tunnel -> :3000)
echo ===============================================================
echo.
echo Copia la URL https://xxxx.trycloudflare.com que aparecera abajo
echo y pegala en Conexiones y empresa ^> Meta Cloud API ^> URL Publica HTTPS.
echo.
echo En Meta Developers pega:
echo   URL de devolucion de llamada: https://xxxx.trycloudflare.com/api/webhooks/meta
echo   Token de verificacion: caminante_meta_verify_2026
echo.
tools\cloudflared.exe tunnel --url http://localhost:3000
pause
