// ============================================
// 遊戲設定區 - 在這裡調整速度和難度
// ============================================
const GAME_CONFIG = {
    // 物件下落速度 (數字越小越快，單位: 毫秒)
    level1Speed: 3000,  // Level 1: Bridge - 獨木橋速度
    level2Speed: 2500,  // Level 2: Flowers - 花朵速度
    level3Speed: 2000,  // Level 3: Logs - 木頭速度
    
    // 每關持續時間 (毫秒)
    levelDuration: 20000, // 20秒
    
    // 物件生成間隔 (毫秒)
    spawnInterval: 1500,  // 每1.5秒生成一個物件
};

// Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyBoLxigUmAC6oOJWCWESSN9GJYOl1cTfwY",
    authDomain: "smart-floor-mat.firebaseapp.com",
    databaseURL: "https://smart-floor-mat-default-rtdb.firebaseio.com/",
    projectId: "smart-floor-mat",
    storageBucket: "smart-floor-mat.firebasestorage.app",
    messagingSenderId: "854162617207",
    appId: "1:854162617207:web:4e356938ef597628946772"
};

// ============================================
// 全域變數
// ============================================
let gameState = 'start'; // start, playing, loading, end
let currentLevel = 1;
let score = 0;
let objects = [];
let matInput = { left: false, middle: false, right: false };
let objectIdCounter = 0;

let gameLoopInterval = null;
let spawnInterval = null;
let levelTimeout = null;
let database = null;
let firebaseInitialized = false;

// 鼓勵訊息
const encouragementMessages = [
    "Great Job! Keep Going!",
    "You're Doing Amazing!",
    "Excellent Work! Final Round!"
];

// ============================================
// 初始化
// ============================================

// 等待 Firebase SDK 載入
function waitForFirebase() {
    return new Promise((resolve) => {
        if (typeof firebase !== 'undefined') {
            resolve();
        } else {
            const checkFirebase = setInterval(() => {
                if (typeof firebase !== 'undefined') {
                    clearInterval(checkFirebase);
                    resolve();
                }
            }, 100);
        }
    });
}

// 初始化所有功能
async function init() {
    console.log('🎮 Initializing game...');
    
    // 等待 Firebase SDK 載入
    await waitForFirebase();
    console.log('✅ Firebase SDK loaded');
    
    // 初始化 Firebase
    await initFirebase();
    
    // 初始化背景動畫
    initBackgroundAnimation();
    
    // 設定事件監聽
    setupEventListeners();
    
    console.log('✅ Game initialized successfully');
}

// 初始化 Firebase
async function initFirebase() {
    try {
        // 初始化 Firebase App
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized');
        }
        
        // 連接到 Database
        database = firebase.database().ref('matInput');
        
        // 監聽地墊輸入
        database.on('value', (snapshot) => {
            const data = snapshot.val();
            console.log('📡 Mat input received:', data);
            if (data) {
                updateMatInput(data);
            }
        }, (error) => {
            console.error('❌ Firebase read error:', error);
        });
        
        firebaseInitialized = true;
        console.log('✅ Firebase database connected');
        
        // 測試寫入
        await testFirebaseConnection();
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        alert('Firebase connection failed. Please check your internet connection.');
    }
}

// 測試 Firebase 連接
async function testFirebaseConnection() {
    try {
        await database.set({
            left: false,
            middle: false,
            right: false,
            lastUpdate: Date.now()
        });
        console.log('✅ Firebase write test successful');
    } catch (error) {
        console.error('❌ Firebase write test failed:', error);
    }
}

// 更新地墊輸入
function updateMatInput(data) {
    const oldInput = { ...matInput };
    matInput = {
        left: data.left || false,
        middle: data.middle || false,
        right: data.right || false
    };
    
    // 檢測新的按壓
    if (gameState === 'playing') {
        ['left', 'middle', 'right'].forEach(pos => {
            if (matInput[pos] && !oldInput[pos]) {
                console.log(`👟 Mat pressed: ${pos}`);
                handleMatPress(pos);
            }
        });
    }
    
    // 更新視覺回饋
    updateTargetZones();
}

// 更新踩踏區視覺
function updateTargetZones() {
    ['left', 'middle', 'right'].forEach(pos => {
        const zone = document.querySelector(`.target-zone[data-position="${pos}"]`);
        if (zone) {
            if (matInput[pos]) {
                zone.classList.add('active');
            } else {
                zone.classList.remove('active');
            }
        }
    });
}

// 處理地墊按壓
function handleMatPress(position) {
    checkCollision(position);
}

// 初始化背景動畫
function initBackgroundAnimation() {
    const container = document.getElementById('background-elements');
    for (let i = 0; i < 8; i++) {
        const bubble = document.createElement('div');
        bubble.style.position = 'absolute';
        bubble.style.width = '40px';
        bubble.style.height = '40px';
        bubble.style.background = 'rgba(255, 255, 255, 0.3)';
        bubble.style.borderRadius = '50%';
        bubble.style.top = `${(i * 15) % 100}%`;
        bubble.style.left = `${(i * 23) % 100}%`;
        bubble.style.animation = `float ${5 + i}s ease-in-out infinite`;
        bubble.style.animationDelay = `${i * 0.5}s`;
        container.appendChild(bubble);
    }
}

// 設定事件監聽
function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('again-btn').addEventListener('click', startGame);
    document.getElementById('home-btn').addEventListener('click', showStartScreen);
    document.getElementById('share-btn').addEventListener('click', shareScore);
    
    // 測試按鈕（開發用）
    document.addEventListener('keydown', (e) => {
        if (gameState === 'playing') {
            if (e.key === '1') simulateMatPress('left');
            if (e.key === '2') simulateMatPress('middle');
            if (e.key === '3') simulateMatPress('right');
        }
    });
}

// 模擬地墊按壓（測試用）
function simulateMatPress(position) {
    if (database && firebaseInitialized) {
        const data = { left: false, middle: false, right: false };
        data[position] = true;
        database.set(data).then(() => {
            console.log(`🧪 Simulated ${position} press`);
            setTimeout(() => {
                database.set({ left: false, middle: false, right: false });
            }, 200);
        });
    }
}

// ============================================
// 遊戲流程控制
// ============================================

// 顯示開始畫面
function showStartScreen() {
    gameState = 'start';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
}

// 開始遊戲
function startGame() {
    if (!firebaseInitialized) {
        alert('Firebase is not ready yet. Please wait a moment and try again.');
        return;
    }
    
    console.log('🎮 Starting game...');
    gameState = 'playing';
    currentLevel = 1;
    score = 0;
    objects = [];
    objectIdCounter = 0;
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    
    updateScoreDisplay();
    updateLevelDisplay();
    clearObjectsContainer();
    
    startLevel(1);
}

// 開始關卡
function startLevel(level) {
    console.log(`🎯 Starting Level ${level}`);
    currentLevel = level;
    updateLevelDisplay();
    
    const speeds = {
        1: GAME_CONFIG.level1Speed,
        2: GAME_CONFIG.level2Speed,
        3: GAME_CONFIG.level3Speed
    };
    
    const currentSpeed = speeds[level];
    
    // 生成物件
    spawnInterval = setInterval(() => {
        spawnObject(level);
    }, GAME_CONFIG.spawnInterval);
    
    // 遊戲循環 - 移動物件
    gameLoopInterval = setInterval(() => {
        moveObjects(currentSpeed);
    }, 50);
    
    // 關卡計時器
    levelTimeout = setTimeout(() => {
        endLevel(level);
    }, GAME_CONFIG.levelDuration);
}

// 生成物件
function spawnObject(level) {
    const positions = ['left', 'middle', 'right'];
    const randomPosition = positions[Math.floor(Math.random() * positions.length)];
    
    const types = ['bridge', 'flower', 'log'];
    const type = types[level - 1];
    
    const object = {
        id: objectIdCounter++,
        type: type,
        position: randomPosition,
        y: 0
    };
    
    objects.push(object);
    renderObject(object);
}

// 渲染物件
function renderObject(obj) {
    const container = document.getElementById('objects-container');
    const element = document.createElement('div');
    element.className = `falling-object ${obj.type}`;
    element.id = `object-${obj.id}`;
    
    const leftPos = obj.position === 'left' ? '15%' : obj.position === 'middle' ? '42.5%' : '70%';
    element.style.left = leftPos;
    element.style.top = '0%';
    element.style.transform = 'translateX(-50%)';
    
    // 顯示圖示 (如果沒有背景圖片的話)
    const icons = {
        bridge: '🌉',
        flower: '🌸',
        log: '🪵'
    };
    element.textContent = icons[obj.type];
    
    container.appendChild(element);
}

// 移動物件
function moveObjects(speed) {
    const moveDistance = 100 / (speed / 50);
    
    objects = objects.filter(obj => {
        obj.y += moveDistance;
        
        const element = document.getElementById(`object-${obj.id}`);
        if (element) {
            element.style.top = `${obj.y}%`;
        }
        
        // 移除超出畫面的物件
        if (obj.y > 100) {
            if (element) element.remove();
            return false;
        }
        
        return true;
    });
}

// 檢查碰撞
function checkCollision(position) {
    let hit = false;
    
    objects = objects.filter(obj => {
        if (!hit && obj.position === position && obj.y >= 75 && obj.y <= 95) {
            hit = true;
            score++;
            updateScoreDisplay();
            console.log(`✨ Hit! Score: ${score}`);
            
            // 移除物件
            const element = document.getElementById(`object-${obj.id}`);
            if (element) {
                element.style.background = '#FFD700';
                setTimeout(() => element.remove(), 100);
            }
            
            return false;
        }
        return true;
    });
}

// 結束關卡
function endLevel(level) {
    console.log(`🏁 Level ${level} completed`);
    clearInterval(gameLoopInterval);
    clearInterval(spawnInterval);
    clearTimeout(levelTimeout);
    
    gameLoopInterval = null;
    spawnInterval = null;
    levelTimeout = null;
    
    clearObjectsContainer();
    
    if (level < 3) {
        showLoadingScreen(level);
    } else {
        showEndScreen();
    }
}

// 顯示載入畫面
function showLoadingScreen(level) {
    gameState = 'loading';
    document.getElementById('loading-title').textContent = `Level ${level} Complete!`;
    document.getElementById('loading-message').textContent = encouragementMessages[level - 1];
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        gameState = 'playing';
        startLevel(level + 1);
    }, 3000);
}

// 顯示結束畫面
function showEndScreen() {
    console.log(`🎉 Game completed! Final score: ${score}`);
    gameState = 'end';
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'flex';
}

// 清空物件容器
function clearObjectsContainer() {
    objects = [];
    document.getElementById('objects-container').innerHTML = '';
}

// 更新分數顯示
function updateScoreDisplay() {
    document.getElementById('score-display').textContent = `Score: ${score}`;
}

// 更新關卡顯示
function updateLevelDisplay() {
    document.getElementById('level-display').textContent = `Level ${currentLevel}`;
}

// 分享分數
function shareScore() {
    const message = `I scored ${score} points in Floor Mat Rehab Game! 🎮`;
    
    // 如果支援 Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'Floor Mat Rehab Game',
            text: message,
            url: window.location.href
        }).catch(err => console.log('Share cancelled'));
    } else {
        // 複製到剪貼簿
        navigator.clipboard.writeText(message).then(() => {
            alert('Score copied to clipboard! 📋');
        }).catch(() => {
            alert(message);
        });
    }
}

// ============================================
// 啟動遊戲
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// 清理函數 (當頁面關閉時)
// ============================================
window.addEventListener('beforeunload', () => {
    if (database) {
        database.off();
    }
    clearInterval(gameLoopInterval);
    clearInterval(spawnInterval);
    clearTimeout(levelTimeout);
});
```

---

## 🧪 **測試功能**

現在你可以按鍵盤測試：
- **按 1** = 左邊地墊
- **按 2** = 中間地墊
- **按 3** = 右邊地墊

打開瀏覽器的 Console (F12)，你會看到這些訊息：
```
🎮 Initializing game...
✅ Firebase SDK loaded
✅ Firebase initialized
✅ Firebase database connected
✅ Firebase write test successful