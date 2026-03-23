@echo off
setlocal

cd /d "%~dp0"

echo Building gallery...
py -3 tools\build_gallery.py gallery\gallery-albums.txt
if errorlevel 1 (
  echo.
  echo Gallery build failed.
  exit /b 1
)

echo.
echo Gallery build completed.
exit /b 0
