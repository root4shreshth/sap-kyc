@echo off
echo ============================================
echo  AL AMIR OPS - Production Build
echo ============================================
echo.

echo [1/4] Building Next.js standalone...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED! Fix errors and try again.
    pause
    exit /b 1
)

echo.
echo [2/4] Copying public/ assets...
if exist .next\standalone\public rmdir /S /Q .next\standalone\public
xcopy /E /I /Y public .next\standalone\public >nul 2>&1
echo       Done.

echo.
echo [3/4] Copying static/ assets...
if exist .next\standalone\.next\static rmdir /S /Q .next\standalone\.next\static
xcopy /E /I /Y .next\static .next\standalone\.next\static >nul 2>&1
echo       Done.

echo.
echo [4/4] Copying .env...
copy /Y .env .next\standalone\.env >nul 2>&1
echo       Done.

echo.
echo ============================================
echo  BUILD COMPLETE!
echo ============================================
echo.
echo To start the server:
echo   pm2 start ecosystem.config.js
echo.
echo Or manually:
echo   set HOSTNAME=0.0.0.0
echo   set PORT=3000
echo   node .next\standalone\server.js
echo.
echo Employees access: http://192.168.1.235:3000
echo Public access:    https://kyc.alamir.ae (after Cloudflare Tunnel)
echo ============================================
pause
