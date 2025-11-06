#!/bin/bash

echo "🎮 Запуск игры 'Кольца'..."
echo ""

# Проверяем доступность различных серверов
if command -v python3 &> /dev/null; then
    echo "✅ Используем Python 3"
    echo "🌐 Открывайте в браузере: http://localhost:8000"
    echo ""
    echo "Нажмите Ctrl+C для остановки сервера"
    echo "----------------------------------------"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Используем Python 2"
    echo "🌐 Открывайте в браузере: http://localhost:8000"
    echo ""
    echo "Нажмите Ctrl+C для остановки сервера"
    echo "----------------------------------------"
    python -m SimpleHTTPServer 8000
elif command -v php &> /dev/null; then
    echo "✅ Используем PHP"
    echo "🌐 Открывайте в браузере: http://localhost:8000"
    echo ""
    echo "Нажмите Ctrl+C для остановки сервера"
    echo "----------------------------------------"
    php -S localhost:8000
else
    echo "❌ Не найден Python или PHP"
    echo ""
    echo "Установите один из них или используйте:"
    echo "  npx http-server"
    echo "  npm install -g http-server && http-server"
    exit 1
fi
