@echo off
cd /d C:\Users\nixer\opencode-mobile
echo ============================================
echo  Inicia sesion en tu cuenta de Expo
echo  (si no tienes, creala gratis en expo.dev/signup)
echo ============================================
echo.
npx expo login
echo.
echo ============================================
echo  Cuenta con la que estas logueado:
npx expo whoami
echo ============================================
echo.
pause
