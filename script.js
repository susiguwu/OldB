// ============================================
// 手機遊戲 UI 端 (Old Balance Game) - 兩關躲避版
// ============================================

const bgm = document.getElementById('bgm');

const GAME_CONFIG = {
    level1Speed: 3000, 
    level2Speed: 2500,     // 第二關速度稍快
    levelDuration: 20000,  // 每關 20 秒
    loadingDuration: 15000, // 過場說明 15 秒
    spawnInterval: 1200,   // 每 1.2 秒產生一個
    totalLevels: 2         // 總關卡數
};

const ASSET_PATHS = {
    bridge: 'asset/obj_bridge.png',
    bridge2: 'asset/obj_bridge2.png', // 第二關寬物件
    flower: 'asset/obj_flower.png',
    log: 'asset/obj_platform.png',
    instructionL2: 'asset/instruction_l2.png' // 第二關過場說明圖
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

// 定義計時器變數，方便清除
let spawnTimer = null;
let moveTimer = null;

// 初始化
async function init() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
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
    
    setupEventListeners();
}

// 設定所有按鈕與手機觸控事件
function setupEventListeners() {
    document.getElementById('start-btn').onclick = startGame;
    document.getElementById('again-btn').onclick = startGame;
    document.getElementById('home-btn').onclick = () => location.reload();

    const targetZones = document.querySelectorAll('.target-zone');
    targetZones.forEach(zone => {
        const position = zone.getAttribute('data-position');
        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (gameState === 'playing') {
                zone.classList.add('active');
                checkCollision(position);
            }
        });
        const release = () => { if (!matInput[position]) zone.classList.remove('active'); };
        zone.addEventListener('pointerup', release);
        zone.addEventListener('pointerleave', release);
    });
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
    document.getElementById('score-display').innerText = `Score: 0`;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    startLevel(1);
}

function startCountdown() {
    clearInterval(timerInterval);
    timeLeft = GAME_CONFIG.levelDuration / 1000;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        const timerEl = document.getElementById('timer-display');
        if (timeLeft <= 5) timerEl.classList.add('warning');
        else timerEl.classList.remove('warning');

        if (timeLeft <= 0) clearInterval(timerInterval);
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('timer-display').innerText = `${Math.max(0, timeLeft)}s`;
}

function startLevel(level) {
    currentLevel = level;
    gameState = 'playing';
    document.getElementById('level-display').innerText = `Level ${level}`;
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('loading-screen').style.display = 'none';

    document.getElementById('timer-display').classList.remove('warning');
    startCountdown(); 
    
    let speed = level === 1 ? GAME_CONFIG.level1Speed : GAME_CONFIG.level2Speed;
    
    spawnTimer = setInterval(() => spawnObject(level), GAME_CONFIG.spawnInterval);
    moveTimer = setInterval(() => moveObjects(speed), 30);

    setTimeout(() => {
        clearInterval(spawnTimer);
        clearInterval(moveTimer);
        clearInterval(timerInterval);
        document.getElementById('objects-container').innerHTML = '';
        objects = [];

        if (level < GAME_CONFIG.totalLevels) {
            showLoading(level);
        } else {
            showEnd();
        }
    }, GAME_CONFIG.levelDuration);
}

function spawnObject(level) {
    const id = objectIdCounter++;
    let obj = { id, y: -15, level: level };

    if (level === 1) {
        // 第一關：標準模式
        const lanes = ['left', 'middle', 'right'];
        obj.lane = lanes[Math.floor(Math.random() * 3)];
        obj.leftPos = obj.lane === 'left' ? '18%' : (obj.lane === 'middle' ? '50%' : '82%');
        obj.src = ASSET_PATHS.bridge;
        obj.isWide = false;
    } else {
        // 第二關：躲避模式 (寬物件 160px)
        const side = Math.random() > 0.5 ? 'left-mid' : 'mid-right';
        if (side === 'left-mid') {
            obj.leftPos = '34%'; // 佔據左與中
            obj.safeLane = 'right'; // 必須踩右邊
        } else {
            obj.leftPos = '66%'; // 佔據中與右
            obj.safeLane = 'left'; // 必須踩左邊
        }
        obj.src = ASSET_PATHS.bridge2;
        obj.isWide = true;
    }
    
    objects.push(obj);
    
    const container = document.getElementById('objects-container');
    const el = document.createElement('img');
    el.id = `obj-${obj.id}`;
    el.className = obj.isWide ? 'falling-object wide' : 'falling-object';
    el.src = obj.src;
    el.style.left = obj.leftPos;
    // 修正對齊
    el.style.transform = 'translateX(-50%)';
    container.appendChild(el);
}

function moveObjects(speed) {
    const step = 100 / (speed / 30);
    objects = objects.filter(obj => {
        obj.y += step;
        const el = document.getElementById(`obj-${obj.id}`);
        if (el) el.style.top = `${obj.y}%`;
        if (obj.y > 105) { el?.remove(); return false; }
        return true;
    });
}

function checkCollision(pressedLane) {
    objects = objects.filter(obj => {
        // 判定區間
        if (obj.y >= 75 && obj.y <= 92) {
            let success = false;
            if (obj.level === 1) {
                if (obj.lane === pressedLane) success = true;
            } else {
                // 第二關躲避邏輯：踩到安全區才得分
                if (obj.safeLane === pressedLane) success = true;
            }

            if (success) {
                score++;
                document.getElementById('score-display').innerText = `Score: ${score}`;
                const el = document.getElementById(`obj-${obj.id}`);
                if (el) {
                    el.style.filter = 'brightness(2)';
                    setTimeout(() => el.remove(), 100);
                }
                return false;
            }
        }
        return true;
    });
}

// 建立一個變數來儲存倒數，這樣點按鈕時才能把它取消掉
let loadingTimeout = null;

function showLoading(completedLevel) {
    gameState = 'loading';
    document.getElementById('game-screen').style.display = 'none';
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.display = 'flex';

    // 更換過場圖片
    const instructionImg = document.getElementById('instruction-image');
    if (instructionImg) {
        instructionImg.src = ASSET_PATHS.instructionL2;
        instructionImg.style.display = 'block';
    }

    // --- 新增按鈕功能 ---
    const nextBtn = document.getElementById('next-btn');
    nextBtn.onclick = () => {
        clearTimeout(loadingTimeout); // 停止原本的 15 秒自動倒數
        startLevel(completedLevel + 1); // 立即進入下一關
    };


}

function showEnd() {
    gameState = 'ended';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = `Final Score: ${score}`;
}

init();