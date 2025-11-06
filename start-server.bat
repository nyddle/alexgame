@echo off
echo 🎮 Запуск игры 'Кольца'...
echo.

REM Проверяем Python 3
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Используем Python
    echo 🌐 Открывайте в браузере: http://localhost:8000
    echo.
    echo Нажмите Ctrl+C для остановки сервера
    echo ----------------------------------------
    python -m http.server 8000
    goto :end
)

REM Проверяем PHP
php --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Используем PHP
    echo 🌐 Открывайте в браузере: http://localhost:8000
    echo.
    echo Нажмите Ctrl+C для остановки сервера
    echo ----------------------------------------
    php -S localhost:8000
    goto :end
)

echo ❌ Не найден Python или PHP
echo.
echo Установите один из них или используйте:
echo   npx http-server
echo   npm install -g http-server ^&^& http-server
pause

:end
