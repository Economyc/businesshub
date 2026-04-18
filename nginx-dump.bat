@echo off
ssh -i "C:\Users\sbdbu\Documents\Empresas\businesshub-privatenecesarios\ssh-key-2026-03-22.key" -o StrictHostKeyChecking=no ubuntu@134.65.233.213 "sudo ls /etc/nginx/sites-enabled/ ; echo ===SEP=== ; sudo cat /etc/nginx/sites-enabled/*" > nginx-config.txt 2>&1
echo Listo. Archivo nginx-config.txt creado.
pause
