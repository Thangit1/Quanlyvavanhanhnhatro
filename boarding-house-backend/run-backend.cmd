@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Building boarding-house backend...
call mvnw.cmd -DskipTests package
if errorlevel 1 (
    echo Backend build failed.
    exit /b 1
)

echo [2/2] Starting backend at http://localhost:8080 ...
java -jar "target\boarding-house-backend-0.0.1-SNAPSHOT.jar"
exit /b %errorlevel%
