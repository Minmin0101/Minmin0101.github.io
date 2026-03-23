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

if /I "%MINMIN_SKIP_PREVIEW%"=="1" goto :preview_skipped

echo.
echo Starting local preview at http://127.0.0.1:4000/ ...
py -3 tools\start_local_preview.py
if errorlevel 1 (
  echo.
  echo Gallery build failed.
  exit /b 1
)
goto :done_preview

:preview_skipped
echo.
echo Local preview launch skipped for this run.

:done_preview
echo.
echo Gallery build completed.
exit /b 0
