import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Константы игры
const RING_STATUSES = {
    NORMAL: { speed: 1, color: 0x4fc3f7, name: 'Нормальное' },
    FAST: { speed: 2, color: 0xff9800, name: 'Быстрое' },
    SLOW: { speed: 0.5, color: 0x2196f3, name: 'Медленное' },
    BLOCKED: { speed: 0, color: 0xf44336, name: 'Заблокировано' }
};

// Класс для управления кольцом
class Ring {
    constructor(scene, radius, position, segments = 64, tubeRadius = 0.1) {
        this.scene = scene;
        this.radius = radius;
        this.position = position;
        this.segments = segments;
        this.tubeRadius = tubeRadius;
        this.status = 'NORMAL';
        this.stations = []; // Станции пересадки на этом кольце
        this.directionMarkers = []; // Маркеры направления движения
        this.markerPhase = Math.random() * Math.PI * 2; // Случайная начальная фаза для разнообразия

        this.createRing();
        this.createDirectionMarkers();
    }

    createRing() {
        // Создаем геометрию кольца (тора)
        const geometry = new THREE.TorusGeometry(this.radius, this.tubeRadius, 16, this.segments);
        this.material = new THREE.MeshStandardMaterial({
            color: RING_STATUSES[this.status].color,
            emissive: RING_STATUSES[this.status].color,
            emissiveIntensity: 0.3,
            metalness: 0.5,
            roughness: 0.5
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.x = Math.PI / 2; // Поворачиваем горизонтально
        this.scene.add(this.mesh);

        // Добавляем светящийся эффект
        const glowGeometry = new THREE.TorusGeometry(this.radius, this.tubeRadius * 1.5, 16, this.segments);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: RING_STATUSES[this.status].color,
            transparent: true,
            opacity: 0.2
        });
        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowMesh.position.copy(this.position);
        this.glowMesh.rotation.x = Math.PI / 2;
        this.scene.add(this.glowMesh);
    }

    createDirectionMarkers() {
        // Создаем маркеры направления (стрелки) на кольце
        const numMarkers = 8; // Количество стрелок по окружности
        const markerSize = this.tubeRadius * 0.8;

        for (let i = 0; i < numMarkers; i++) {
            const angle = (i / numMarkers) * Math.PI * 2;

            // Создаем стрелку (конус)
            const geometry = new THREE.ConeGeometry(markerSize * 0.6, markerSize * 1.5, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.6
            });

            const marker = new THREE.Mesh(geometry, material);

            // Позиционируем маркер на кольце
            const markerPos = this.getPointOnRing(angle);
            marker.position.copy(markerPos);
            marker.position.y += 0.15; // Немного выше кольца

            // Поворачиваем стрелку в направлении движения
            marker.rotation.x = -Math.PI / 2; // Стрелка смотрит вниз на кольцо
            marker.rotation.z = angle + Math.PI / 2; // Направление по касательной к кольцу

            marker.userData.baseAngle = angle; // Сохраняем базовый угол

            this.scene.add(marker);
            this.directionMarkers.push(marker);
        }
    }

    update(deltaTime) {
        // Анимируем маркеры направления
        const statusInfo = RING_STATUSES[this.status];
        const rotationSpeed = statusInfo.speed * 0.3; // Скорость вращения маркеров

        this.markerPhase += rotationSpeed * deltaTime * 2;

        this.directionMarkers.forEach((marker, index) => {
            const baseAngle = marker.userData.baseAngle;
            const currentAngle = baseAngle + this.markerPhase;

            // Обновляем позицию маркера
            const markerPos = this.getPointOnRing(currentAngle);
            marker.position.x = markerPos.x;
            marker.position.z = markerPos.z;

            // Обновляем поворот стрелки
            marker.rotation.z = currentAngle + Math.PI / 2;

            // Пульсация прозрачности для визуального эффекта
            const pulsePhase = (currentAngle + Date.now() * 0.002) % (Math.PI * 2);
            marker.material.opacity = 0.4 + Math.sin(pulsePhase) * 0.2;
        });
    }

    setStatus(status) {
        this.status = status;
        const statusInfo = RING_STATUSES[status];
        this.material.color.setHex(statusInfo.color);
        this.material.emissive.setHex(statusInfo.color);
        this.glowMesh.material.color.setHex(statusInfo.color);

        // Обновляем цвет маркеров в зависимости от статуса
        const markerColor = status === 'BLOCKED' ? 0xff0000 : 0xffffff;
        this.directionMarkers.forEach(marker => {
            marker.material.color.setHex(markerColor);
            // Если заблокировано, делаем маркеры более заметными
            marker.material.opacity = status === 'BLOCKED' ? 0.9 : 0.6;
        });
    }

    getPointOnRing(angle) {
        // Возвращает 3D координаты точки на кольце по углу
        const x = this.position.x + Math.cos(angle) * this.radius;
        const y = this.position.y;
        const z = this.position.z + Math.sin(angle) * this.radius;
        return new THREE.Vector3(x, y, z);
    }

    addStation(angle, connectedRings = []) {
        this.stations.push({
            angle: angle,
            connectedRings: connectedRings,
            position: this.getPointOnRing(angle)
        });
    }
}

// Класс для станции пересадки
class TransferStation {
    constructor(scene, position, rings) {
        this.scene = scene;
        this.position = position;
        this.rings = rings; // Массив колец, которые пересекаются здесь

        this.createStation();
    }

    createStation() {
        // Создаем визуализацию станции
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffeb3b,
            emissive: 0xffeb3b,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Добавляем пульсирующий эффект
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(deltaTime) {
        this.pulsePhase += deltaTime * 3;
        const scale = 1 + Math.sin(this.pulsePhase) * 0.2;
        this.mesh.scale.set(scale, scale, scale);
    }
}

// Класс для шарика игрока
class PlayerBall {
    constructor(scene, startRing, startAngle = 0) {
        this.scene = scene;
        this.currentRing = startRing;
        this.angle = startAngle;
        this.direction = 1; // 1 = по часовой стрелке, -1 = против
        this.speed = 0.02; // Базовая скорость

        this.createBall();
        this.updatePosition();
    }

    createBall() {
        const geometry = new THREE.SphereGeometry(0.2, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            metalness: 0.5,
            roughness: 0.5
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // Добавляем след
        this.trailPositions = [];
        this.maxTrailLength = 20;
    }

    update(deltaTime) {
        // Двигаемся по кольцу с учетом статуса кольца
        const ringStatus = RING_STATUSES[this.currentRing.status];
        this.angle += this.direction * this.speed * ringStatus.speed * deltaTime * 60;

        // Нормализуем угол
        if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
        if (this.angle < 0) this.angle += Math.PI * 2;

        this.updatePosition();
    }

    updatePosition() {
        const position = this.currentRing.getPointOnRing(this.angle);
        this.mesh.position.copy(position);
    }

    reverseDirection() {
        this.direction *= -1;
    }

    switchToRing(newRing, newAngle) {
        this.currentRing = newRing;
        this.angle = newAngle;
        this.updatePosition();
    }

    isNearStation(station, threshold = 0.3) {
        // Проверяем, находится ли шарик рядом со станцией
        const distance = this.mesh.position.distanceTo(station.position);
        return distance < threshold;
    }

    getNearestStation() {
        let nearestStation = null;
        let minDistance = Infinity;

        for (const station of this.currentRing.stations) {
            const stationPos = station.position;
            const distance = this.mesh.position.distanceTo(stationPos);

            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = station;
            }
        }

        return { station: nearestStation, distance: minDistance };
    }
}

// Класс для цели (финиша)
class Goal {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position;

        this.createGoal();
    }

    createGoal() {
        // Создаем финишный маркер
        const geometry = new THREE.OctahedronGeometry(0.3);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.7,
            metalness: 0.8,
            roughness: 0.2
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Добавляем кольца вокруг цели
        const ringGeometry = new THREE.TorusGeometry(0.5, 0.05, 16, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.3
        });

        this.rings = [];
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(ringGeometry, ringMaterial.clone());
            ring.position.copy(this.position);
            ring.rotation.x = Math.PI / 2;
            this.scene.add(ring);
            this.rings.push(ring);
        }

        this.rotationSpeed = 0.02;
    }

    update(deltaTime) {
        // Вращаем основной маркер
        this.mesh.rotation.y += this.rotationSpeed * deltaTime * 60;
        this.mesh.rotation.x += this.rotationSpeed * 0.5 * deltaTime * 60;

        // Анимируем кольца
        this.rings.forEach((ring, index) => {
            ring.rotation.z += (this.rotationSpeed * (index + 1)) * deltaTime * 60;
            const scale = 1 + Math.sin(Date.now() * 0.001 + index) * 0.2;
            ring.scale.set(scale, scale, 1);
        });
    }

    isReached(playerPosition, threshold = 0.5) {
        return this.mesh.position.distanceTo(playerPosition) < threshold;
    }
}

// Основной класс игры
class RingsGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        this.rings = [];
        this.stations = [];
        this.player = null;
        this.goal = null;

        this.gameTime = 0;
        this.gameStarted = false;
        this.gameFinished = false;

        this.lastTime = performance.now();
        this.lastTransferIndex = 0; // Индекс для циклического переключения между доступными кольцами

        this.init();
        this.setupGame();
        this.setupEventListeners();

        // Показываем приветственное сообщение
        this.showMessage('Добро пожаловать в игру "Кольца"!', 'Начать игру', () => this.startGame());

        this.animate();
    }

    init() {
        // Создаем сцену
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

        // Создаем камеру
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // Создаем рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Добавляем контроллеры камеры
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 30;

        // Добавляем освещение
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffffff, 1, 100);
        pointLight1.position.set(10, 10, 10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x4fc3f7, 0.5, 100);
        pointLight2.position.set(-10, 5, -10);
        this.scene.add(pointLight2);

        // Добавляем сетку для ориентации
        const gridHelper = new THREE.GridHelper(30, 30, 0x333333, 0x1a1a1a);
        gridHelper.position.y = -5;
        this.scene.add(gridHelper);

        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupGame() {
        // Создаем плотнейшую укладку колец (hexagonal packing) - треугольная конфигурация
        // Как бильярдные шары в треугольнике

        const RING_RADIUS = 2.0; // Радиус всех колец одинаковый
        const RING_DISTANCE = RING_RADIUS * 2; // Расстояние между центрами касающихся колец
        const VERTICAL_SPACING = RING_DISTANCE * Math.sqrt(3) / 2; // Вертикальное расстояние для гексагональной решетки

        // Вспомогательные функции
        const getTangentPoint = (ring1, ring2) => {
            const direction = new THREE.Vector3()
                .subVectors(ring2.position, ring1.position)
                .normalize();
            return new THREE.Vector3()
                .copy(ring1.position)
                .add(direction.multiplyScalar(ring1.radius));
        };

        const getAngleOnRing = (ring, point) => {
            const dx = point.x - ring.position.x;
            const dz = point.z - ring.position.z;
            return Math.atan2(dz, dx);
        };

        // Создаем треугольную структуру из 15 колец (5 рядов)
        // Ряд 1: 1 кольцо
        // Ряд 2: 2 кольца
        // Ряд 3: 3 кольца
        // Ряд 4: 4 кольца
        // Ряд 5: 5 колец

        const numRows = 5;
        let ringIndex = 0;

        // Центрируем треугольник относительно начала координат
        const totalHeight = (numRows - 1) * VERTICAL_SPACING;
        const startZ = -totalHeight / 2;

        for (let row = 0; row < numRows; row++) {
            const numRingsInRow = row + 1;
            const rowWidth = (numRingsInRow - 1) * RING_DISTANCE;
            const startX = -rowWidth / 2;
            const z = startZ + row * VERTICAL_SPACING;

            for (let col = 0; col < numRingsInRow; col++) {
                const x = startX + col * RING_DISTANCE;
                const position = new THREE.Vector3(x, 0, z);
                const ring = new Ring(this.scene, RING_RADIUS, position);
                this.rings.push(ring);
                ringIndex++;
            }
        }

        console.log(`Создано ${this.rings.length} колец`);

        // Автоматически находим все касания между кольцами
        const CONTACT_THRESHOLD = RING_DISTANCE * 1.1; // Небольшой допуск для определения касания

        for (let i = 0; i < this.rings.length; i++) {
            for (let j = i + 1; j < this.rings.length; j++) {
                const ring1 = this.rings[i];
                const ring2 = this.rings[j];

                const distance = ring1.position.distanceTo(ring2.position);

                // Проверяем, касаются ли кольца
                if (Math.abs(distance - RING_DISTANCE) < 0.1) {
                    // Кольца касаются! Создаем станцию

                    const tangentPoint = getTangentPoint(ring1, ring2);
                    const angle1 = getAngleOnRing(ring1, tangentPoint);
                    const angle2 = getAngleOnRing(ring2, tangentPoint);

                    // Добавляем станции на кольца
                    ring1.addStation(angle1, [j]);
                    ring2.addStation(angle2, [i]);

                    // Создаем визуальную станцию
                    const station = new TransferStation(this.scene, tangentPoint, [i, j]);
                    this.stations.push(station);
                }
            }
        }

        console.log(`Создано ${this.stations.length} станций пересадки`);

        // Создаем игрока на первом кольце (вершина треугольника)
        this.player = new PlayerBall(this.scene, this.rings[0], 0);

        // Создаем цель на последнем кольце (правый нижний угол треугольника)
        const lastRing = this.rings[this.rings.length - 1];
        const goalPosition = lastRing.getPointOnRing(Math.PI);
        this.goal = new Goal(this.scene, goalPosition);

        // Устанавливаем случайные начальные статусы колец
        const statuses = ['NORMAL', 'FAST', 'SLOW', 'NORMAL', 'NORMAL']; // Больше нормальных для баланса
        this.rings.forEach((ring, index) => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            ring.setStatus(randomStatus);
        });

        // Запускаем систему динамического изменения статусов
        this.startStatusChangeSystem();
    }

    startStatusChangeSystem() {
        // Меняем статусы колец каждые несколько секунд
        setInterval(() => {
            if (!this.gameStarted || this.gameFinished) return;

            const randomRing = this.rings[Math.floor(Math.random() * this.rings.length)];
            const statuses = Object.keys(RING_STATUSES);
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

            randomRing.setStatus(randomStatus);

            // Если установили блокировку, снимаем её через 2 секунды
            if (randomStatus === 'BLOCKED') {
                setTimeout(() => {
                    if (!this.gameFinished) {
                        randomRing.setStatus('NORMAL');
                    }
                }, 2000);
            }
        }, 3000);
    }

    setupEventListeners() {
        // Обработка клавиатуры
        document.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Кнопка старта
        document.getElementById('start-button').addEventListener('click', () => {
            this.startGame();
        });
    }

    onKeyDown(event) {
        if (!this.gameStarted || this.gameFinished) return;

        const key = event.key.toLowerCase();

        // Смена направления
        if (key === ' ') {
            const { station, distance } = this.player.getNearestStation();
            if (distance < 0.5) {
                this.player.reverseDirection();
            }
        }

        // Быстрая пересадка на соседнее кольцо (клавиша C)
        // Циклически переключается между доступными кольцами при повторных нажатиях
        if (key === 'c') {
            this.quickTransfer();
        }

        // Перезапуск игры
        if (key === 'r') {
            this.resetGame();
        }
    }

    quickTransfer() {
        const { station, distance } = this.player.getNearestStation();

        // Проверяем, на станции ли мы
        if (distance > 0.5 || !station) {
            this.lastTransferIndex = 0;
            return; // Не на станции
        }

        // Получаем текущий индекс кольца
        const currentRingIndex = this.rings.indexOf(this.player.currentRing);

        // Находим доступные кольца для пересадки (исключая текущее)
        const availableRings = station.connectedRings.filter(idx => idx !== currentRingIndex);

        if (availableRings.length === 0) {
            return; // Нет доступных колец
        }

        // Циклически переключаемся между доступными кольцами
        const targetRingIndex = availableRings[this.lastTransferIndex % availableRings.length];

        // Сохраняем индекс для следующего нажатия
        this.lastTransferIndex = (this.lastTransferIndex + 1) % availableRings.length;

        this.tryTransferToRing(targetRingIndex);
    }

    tryTransferToRing(targetRingIndex) {
        const targetRing = this.rings[targetRingIndex];
        const { station, distance } = this.player.getNearestStation();

        // Проверяем, на станции ли мы
        if (distance > 0.5) {
            return; // Не на станции
        }

        // Проверяем, можем ли мы перейти на целевое кольцо с этой станции
        const currentRingIndex = this.rings.indexOf(this.player.currentRing);
        const canTransfer = station.connectedRings.includes(targetRingIndex);

        if (canTransfer && targetRingIndex !== currentRingIndex) {
            // Находим соответствующую станцию на целевом кольце
            const targetStation = targetRing.stations.find(s => {
                return s.connectedRings.includes(currentRingIndex);
            });

            if (targetStation) {
                this.player.switchToRing(targetRing, targetStation.angle);
            }
        }
    }

    startGame() {
        this.gameStarted = true;
        this.gameTime = 0;
        document.getElementById('game-message').classList.remove('visible');
    }

    resetGame() {
        this.gameFinished = false;
        this.gameStarted = false;
        this.gameTime = 0;
        this.lastTransferIndex = 0;

        // Сброс позиции игрока
        this.player.switchToRing(this.rings[0], 0);
        this.player.direction = 1;

        // Сброс статусов колец - случайные статусы
        const statuses = ['NORMAL', 'FAST', 'SLOW', 'NORMAL', 'NORMAL'];
        this.rings.forEach((ring) => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            ring.setStatus(randomStatus);
        });

        this.showMessage('Игра перезапущена!', 'Начать заново', () => this.startGame());
    }

    showMessage(text, buttonText, callback) {
        const messageDiv = document.getElementById('game-message');
        const textDiv = document.getElementById('message-text');
        const button = document.getElementById('start-button');

        textDiv.textContent = text;
        button.textContent = buttonText;
        messageDiv.classList.add('visible');

        button.onclick = callback;
    }

    updateUI() {
        // Обновляем время
        document.getElementById('time-value').textContent = this.gameTime.toFixed(1);

        // Текущее кольцо
        const currentRingIndex = this.rings.indexOf(this.player.currentRing) + 1;
        document.getElementById('current-ring').textContent = currentRingIndex;

        // Статус кольца
        const statusName = RING_STATUSES[this.player.currentRing.status].name;
        document.getElementById('ring-status').textContent = statusName;

        // Дистанция до цели
        const distance = this.player.mesh.position.distanceTo(this.goal.mesh.position);
        document.getElementById('distance-value').textContent = distance.toFixed(1);

        // Проверяем, находится ли игрок на станции
        const { station, distance: stationDistance } = this.player.getNearestStation();
        const transferHint = document.getElementById('transfer-hint');
        const hintText = document.getElementById('hint-text');

        if (stationDistance < 0.5 && station) {
            // Игрок на станции - показываем подсказку
            const availableRings = station.connectedRings
                .map(idx => idx + 1)
                .filter(idx => idx !== currentRingIndex);

            if (availableRings.length > 0) {
                const ringsText = availableRings.join(', ');
                hintText.textContent = `⚠️ СТАНЦИЯ! Нажмите C для пересадки (${ringsText}) или SPACE для смены направления`;
                transferHint.classList.add('visible');
            }

            // Подсвечиваем активную станцию
            this.stations.forEach(s => {
                if (s === this.findStationAtPosition(station.position)) {
                    s.mesh.material.emissiveIntensity = 1.0;
                    s.mesh.scale.set(1.5, 1.5, 1.5);
                } else {
                    s.mesh.material.emissiveIntensity = 0.5;
                    // Сохраняем пульсацию для других станций
                }
            });
        } else {
            // Игрок не на станции - скрываем подсказку
            transferHint.classList.remove('visible');

            // Возвращаем нормальное отображение станций
            this.stations.forEach(s => {
                s.mesh.material.emissiveIntensity = 0.5;
            });
        }
    }

    findStationAtPosition(position) {
        // Находим станцию по позиции
        return this.stations.find(s => s.position.distanceTo(position) < 0.1);
    }

    update(deltaTime) {
        if (!this.gameStarted || this.gameFinished) return;

        // Обновляем время
        this.gameTime += deltaTime;

        // Обновляем игрока
        this.player.update(deltaTime);

        // Проверяем достижение цели
        if (this.goal.isReached(this.player.mesh.position)) {
            this.finishGame();
        }

        // Обновляем UI
        this.updateUI();
    }

    finishGame() {
        this.gameFinished = true;
        this.gameStarted = false;

        const message = `Поздравляем! Вы достигли цели за ${this.gameTime.toFixed(1)} секунд!`;
        this.showMessage(message, 'Играть снова', () => this.resetGame());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Всегда обновляем кольца (даже на стартовом экране)
        this.rings.forEach(ring => ring.update(deltaTime));

        // Всегда обновляем станции (пульсация)
        this.stations.forEach(station => station.update(deltaTime));

        // Всегда обновляем цель (анимация)
        if (this.goal) {
            this.goal.update(deltaTime);
        }

        this.update(deltaTime);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Запускаем игру
window.addEventListener('DOMContentLoaded', () => {
    new RingsGame();
});
