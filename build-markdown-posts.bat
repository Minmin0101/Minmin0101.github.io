@echo off
setlocal

cd /d "%~dp0"

echo Installing markdown build dependencies...
py -3 -m pip install --disable-pip-version-check -q -r tools\requirements-posts.txt
if errorlevel 1 goto :fail

echo Building markdown posts...
py -3 tools\build_markdown_posts.py
if errorlevel 1 goto :fail

if /I "%MINMIN_SKIP_PREVIEW%"=="1" goto :preview_skipped

echo.
echo Starting local preview at http://127.0.0.1:4000/ ...
py -3 tools\start_local_preview.py
if errorlevel 1 goto :fail
goto :done_preview

:preview_skipped
echo.
echo Local preview launch skipped for this run.

:done_preview
echo.
echo Markdown posts build completed.
goto :end

:fail
echo.
echo Markdown posts build failed.
exit /b 1

:end
endlocal
