@echo off
echo SF Dev Toolkit - Rebuild rapide...
cd /d "%~dp0"
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR build !
    pause
    exit /b 1
)
echo Build OK ! Va dans Chrome > Extensions > Recharger
pause
