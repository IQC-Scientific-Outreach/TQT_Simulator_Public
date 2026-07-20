@echo off
setlocal enabledelayedexpansion

:: 1. Navigate to the script's directory (Project Root)
cd /d "%~dp0"

:: 2. Check if the Virtual Environment already exists
if exist ".venv\Scripts\activate.bat" (
    goto :LaunchApp
)

:: ==========================================
:: SETUP SECTION (Runs only if .venv is missing)
:: ==========================================
echo Virtual Environment not found. Running First-Time Setup...

set "PY_COMMAND="

:: Try standard 'python' command
python --version >nul 2>&1
if %errorlevel% EQU 0 (
    set "PY_COMMAND=python"
    goto :FoundPython
)

:: Try Windows 'py' launcher
py --version >nul 2>&1
if %errorlevel% EQU 0 (
    set "PY_COMMAND=py"
    goto :FoundPython
)

:: Try finding Anaconda (Common paths)
echo Standard Python not found. Searching for Anaconda...
set "ANA_PATHS[1]=%USERPROFILE%\anaconda3"
set "ANA_PATHS[2]=%PROGRAMDATA%\Anaconda3"
set "ANA_PATHS[3]=%USERPROFILE%\miniconda3"
set "ANA_PATHS[4]=%LOCALAPPDATA%\Continuum\anaconda3"

for /F "tokens=2 delims==" %%A in ('set ANA_PATHS[') do (
    if exist "%%A\Scripts\activate.bat" (
        echo Found Anaconda at %%A
        call "%%A\Scripts\activate.bat" base
        set "PY_COMMAND=python"
        goto :FoundPython
    )
)

:: If we get here, absolutely nothing was found
echo.
echo [ERROR] Could not find Python or Anaconda automatically.
echo Please install Python from python.org OR open this script using "Anaconda Prompt".
echo.
pause
exit /b

:FoundPython
echo Using Python: %PY_COMMAND%
echo Creating .venv...

"%PY_COMMAND%" -m venv .venv

if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment was not created successfully.
    echo This often happens if "python" points to the Windows Store shortcut.
    echo.
    pause
    exit /b
)

:: Activate the new venv to install requirements
call .venv\Scripts\activate

echo Installing requirements...
pip install -r requirements.txt

if %errorlevel% NEQ 0 (
    echo.
    echo [ERROR] Failed to install requirements.
    pause
    exit /b
)

echo Setup Complete! Continuing to launch...
echo.

:: ==========================================
:: LAUNCH SECTION
:: ==========================================
:LaunchApp

echo Starting QPE Simulation...

:: Activate the environment (Required for both new setup and existing venvs)
call .venv\Scripts\activate

:: Run the Python script
python interface.py

:: Check for crashes
if %errorlevel% NEQ 0 (
    echo.
    echo [ERROR] The application encountered an error or crashed.
)

echo.
echo Application closed.
pause