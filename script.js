const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const voiceStatus = document.getElementById('voice-status');

const backgroundMusic = document.getElementById('background-music');
const lineClearSound = document.getElementById('line-clear-sound');
const gameOverSound = document.getElementById('game-over-sound');

let isPaused = false;
let isGameOver = false;

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Tetrominoes
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1, 0], [0, 1, 1]], // Z
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]], // J
    [[1, 1], [1, 1]] // O
];

const COLORS = [
    null, // for empty cells
    'cyan', 'red', 'lime', 'purple', 'orange', 'blue', 'yellow'
];

let board = [];
let score = 0;
let currentPiece;

let bestScore = parseInt(localStorage.getItem('bestScore') || '0', 10);
bestScoreElement.textContent = bestScore;

function updateScore(newScore) {
    score = newScore;
    scoreElement.innerText = score;
    if (score > bestScore) {
        bestScore = score;
        bestScoreElement.textContent = bestScore;
        localStorage.setItem('bestScore', bestScore);
    }
}

// Piece Class
class Piece {
    constructor(shape, colorIndex) {
        this.shape = shape;
        this.color = COLORS[colorIndex];
        this.colorIndex = colorIndex;
        this.r = 0;
        this.c = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
    }

    draw() {
        for (let r = 0; r < this.shape.length; r++) {
            for (let c = 0; c < this.shape[r].length; c++) {
                if (this.shape[r][c]) {
                    drawSquare(this.c + c, this.r + r, this.color);
                }
            }
        }
    }

    moveDown() {
        this.r++;
        if (!isValidMove(this)) {
            this.r--;
            lockPiece();
        }
    }

    moveLeft() {
        this.c--;
        if (!isValidMove(this)) {
            this.c++;
        }
    }

    moveRight() {
        this.c++;
        if (!isValidMove(this)) {
            this.c--;
        }
    }

    rotate() {
        const originalShape = this.shape;
        const newShape = [];
        for (let r = 0; r < originalShape[0].length; r++) {
            newShape[r] = [];
            for (let c = 0; c < originalShape.length; c++) {
                newShape[r][c] = originalShape[originalShape.length - 1 - c][r];
            }
        }
        this.shape = newShape;
        if (!isValidMove(this)) {
            this.shape = originalShape;
        }
    }
}

function generateRandomPiece() {
    const randomIndex = Math.floor(Math.random() * SHAPES.length);
    const shape = SHAPES[randomIndex];
    const colorIndex = randomIndex + 1; // +1 to skip null color
    const piece = new Piece(shape, colorIndex);
    // Check if the piece can be placed at the top
    if (!isValidMove(piece)) {
        gameOver();
        return null;
    }
    return piece;
}

function initBoard() {
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }
}

function drawBoard() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            drawSquare(c, r, COLORS[board[r][c]] || '#444');
        }
    }
}

function drawSquare(x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    context.strokeStyle = '#f0f0f0';
    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000; // 1 second

function gameLoop(time = 0) {
    if (isPaused || isGameOver) {
        requestAnimationFrame(gameLoop);
        return;
    }
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        if (currentPiece) {
            currentPiece.moveDown();
        }
        dropCounter = 0;
    }

    drawBoard();
    if (currentPiece) {
        currentPiece.draw();
    }
    requestAnimationFrame(gameLoop);
}

startButton.addEventListener('click', () => {
    isPaused = false;
    isGameOver = false;
    initBoard();
    updateScore(0);
    currentPiece = generateRandomPiece();
    backgroundMusic.play();
    gameLoop();
});

pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseButton.innerText = isPaused ? 'Resume' : 'Pause';
    if (isPaused) {
        backgroundMusic.pause();
    } else {
        backgroundMusic.play();
    }
});

// Voice Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = true;

    const VALID_COMMANDS = [
        'start game', 'left', 'right', 'rotate', 'down', 'pause', 'resume'
    ];
    let lastCommand = '';
    let lastCommandTime = 0;
    const COMMAND_DEBOUNCE_MS = 1000;

    function canProcessCommand(cmd) {
        const now = Date.now();
        if (cmd !== lastCommand || now - lastCommandTime > COMMAND_DEBOUNCE_MS) {
            lastCommand = cmd;
            lastCommandTime = now;
            return true;
        }
        return false;
    }

    recognition.onstart = () => {
        console.log('Voice recognition started.');
        if (voiceStatus) voiceStatus.textContent = '🎤 Voice recognition started. Say a command...';
    };

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            let transcript = event.results[i][0].transcript.trim().toLowerCase();
            if (voiceStatus) voiceStatus.textContent = `Heard: "${transcript}"`;
            let matched = VALID_COMMANDS.find(cmd => transcript.includes(cmd));
            if (matched && canProcessCommand(matched)) {
                handleVoiceCommand(matched);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (voiceStatus) voiceStatus.textContent = '❌ Voice recognition error: ' + event.error;
    };

    recognition.onend = () => {
        if (voiceStatus) voiceStatus.textContent = 'Voice recognition stopped. Restarting...';
        recognition.start();
    };
    
    window.addEventListener('load', () => {
        recognition.start();
    });

} else {
    if (voiceStatus) voiceStatus.textContent = '❌ Speech Recognition API not supported in this browser.';
    console.error('Speech Recognition API not supported in this browser.');
}

function isValidMove(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const newR = piece.r + r;
                const newC = piece.c + c;
                if (newR >= ROWS || newC < 0 || newC >= COLS || (newR >= 0 && board[newR][newC] !== 0)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function gameOver() {
    isGameOver = true;
    gameOverSound.play();
    backgroundMusic.pause();
    alert('Game Over');
}

function lockPiece() {
    for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c]) {
                if (currentPiece.r + r < 0) {
                    gameOver();
                    return;
                }
                board[currentPiece.r + r][currentPiece.c + c] = currentPiece.colorIndex;
            }
        }
    }
    clearLines();
    currentPiece = generateRandomPiece();
}

function clearLines() {
    let linesCleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            linesCleared++;
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            r++; // re-check the same row
        }
    }
    if (linesCleared > 0) {
        lineClearSound.play();
        updateScore(score + linesCleared * 10);
    }
}

function handleVoiceCommand(command) {
    if (command.includes('pause')) {
        if (!isPaused) {
            isPaused = true;
            pauseButton.innerText = 'Resume';
            backgroundMusic.pause();
        }
        return;
    }
    
    if (command.includes('resume')) {
        if (isPaused) {
            isPaused = false;
            pauseButton.innerText = 'Pause';
            backgroundMusic.play();
        }
        return;
    }

    if (isPaused || isGameOver) return;

    if (command.includes('start game')) {
        isPaused = false;
        isGameOver = false;
        initBoard();
        updateScore(0);
        currentPiece = generateRandomPiece();
        backgroundMusic.play();
        gameLoop();
        return;
    }

    if (!currentPiece) return;

    if (command.includes('left')) {
        currentPiece.moveLeft();
    } else if (command.includes('right')) {
        currentPiece.moveRight();
    } else if (command.includes('rotate')) {
        currentPiece.rotate();
    } else if (command.includes('down')) {
        // Hard drop: move piece down until it locks
        while (true) {
            let prevRow = currentPiece.r;
            currentPiece.moveDown();
            if (currentPiece.r === prevRow) break;
            if (!currentPiece) break;
        }
    }
} 