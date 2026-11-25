@echo off
setlocal
cd /d "%~dp0"

set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
call :is_java_21
if not errorlevel 1 goto java_ready

set "JAVA_EXE="
for /f "delims=" %%J in ('where /R "%ProgramFiles%\Eclipse Adoptium" java.exe 2^>nul ^| findstr /I "jdk-21"') do if not defined JAVA_EXE set "JAVA_EXE=%%J"
call :is_java_21
if not errorlevel 1 goto java_ready

set "JAVA_EXE="
for /f "delims=" %%J in ('where /R "%ProgramFiles%\Microsoft" java.exe 2^>nul ^| findstr /I "jdk-21"') do if not defined JAVA_EXE set "JAVA_EXE=%%J"
call :is_java_21
if not errorlevel 1 goto java_ready

set "JAVA_EXE="
for /f "delims=" %%J in ('where /R "%ProgramFiles%\Java" java.exe 2^>nul ^| findstr /I "jdk-21"') do if not defined JAVA_EXE set "JAVA_EXE=%%J"
call :is_java_21
if errorlevel 1 (
    echo This project requires Java 21.
    echo Current JAVA_HOME: %JAVA_HOME%
    echo Install JDK 21 or set JAVA_HOME to its installation directory.
    exit /b 1
)

:java_ready
for %%J in ("%JAVA_EXE%") do set "JAVA_BIN_DIR=%%~dpJ"
for %%J in ("%JAVA_BIN_DIR%..") do set "JAVA_HOME=%%~fJ"
echo Using Java 21: %JAVA_EXE%
echo JAVA_HOME for Maven: %JAVA_HOME%

set "BACKEND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do set "BACKEND_PID=%%P"
if defined BACKEND_PID (
    echo Backend is already running on port 8080.
    echo Process ID: %BACKEND_PID%
    echo Stop it with Ctrl+C in its terminal, or run: taskkill /PID %BACKEND_PID% /F
    exit /b 1
)

echo [1/2] Building boarding-house backend...
call mvnw.cmd -DskipTests package
if errorlevel 1 (
    echo Backend build failed.
    exit /b 1
)

echo [2/2] Starting backend at http://localhost:8080 ...
"%JAVA_EXE%" -jar "target\boarding-house-backend-0.0.1-SNAPSHOT-exec.jar"
exit /b %errorlevel%

:is_java_21
if not defined JAVA_EXE exit /b 1
if not exist "%JAVA_EXE%" exit /b 1
"%JAVA_EXE%" -version 2>&1 | findstr /C:"21.0." >nul
exit /b %errorlevel%
