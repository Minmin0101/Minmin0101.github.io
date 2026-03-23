@echo off
setlocal

cd /d "%~dp0"

echo Installing markdown build dependencies...
py -3 -m pip install --disable-pip-version-check -q -r tools\requirements-posts.txt
if errorlevel 1 goto :fail

echo Building markdown posts...
py -3 tools\build_markdown_posts.py
if errorlevel 1 goto :fail

echo.
echo Markdown posts build completed.
goto :end

:fail
echo.
echo Markdown posts build failed.
exit /b 1

:end
endlocal
