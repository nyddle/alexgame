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

        this.createRing();
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

    setStatus(status) {
        this.status = status;
        const statusInfo = RING_STATUSES[status];
        this.material.color.setHex(statusInfo.color);
        this.material.emissive.setHex(statusInfo.color);
        this.glowMesh.material.color.setHex(statusInfo.color);
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

        this.init();
        this.setupGame();
        this.setupEventListeners();
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
        // Создаем систему колец
        // Центральное кольцо
        const ring1 = new Ring(this.scene, 3, new THREE.Vector3(0, 0, 0));
        this.rings.push(ring1);

        // Кольца вокруг центрального
        const ring2 = new Ring(this.scene, 2.5, new THREE.Vector3(5, 0, 0));
        this.rings.push(ring2);

        const ring3 = new Ring(this.scene, 2, new THREE.Vector3(-4, 0, 3));
        this.rings.push(ring3);

        const ring4 = new Ring(this.scene, 2.5, new THREE.Vector3(2, 0, -5));
        this.rings.push(ring4);

        const ring5 = new Ring(this.scene, 1.8, new THREE.Vector3(-3, 0, -4));
        this.rings.push(ring5);

        // Настраиваем станции пересадки
        // Станция 1: Кольцо 1 и 2
        const station1Angle1 = 0;
        const station1Angle2 = Math.PI;
        ring1.addStation(station1Angle1, [1]);
        ring2.addStation(station1Angle2, [0]);

        const station1Pos = new THREE.Vector3(
            (ring1.getPointOnRing(station1Angle1).x + ring2.getPointOnRing(station1Angle2).x) / 2,
            0,
            (ring1.getPointOnRing(station1Angle1).z + ring2.getPointOnRing(station1Angle2).z) / 2
        );
        const station1 = new TransferStation(this.scene, station1Pos, [0, 1]);
        this.stations.push(station1);

        // Станция 2: Кольцо 1 и 3
        const station2Angle1 = Math.PI * 1.2;
        const station2Angle3 = Math.PI * 0.2;
        ring1.addStation(station2Angle1, [2]);
        ring3.addStation(station2Angle3, [0]);

        const station2Pos = new THREE.Vector3(
            (ring1.getPointOnRing(station2Angle1).x + ring3.getPointOnRing(station2Angle3).x) / 2,
            0,
            (ring1.getPointOnRing(station2Angle1).z + ring3.getPointOnRing(station2Angle3).z) / 2
        );
        const station2 = new TransferStation(this.scene, station2Pos, [0, 2]);
        this.stations.push(station2);

        // Станция 3: Кольцо 1 и 4
        const station3Angle1 = Math.PI * 1.7;
        const station3Angle4 = Math.PI * 0.7;
        ring1.addStation(station3Angle1, [3]);
        ring4.addStation(station3Angle4, [0]);

        const station3Pos = new THREE.Vector3(
            (ring1.getPointOnRing(station3Angle1).x + ring4.getPointOnRing(station3Angle4).x) / 2,
            0,
            (ring1.getPointOnRing(station3Angle1).z + ring4.getPointOnRing(station3Angle4).z) / 2
        );
        const station3 = new TransferStation(this.scene, station3Pos, [0, 3]);
        this.stations.push(station3);

        // Станция 4: Кольцо 3 и 5
        const station4Angle3 = Math.PI * 1.4;
        const station4Angle5 = Math.PI * 0.4;
        ring3.addStation(station4Angle3, [4]);
        ring5.addStation(station4Angle5, [2]);

        const station4Pos = new THREE.Vector3(
            (ring3.getPointOnRing(station4Angle3).x + ring5.getPointOnRing(station4Angle5).x) / 2,
            0,
            (ring3.getPointOnRing(station4Angle3).z + ring5.getPointOnRing(station4Angle5).z) / 2
        );
        const station4 = new TransferStation(this.scene, station4Pos, [2, 4]);
        this.stations.push(station4);

        // Станция 5: Кольцо 4 и 5
        const station5Angle4 = Math.PI * 1.3;
        const station5Angle5 = Math.PI * 1.8;
        ring4.addStation(station5Angle4, [4]);
        ring5.addStation(station5Angle5, [3]);

        const station5Pos = new THREE.Vector3(
            (ring4.getPointOnRing(station5Angle4).x + ring5.getPointOnRing(station5Angle5).x) / 2,
            0,
            (ring4.getPointOnRing(station5Angle4).z + ring5.getPointOnRing(station5Angle5).z) / 2
        );
        const station5 = new TransferStation(this.scene, station5Pos, [3, 4]);
        this.stations.push(station5);

        // Создаем игрока на первом кольце
        this.player = new PlayerBall(this.scene, ring1, 0);

        // Создаем цель на последнем кольце
        const goalPosition = ring5.getPointOnRing(Math.PI);
        this.goal = new Goal(this.scene, goalPosition);

        // Устанавливаем начальные статусы колец
        ring1.setStatus('NORMAL');
        ring2.setStatus('FAST');
        ring3.setStatus('NORMAL');
        ring4.setStatus('SLOW');
        ring5.setStatus('NORMAL');

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

        // Переход на другое кольцо
        if (key >= '1' && key <= '5') {
            const targetRingIndex = parseInt(key) - 1;
            if (targetRingIndex >= 0 && targetRingIndex < this.rings.length) {
                this.tryTransferToRing(targetRingIndex);
            }
        }

        // Перезапуск игры
        if (key === 'r') {
            this.resetGame();
        }
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

        // Сброс позиции игрока
        this.player.switchToRing(this.rings[0], 0);
        this.player.direction = 1;

        // Сброс статусов колец
        this.rings.forEach((ring, index) => {
            if (index === 0 || index === 2 || index === 4) {
                ring.setStatus('NORMAL');
            } else if (index === 1) {
                ring.setStatus('FAST');
            } else {
                ring.setStatus('SLOW');
            }
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
    }

    update(deltaTime) {
        if (!this.gameStarted || this.gameFinished) return;

        // Обновляем время
        this.gameTime += deltaTime;

        // Обновляем игрока
        this.player.update(deltaTime);

        // Обновляем станции
        this.stations.forEach(station => station.update(deltaTime));

        // Обновляем цель
        this.goal.update(deltaTime);

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

        this.update(deltaTime);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Запускаем игру
window.addEventListener('DOMContentLoaded', () => {
    new RingsGame();
});
