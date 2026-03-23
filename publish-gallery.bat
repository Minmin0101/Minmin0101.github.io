@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo Building gallery...
set "MINMIN_SKIP_PREVIEW=1"
call build-gallery.bat
if errorlevel 1 goto :fail

echo.
echo Staging gallery files...
git add gallery img/gallery build-gallery.bat publish-gallery.bat tools\build_gallery.py tools\start_local_preview.py
if errorlevel 1 goto :fail

git diff --cached --quiet --exit-code
if not errorlevel 1 (
  echo.
  echo No gallery changes to commit.
  goto :end
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%i"
set "COMMIT_MESSAGE=chore: publish gallery %STAMP%"

echo.
echo Committing gallery updates...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :fail

echo.
echo Pushing gallery updates to GitHub...
set "PUSH_ATTEMPT=0"

:push_retry
set /a PUSH_ATTEMPT+=1
git -c http.sslBackend=openssl push origin main
if not errorlevel 1 goto :end

if %PUSH_ATTEMPT% GEQ 3 goto :push_fail

echo Push failed. Retrying...
timeout /t 2 /nobreak >nul
goto :push_retry

:push_fail
echo.
echo Push failed after 3 attempts.
exit /b 1

:fail
echo.
echo Gallery publish failed.
exit /b 1

:end
echo.
echo Gallery publish completed.
endlocal
