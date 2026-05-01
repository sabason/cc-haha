@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   cc-haha Desktop Build Script
echo ============================================
echo.

cd /d "%~dp0"

where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] bun not found, please install: https://bun.sh
    pause
    exit /b 1
)

where cargo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cargo not found. Install Rust: https://rustup.rs
    pause
    exit /b 1
)

echo Select build type:
echo   1. Frontend only (Vite build, no installer)
echo   2. Full Tauri build (MSI installer)
echo.
set /p MODE="Enter option (1/2): "

if "%MODE%"=="1" goto :frontend
if "%MODE%"=="2" goto :tauri
echo [ERROR] Invalid option
pause
exit /b 1

:frontend
echo.
echo [1/2] Type checking...
bun run lint
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Type check failed
    pause
    exit /b 1
)

echo [2/2] Building frontend...
bun run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Frontend build complete!
echo ============================================
echo.
echo   Output: dist\
echo.
goto :end

:tauri
echo.
echo [INFO] Full Tauri build for Windows x64
echo ============================================
echo.
echo This requires:
echo   - Visual Studio 2022 Build Tools (C++ workload)
echo   - Rust toolchain (stable-x86_64-pc-windows-msvc)
echo.
echo The build may take several minutes on first run.
echo.

if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    pushd ..
    bun install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Root install failed
        popd
        pause
        exit /b 1
    )
    popd
    echo [INFO] Installing desktop dependencies...
    bun install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Desktop install failed
        pause
        exit /b 1
    )
    echo.
)

echo Starting Tauri build...
powershell -ExecutionPolicy Bypass -File ".\scripts\build-windows-x64.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Tauri build failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Tauri build complete!
echo ============================================
echo.
echo   Output: build-artifacts\windows-x64\
echo   Look for the .msi installer there.
echo.

if exist "build-artifacts\windows-x64\BUILD_INFO.txt" (
    echo   Build info:
    for /f "tokens=*" %%l in (build-artifacts\windows-x64\BUILD_INFO.txt) do (
        echo     %%l
    )
)

:end
echo.
pause
