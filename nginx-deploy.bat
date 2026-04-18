@echo off
set KEY=C:\Users\sbdbu\Documents\Empresas\businesshub-privatenecesarios\ssh-key-2026-03-22.key
set SRV=ubuntu@134.65.233.213

echo Subiendo nginx-default.conf al servidor...
scp -i "%KEY%" -o StrictHostKeyChecking=no nginx-default.conf %SRV%:~/nginx-default.conf
if errorlevel 1 goto :error

echo Instalando y recargando nginx...
ssh -i "%KEY%" -o StrictHostKeyChecking=no %SRV% "sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx && rm ~/nginx-default.conf && echo OK"
if errorlevel 1 goto :error

echo Listo - nginx actualizado.
pause
exit /b 0

:error
echo FALLO - revisar salida arriba.
pause
exit /b 1
