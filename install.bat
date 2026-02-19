@echo off
echo =============================================
echo    SF Dev Toolkit - Installation
echo =============================================
echo.

:: Build
echo [1/2] Build en cours...
cd /d "%~dp0"
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Le build a echoue. Lance "npm install" d'abord.
    pause
    exit /b 1
)
echo       Build OK !
echo.

:: Open Chrome extensions page
echo [2/2] Ouverture de Chrome...
start "" "chrome" "chrome://extensions/"
echo.
echo =============================================
echo   INSTRUCTIONS (une seule fois) :
echo =============================================
echo.
echo   1. Active le "Mode developpeur" (en haut a droite)
echo   2. Clique "Charger l'extension non empaquetee"
echo   3. Selectionne ce dossier :
echo.
echo      %~dp0dist
echo.
echo   4. C'est fait ! Va sur Salesforce et clique
echo      l'icone SF dans la barre d'extensions
echo.
echo   Apres la 1ere fois, il suffit de rebuild
echo   et cliquer "Recharger" sur l'extension.
echo =============================================
echo.
pause
