@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo Building markdown posts...
set "MINMIN_SKIP_PREVIEW=1"
call build-markdown-posts.bat
if errorlevel 1 goto :fail

echo.
echo Staging markdown post files...
git add markdown-posts 2026 blog/index.html archives tags content.json rss2.xml sitemap.xml sitemap.txt baidusitemap.xml img/posts media/posts build-markdown-posts.bat publish-markdown-posts.bat tools\build_markdown_posts.py tools\start_local_preview.py
if errorlevel 1 goto :fail

git diff --cached --quiet --exit-code
if not errorlevel 1 (
  echo.
  echo No new markdown post changes to commit.
  goto :check_pending_push
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%i"
set "COMMIT_MESSAGE=chore: publish markdown posts %STAMP%"

echo.
echo Committing markdown post updates...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :fail

echo.
echo Syncing with remote before push...
git -c http.sslBackend=openssl fetch origin
if errorlevel 1 goto :sync_fail

set "BEHIND_COUNT=0"
for /f %%i in ('git rev-list --count main..origin/main 2^>nul') do set "BEHIND_COUNT=%%i"

if not "%BEHIND_COUNT%"=="0" (
  echo Remote has %BEHIND_COUNT% newer commit(s). Rebasing local changes first...
  git -c http.sslBackend=openssl -c rebase.autoStash=true -c core.editor=true pull --rebase origin main
  if errorlevel 1 goto :sync_fail
)

echo.
echo Pushing markdown post updates to GitHub...
goto :push_start

:check_pending_push
set "AHEAD_COUNT=0"
for /f %%i in ('git rev-list --count origin/main..main 2^>nul') do set "AHEAD_COUNT=%%i"

if "%AHEAD_COUNT%"=="0" (
  echo No pending local markdown post commits to push.
  goto :end
)

echo.
echo Found %AHEAD_COUNT% pending local markdown post commit(s). Pushing to GitHub...

echo.
echo Syncing with remote before push...
git -c http.sslBackend=openssl fetch origin
if errorlevel 1 goto :sync_fail

set "BEHIND_COUNT=0"
for /f %%i in ('git rev-list --count main..origin/main 2^>nul') do set "BEHIND_COUNT=%%i"

if not "%BEHIND_COUNT%"=="0" (
  echo Remote has %BEHIND_COUNT% newer commit(s). Rebasing local changes first...
  git -c http.sslBackend=openssl -c rebase.autoStash=true -c core.editor=true pull --rebase origin main
  if errorlevel 1 goto :sync_fail
)

:push_start
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

:sync_fail
echo.
echo Could not sync with GitHub before pushing markdown post updates.
exit /b 1

:fail
echo.
echo Markdown post publish failed.
exit /b 1

:end
echo.
echo Markdown post publish completed.
endlocal
