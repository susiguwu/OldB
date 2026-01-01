// ============================================
// 手機遊戲 UI 端 (Old Balance Game)
// ============================================

const GAME_CONFIG = {
    level1Speed: 3000, 
    level2Speed: 2500,
    level3Speed: 2000,
    levelDuration: 20000,
    spawnInterval: 1200,
};

const ASSET_PATHS = {
    bridge: 'asset/obj_bridge.png',
    flower: 'asset/obj_flower.png',
    log: 'asset/obj_platform.png'
};

const firebaseConfig = {
    apiKey: "AIzaSyBoLxigUmAC6oOJWCWESSN9GJYOl1cTfwY",
    authDomain: "old-balance-rehab.firebaseapp.com",
    databaseURL: "https://old-balance-rehab-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "old-balance-rehab",
    storageBucket: "old-balance-rehab.firebasestorage.app",
    messagingSenderId: "854162617207",
    appId: "1:854162617207:web:4e356938ef597628946772"
};

let gameState = 'start'; 
let currentLevel = 1;
let score = 0;
let objects = [];
let matInput = { left: false, middle: false, right: false };
let objectIdCounter = 0;
let database = null;
let timeLeft = 20;
let timerInterval = null;

// 初始化
async function init() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // 關鍵：監聽 matInput 節點
    database = firebase.database().ref('matInput');
    database.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const oldInput = { ...matInput };
            matInput = {
                left: data.left || false,
                middle: data.middle || false,
                right: data.right || false
            };
            
            // 偵測踩下瞬間
            if (gameState === 'playing') {
                ['left', 'middle', 'right'].forEach(pos => {
                    if (matInput[pos] && !oldInput[pos]) {
                        checkCollision(pos);
                    }
                });
            }
            updateTargetZonesUI();
        }
    });
    
    document.getElementById('start-btn').onclick = startGame;
    document.getElementById('again-btn').onclick = startGame;
    document.getElementById('home-btn').onclick = () => location.reload();
}



function updateTargetZonesUI() {
    ['left', 'middle', 'right'].forEach(pos => {
        const zone = document.querySelector(`.target-zone[data-position="${pos}"]`);
        if (zone) matInput[pos] ? zone.classList.add('active') : zone.classList.remove('active');
    });
}

function startGame() {
    gameState = 'playing';
    score = 0;
    currentLevel = 1;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    startLevel(1);
}

function startCountdown() {
    // 清除舊的計時器（如果有）
    clearInterval(timerInterval);

    // 從設定值抓取總時間 (20000 毫秒 = 20 秒)
    timeLeft = GAME_CONFIG.levelDuration / 1000;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        // 最後 5 秒加入警告效果
        const timerEl = document.getElementById('timer-display');
        if (timeLeft <= 5) {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('timer-display').innerText = `${timeLeft}s`;
}

function startLevel(level) {
    currentLevel = level;
    document.getElementById('level-display').innerText = `Level ${level}`;

    // 重設計時器顯示樣式
    document.getElementById('timer-display').classList.remove('warning');
    startCountdown(); // 啟動倒數
    
    let speed = level === 1 ? GAME_CONFIG.level1Speed : (level === 2 ? GAME_CONFIG.level2Speed : GAME_CONFIG.level3Speed);
    
    let spawnTimer = setInterval(() => spawnObject(level), GAME_CONFIG.spawnInterval);
    let moveTimer = setInterval(() => moveObjects(speed), 30);

    
    
    setTimeout(() => {
        clearInterval(spawnTimer);
        clearInterval(moveTimer);
        clearInterval(timerInterval);
        if (level < 3) showLoading(level); else showEnd();
    }, GAME_CONFIG.levelDuration);
}

function spawnObject(level) {
    const lanes = ['left', 'middle', 'right'];
    const types = ['bridge', 'flower', 'log'];
    const obj = {
        id: objectIdCounter++,
        type: types[level-1],
        lane: lanes[Math.floor(Math.random()*3)],
        y: -10
    };
    objects.push(obj);
    
    const container = document.getElementById('objects-container');
    const el = document.createElement('img');
    el.id = `obj-${obj.id}`;
    el.className = 'falling-object';
    el.src = ASSET_PATHS[obj.type];
    el.style.left = obj.lane === 'left' ? '15%' : (obj.lane === 'middle' ? '50%' : '85%');
    container.appendChild(el);
}

function moveObjects(speed) {
    const step = 100 / (speed / 30);
    objects = objects.filter(obj => {
        obj.y += step;
        const el = document.getElementById(`obj-${obj.id}`);
        if (el) el.style.top = `${obj.y}%`;
        if (obj.y > 100) { el?.remove(); return false; }
        return true;
    });
}



function checkCollision(lane) {
    objects = objects.filter(obj => {
        if (obj.lane === lane && obj.y >= 75 && obj.y <= 92) {
            score++;
            document.getElementById('score-display').innerText = `Score: ${score}`;
            document.getElementById(`obj-${obj.id}`)?.remove();
            return false;
        }
        return true;
    });
}

function showLoading(level) {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        startLevel(level + 1);
    }, 3000);
}

function showEnd() {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = `Final Score: ${score}`;
}



init();