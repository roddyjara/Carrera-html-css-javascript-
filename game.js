// Variables globales
let selectedCar = null;
let isPaused = false;
let gameOver = false;
let gameOverReason = '';

// Referencias DOM
const startMenu = document.getElementById('startMenu');
const gameContainer = document.getElementById('gameContainer');
const gameOverMenu = document.getElementById('gameOverMenu');
const pauseMenu = document.getElementById('pauseMenu');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
let audioContext = null;
let engineSound = null;
let engineGainNode = null;

// Inicializar audio context
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API no disponible');
    }
}

// Generar sonido de motor de auto
function createEngineSound() {
    if (!audioContext) return null;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    
    // Configurar oscilador para sonido de motor
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 150;
    
    // Configurar filtro
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 800;
    
    // Configurar ganancia
    gainNode.gain.value = 0.1;
    
    // Conectar nodos
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    return { oscillator, gainNode };
}

// Estado del juego
let gameState = {
    score: 0,
    speed: 1,
    distance: 0,
    fuel: 100,
    playerX: gameCanvas.width / 2 - 25,
    obstacles: [],
    fuelItems: [],
    roadOffset: 0,
    carSelection: ''
};

// Selectores de autos
const carOptions = document.querySelectorAll('.car-option');
const startBtn = document.getElementById('startBtn');
const selectedCarInfo = document.querySelector('.selected-car-info');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');

// Colores de autos
const carColors = {
    red: '#FF4444',
    blue: '#4444FF',
    yellow: '#FFD700'
};

const carEmojis = {
    red: '🚗',
    blue: '🚙',
    yellow: '🚕'
};

// Agregar event listeners a las opciones de autos
carOptions.forEach(option => {
    option.addEventListener('click', () => {
        carOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedCar = option.dataset.car;
        gameState.carSelection = selectedCar;
        selectedCarInfo.innerHTML = `<p>Listo → ${option.querySelector('p').textContent}</p>`;
        startBtn.disabled = false;
    });
});

// Iniciar juego
startBtn.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    playBackgroundMusic();
    initGame();
});

// Reproducir sonido de motor
function playBackgroundMusic() {
    if (!audioContext) {
        initAudio();
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (audioContext && !engineSound) {
        engineSound = createEngineSound();
        if (engineSound) {
            engineSound.oscillator.start();
            engineGainNode = engineSound.gainNode;
        }
    }
}

// Pausar sonido
function pauseBackgroundMusic() {
    if (engineGainNode) {
        engineGainNode.gain.value = 0;
    }
}

// Reanudar sonido
function resumeBackgroundMusic() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (engineGainNode) {
        engineGainNode.gain.value = 0.1;
    }
}

// Reiniciar juego - ahora va al menú de selección
restartBtn.addEventListener('click', () => {
    gameOverMenu.classList.add('hidden');
    gameContainer.classList.add('hidden');
    startMenu.classList.remove('hidden');
    pauseBackgroundMusic();
    resetMenu();
});

// Reanudar juego
resumeBtn.addEventListener('click', () => {
    isPaused = false;
    pauseMenu.classList.add('hidden');
    resumeBackgroundMusic();
    gameLoop();
});

// Salir del juego
quitBtn.addEventListener('click', () => {
    gameContainer.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    startMenu.classList.remove('hidden');
    pauseBackgroundMusic();
    resetMenu();
});

// Resetear menú
function resetMenu() {
    carOptions.forEach(opt => opt.classList.remove('selected'));
    selectedCar = null;
    startBtn.disabled = true;
    selectedCarInfo.innerHTML = '<p>← Selecciona tu auto</p>';
}

// Teclado
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === 'Escape' && !gameOver) {
        e.preventDefault();
        isPaused = !isPaused;
        if (isPaused) {
            pauseMenu.classList.remove('hidden');
            pauseBackgroundMusic();
        } else if (pauseMenu && !pauseMenu.classList.contains('hidden')) {
            pauseMenu.classList.add('hidden');
            resumeBackgroundMusic();
            gameLoop();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Inicializar juego
function initGame() {
    gameOver = false;
    isPaused = false;
    gameOverReason = '';
    gameState = {
        score: 0,
        speed: 2,
        distance: 0,
        fuel: 100,
        playerX: gameCanvas.width / 2 - 25,
        obstacles: [],
        fuelItems: [],
        roadOffset: 0,
        carSelection: gameState.carSelection
    };
    
    updateScore();
    updateFuel();
    
    // Crear obstáculos iniciales
    for (let i = 0; i < 5; i++) {
        createObstacle(600 - i * 200);
    }
    
    gameLoop();
}

// Bucle del juego
function gameLoop() {
    if (isPaused || gameOver) return;
    
    update();
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Actualizar estado del juego
function update() {
    // Mover jugador
    if (keys['ArrowLeft'] && gameState.playerX > 50) {
        gameState.playerX -= 5;
    }
    if (keys['ArrowRight'] && gameState.playerX < gameCanvas.width - 100) {
        gameState.playerX += 5;
    }
    
    // Reducir combustible gradualmente
    gameState.fuel -= 0.05 * gameState.speed / 2;
    if (gameState.fuel <= 0) {
        gameState.fuel = 0;
        gameOver = true;
        gameOverReason = 'Sin combustible';
        showGameOver();
        return;
    }
    
    // Mover carretera
    gameState.roadOffset += gameState.speed * 2;
    
    // Actualizar obstáculos
    gameState.obstacles.forEach(obstacle => {
        obstacle.y += gameState.speed * 2;
    });
    
    // Actualizar items de combustible
    gameState.fuelItems.forEach(item => {
        item.y += gameState.speed * 2;
        item.rotation += 0.1;
    });
    
    // Remover obstáculos fuera de pantalla
    gameState.obstacles = gameState.obstacles.filter(obstacle => obstacle.y < gameCanvas.height);
    
    // Remover items de combustible fuera de pantalla
    gameState.fuelItems = gameState.fuelItems.filter(item => item.y < gameCanvas.height);
    
    // Crear nuevo obstáculo
    if (Math.random() < 0.02) {
        createObstacle(-50);
    }
    
    // Crear items de combustible
    if (Math.random() < 0.015 && gameState.fuelItems.length < 3) {
        createFuelItem(-50);
    }
    
    // Detectar colisiones con obstáculos
    gameState.obstacles.forEach(obstacle => {
        if (obstacle.y > gameCanvas.height - 100 && obstacle.y < gameCanvas.height - 20) {
            if (gameState.playerX < obstacle.x + obstacle.width &&
                gameState.playerX + 50 > obstacle.x) {
                // Colisión!
                gameOver = true;
                gameOverReason = 'Choque frontal';
                showGameOver();
            }
        }
    });
    
    // Detectar recolección de combustible
    const playerCenterX = gameState.playerX + 25;
    const playerCenterY = gameCanvas.height - 65;
    
    gameState.fuelItems.forEach((item, index) => {
        const itemCenterX = item.x + item.size / 2;
        const itemCenterY = item.y + item.size / 2;
        
        const distance = Math.sqrt(
            Math.pow(playerCenterX - itemCenterX, 2) + 
            Math.pow(playerCenterY - itemCenterY, 2)
        );
        
        if (distance < (item.size + 50) / 2) {
            // Recolectar combustible
            gameState.fuel = Math.min(100, gameState.fuel + 25);
            gameState.score += 50;
            gameState.fuelItems.splice(index, 1);
            updateFuel();
        }
    });
    
    // Incrementar distancia y velocidad
    gameState.distance += gameState.speed;
    gameState.score = Math.floor(gameState.distance / 10) + Math.floor(gameState.fuel * 0.5);
    
    // Aumentar velocidad significativamente de menor a mayor
    const speedIncrement = 0.5; // Incremento más grande
    const distanceInterval = 300; // Cada 300 unidades aumenta
    
    if (gameState.distance % distanceInterval < gameState.speed && gameState.speed < 20) {
        gameState.speed += speedIncrement;
    }
    
    updateScore();
    updateFuel();
    updateEnginePitch();
}

// Crear obstáculo
function createObstacle(y) {
    const lanes = [75, 275, 475, 675];
    gameState.obstacles.push({
        x: lanes[Math.floor(Math.random() * lanes.length)],
        y: y,
        width: 50,
        height: 80,
        color: '#FF3333'
    });
}

// Crear item de combustible
function createFuelItem(y) {
    const lanes = [75, 275, 475, 675];
    gameState.fuelItems.push({
        x: lanes[Math.floor(Math.random() * lanes.length)],
        y: y,
        size: 40,
        rotation: 0
    });
}

// Dibujar en el canvas
function draw() {
    // Limpiar canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Dibujar carretera
    drawRoad();
    
    // Dibujar obstáculos
    gameState.obstacles.forEach(obstacle => {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Detalles del obstáculo
        ctx.fillStyle = '#FFAA00';
        ctx.fillRect(obstacle.x + 10, obstacle.y + 10, 10, 10);
        ctx.fillRect(obstacle.x + 30, obstacle.y + 10, 10, 10);
    });
    
    // Dibujar items de combustible
    drawFuelItems();
    
    // Dibujar jugador
    drawPlayer();
}

// Dibujar items de combustible
function drawFuelItems() {
    gameState.fuelItems.forEach(item => {
        ctx.save();
        ctx.translate(item.x + item.size / 2, item.y + item.size / 2);
        ctx.rotate(item.rotation);
        
        // Cuerpo del tanque
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
        
        // Detalles del tanque
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(-item.size / 2 + 5, -item.size / 2 + 10, item.size - 10, item.size - 15);
        
        // Emoji de gasolina
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⛽', 0, 0);
        
        ctx.restore();
        
        // Brillo alrededor
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(item.x - 5, item.y - 5, item.size + 10, item.size + 10);
        ctx.shadowBlur = 0;
    });
}

// Dibujar carretera
function drawRoad() {
    // Líneas centrales
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    
    for (let i = 0; i < 8; i++) {
        const y = (gameState.roadOffset + i * 100) % (gameCanvas.height + 100) - 50;
        ctx.beginPath();
        ctx.moveTo(gameCanvas.width / 2, y);
        ctx.lineTo(gameCanvas.width / 2, y + 50);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    // Bordes de la carretera
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(50, gameCanvas.height);
    ctx.moveTo(gameCanvas.width - 50, 0);
    ctx.lineTo(gameCanvas.width - 50, gameCanvas.height);
    ctx.stroke();
}

// Dibujar jugador
function drawPlayer() {
    const carY = gameCanvas.height - 100;
    
    // Cuerpo del auto
    ctx.fillStyle = carColors[gameState.carSelection];
    ctx.fillRect(gameState.playerX, carY, 50, 70);
    
    // Ventanas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(gameState.playerX + 5, carY + 5, 15, 15);
    ctx.fillRect(gameState.playerX + 30, carY + 5, 15, 15);
    
    // Ruedas
    ctx.fillStyle = '#000';
    ctx.fillRect(gameState.playerX - 5, carY + 10, 10, 20);
    ctx.fillRect(gameState.playerX - 5, carY + 40, 10, 20);
    ctx.fillRect(gameState.playerX + 45, carY + 10, 10, 20);
    ctx.fillRect(gameState.playerX + 45, carY + 40, 10, 20);
}

// Actualizar puntuación
function updateScore() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('speed').textContent = gameState.speed.toFixed(1);
}

// Actualizar combustible
function updateFuel() {
    const fuelBar = document.getElementById('fuelBar');
    const fuelPercent = document.getElementById('fuelPercent');
    
    fuelBar.style.width = gameState.fuel + '%';
    fuelPercent.textContent = Math.max(0, Math.floor(gameState.fuel));
    
    // Agregar efecto de advertencia cuando el combustible está bajo
    if (gameState.fuel < 30) {
        fuelBar.classList.add('low');
    } else {
        fuelBar.classList.remove('low');
    }
}

// Mostrar game over
function showGameOver() {
    document.getElementById('gameOverReason').textContent = gameOverReason;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalDistance').textContent = gameState.distance;
    setTimeout(() => {
        gameContainer.classList.add('hidden');
        gameOverMenu.classList.remove('hidden');
    }, 500);
}

// Actualizar frecuencia del motor según velocidad
function updateEnginePitch() {
    if (engineSound && engineSound.oscillator) {
        // Aumentar el pitch según la velocidad (150hz base + velocidad * 10)
        const targetFreq = 150 + (gameState.speed * 10);
        engineSound.oscillator.frequency.setTargetAtTime(
            targetFreq, 
            audioContext.currentTime, 
            0.05
        );
    }
}

// Inicializar al cargar la página
window.addEventListener('load', () => {
    startMenu.classList.remove('hidden');
    initAudio();
});
