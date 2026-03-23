@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo Building markdown posts...
call build-markdown-posts.bat
if errorlevel 1 goto :fail

echo.
echo Staging markdown post files...
git add markdown-posts 2026 blog/index.html archives tags content.json rss2.xml sitemap.xml sitemap.txt baidusitemap.xml img/posts media/posts
if errorlevel 1 goto :fail

git diff --cached --quiet --exit-code
if not errorlevel 1 (
  echo.
  echo No markdown post changes to commit.
  goto :end
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%i"
set "COMMIT_MESSAGE=chore: publish markdown posts %STAMP%"

echo.
echo Committing markdown post updates...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :fail

echo.
echo Pushing markdown post updates to GitHub...
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
echo Markdown post publish failed.
exit /b 1

:end
echo.
echo Markdown post publish completed.
endlocal
