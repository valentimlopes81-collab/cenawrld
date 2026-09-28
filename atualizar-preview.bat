@echo off
cd /d "%~dp0"
echo A atualizar o preview com as ultimas alteracoes...
echo.
git pull
echo.
echo Concluido! Verifica o preview em http://127.0.0.1:9292
echo (Certifica-te que o "shopify theme dev" continua a correr noutra janela)
echo.
pause
