@echo off
title Subtitle Eraser Launcher (Admin)

:: ====================================================
::   Automatic Administrator Privilege Elevation (UAC)
:: ====================================================
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo [INFO] Requesting administrator privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%~dp0"

    REM Kill any leftover services to prevent port conflict
    taskkill /f /im node.exe > nul 2>&1
    taskkill /f /im cpolar.exe > nul 2>&1
:: ====================================================

echo ====================================================
echo          Subtitle Eraser (Erase Video Subtitle)
echo ====================================================
echo.

REM 1. Check environment file
if not exist config.env (
    echo [ERROR] Cannot find config.env! Make sure you unpacked all files.
    pause
    exit /b
)

REM 2. Read variables from config.env
for /f "usebackq delims=" %%i in ("config.env") do (
    echo %%i | findstr /v "^#" > nul && set "%%i"
)

REM 3. Validate keys
if "%VOLCENGINE_API_KEY%"=="" (
    echo [WARNING] VOLCENGINE_API_KEY is not configured!
    echo Please edit config.env and fill in your Volcengine API Key.
    echo.
)

if "%CPOLAR_AUTHTOKEN%"=="" (
    echo [ERROR] CPOLAR_AUTHTOKEN is missing in config.env!
    echo Please edit config.env and configure your Cpolar Token.
    echo.
    pause
    exit /b
)

REM 4. Authenticate Cpolar
echo [Step 1/3] Activating Cpolar tunnel service...
cpolar\cpolar.exe authtoken %CPOLAR_AUTHTOKEN% > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Cpolar activation failed! Check your internet or Authtoken.
    pause
    exit /b
)
echo [SUCCESS] Cpolar authenticated successfully.

REM 5. Start Next.js local server (Run inside "app" folder for correct process.cwd)
echo [Step 2/3] Starting local Next.js server...
set PORT=3000
cd app
start /b ..\node\node.exe server.js > ..\nextjs_server.log 2>&1
cd ..

REM Wait for port to start
timeout /t 2 /nobreak > nul

REM 6. Start Cpolar Tunnel
echo [Step 3/3] Setting up public tunnel on port %PORT%...
start /b cpolar\cpolar.exe http %PORT% > cpolar.log 2>&1

REM Wait for tunnel
timeout /t 2 /nobreak > nul

echo.
echo ====================================================
echo                  Services Started!
echo ====================================================
echo.
echo  Local URL:  http://localhost:%PORT%
echo  Public URL: Check https://dashboard.cpolar.com/tunnels
echo.
echo  Quick Instructions:
echo  1. Open http://localhost:%PORT% in your browser.
echo  2. Note: Public URL is now automatically detected by the server.
echo  3. Drag and drop your local videos to start erasing subtitles!
echo.
echo ====================================================
echo  Press ANY KEY in this window to stop all services...
echo ====================================================
echo.
pause > nul

REM 7. Clean up background processes on exit
echo.
echo [Stopping services...]
taskkill /f /im node.exe > nul 2>&1
taskkill /f /im cpolar.exe > nul 2>&1
echo [Cleanup complete. Goodbye!]
timeout /t 2 > nul
