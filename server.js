const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware для логирования запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Раздаем статические файлы из текущей директории
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        // Устанавливаем правильные MIME типы для ES6 модулей
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка 404
app.use((req, res) => {
    res.status(404).send('Страница не найдена');
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🎮 Игра "Кольца" запущена на порту ${PORT}`);
    console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
});
