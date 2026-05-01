@echo off
setlocal

cd /d "%~dp0"

where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] bun not found, please install: https://bun.sh
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    bun install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Install failed
        pause
        exit /b 1
    )
)

set SERVER_PORT=3456
if not "%1"=="" set SERVER_PORT=%1

echo ============================================
echo   cc-haha Server
echo ============================================
echo.
echo   URL:  http://127.0.0.1:%SERVER_PORT%
echo   API:  http://127.0.0.1:%SERVER_PORT%/api/providers
echo   WS:   ws://127.0.0.1:%SERVER_PORT%/ws/
echo.

bun ./src/server/index.ts --port %SERVER_PORT%
