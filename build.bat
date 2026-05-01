@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   cc-haha Build Script
echo ============================================
echo.

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
    echo.
)

set OUTPUT_DIR=%~dp0dist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set VERSION=999.0.0-local
for /f "tokens=2 delims=:," %%a in ('findstr /c:"\"version\"" package.json') do (
    set VERSION=%%a
    set VERSION=!VERSION: =!
    set VERSION=!VERSION:"=!
)
for /f "tokens=*" %%t in ('powershell -command "Get-Date -Format yyyy-MM-ddTHH:mm:ss"') do set BUILD_TIME=%%t

echo [INFO] Version: %VERSION%
echo [INFO] Build time: %BUILD_TIME%
echo.

echo [1/3] Building CLI entry...
bun build ./src/entrypoints/cli.tsx ^
    --compile ^
    --outfile "%OUTPUT_DIR%\claude-haha.exe" ^
    --define:process.env.CLAUDE_CODE_LOCAL_VERSION="'%VERSION%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_BUILD_TIME="'%BUILD_TIME%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_PACKAGE_URL="'claude-code-local'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_SKIP_REMOTE_PREFETCH="'1'"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] CLI build failed
    pause
    exit /b 1
)
echo       -^> %OUTPUT_DIR%\claude-haha.exe

echo [2/3] Building Server entry...
bun build ./src/server/index.ts ^
    --compile ^
    --outfile "%OUTPUT_DIR%\cc-haha-server.exe" ^
    --define:process.env.CLAUDE_CODE_LOCAL_VERSION="'%VERSION%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_BUILD_TIME="'%BUILD_TIME%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_PACKAGE_URL="'claude-code-local'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_SKIP_REMOTE_PREFETCH="'1'"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Server build failed
    pause
    exit /b 1
)
echo       -^> %OUTPUT_DIR%\cc-haha-server.exe

echo [3/3] Building MCP entry...
bun build ./src/entrypoints/mcp.ts ^
    --compile ^
    --outfile "%OUTPUT_DIR%\cc-haha-mcp.exe" ^
    --define:process.env.CLAUDE_CODE_LOCAL_VERSION="'%VERSION%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_BUILD_TIME="'%BUILD_TIME%'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_PACKAGE_URL="'claude-code-local'" ^
    --define:process.env.CLAUDE_CODE_LOCAL_SKIP_REMOTE_PREFETCH="'1'"
if %ERRORLEVEL% neq 0 (
    echo [WARN] MCP build failed (non-critical, skipping)
) else (
    echo       -^> %OUTPUT_DIR%\cc-haha-mcp.exe
)

echo.
echo ============================================
echo   Build complete!
echo ============================================
echo.
echo   Output: %OUTPUT_DIR%\
echo.
echo   Usage:
echo     CLI:    claude-haha.exe
echo     Server: cc-haha-server.exe --port 3456
echo     MCP:    cc-haha-mcp.exe
echo.
echo   Environment variables:
echo     SERVER_PORT          Server port (default 3456)
echo     ANTHROPIC_API_KEY    API key
echo     ANTHROPIC_BASE_URL   API base URL
echo.

for %%f in ("%OUTPUT_DIR%\*.exe") do (
    echo     %%~nxf: %%~zf bytes
)
echo.

pause
