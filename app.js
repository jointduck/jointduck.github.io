let tg = window.Telegram.WebApp;
tg.expand();

// Функция для добавления поддержки touch-событий
function addTouchSupport(element, callback) {
    if (!element) return;
    
    element.addEventListener('click', callback);
    element.addEventListener('touchstart', function(e) {
        e.preventDefault();
        callback(e);
    }, { passive: false });
}

// Функция для вибрации
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Состояние приложения
const state = {
    isBreathing: false,
    currentPhase: 'idle', // idle, breathing, holding, recovery, finalHold
    rounds: {
        current: 0,
        total: 3,
        breathCount: 0
    },
    timer: {
        startTime: null,
        duration: 0,
        interval: null
    },
    stats: {
        today: {
            sessions: 0,
            bestTime: 0,
            times: []
        },
        allTime: {
            sessions: 0,
            bestTime: 0,
            times: [],
            streak: 0,
            lastPractice: null
        }
    }
};

// YouTube плеер
const YOUTUBE_PLAYLIST_ID = 'PLRBp0Fe2GpglkzuspoGv-mu7B2ce9_0Fn';
let player;
let isPlaying = false;

// Инициализация YouTube Player API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtubePlayer', {
        height: '0',
        width: '0',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1,
            'playsinline': 1,
            'listType': 'playlist',
            'list': YOUTUBE_PLAYLIST_ID,
            'shuffle': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    const musicControl = document.getElementById('musicControl');
    if (musicControl) {
        addTouchSupport(musicControl, toggleMusic);
    }
}

function onPlayerStateChange(event) {
    const musicControl = document.getElementById('musicControl');
    if (!musicControl) return;
    
    if (event.data === YT.PlayerState.PLAYING) {
        musicControl.classList.add('playing');
        musicControl.innerHTML = '⏸';
        isPlaying = true;
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        musicControl.classList.remove('playing');
        musicControl.innerHTML = '🎵';
        isPlaying = false;
    }
}

function toggleMusic() {
    if (!isPlaying) {
        player.playVideo();
        if (player.getPlayerState() === YT.PlayerState.CUED) {
            player.setShuffle(true);
            player.playVideoAt(Math.floor(Math.random() * player.getPlaylist().length));
        }
    } else {
        player.pauseVideo();
    }
}
// Элементы DOM
const elements = {
    breathCircle: document.getElementById('breathCircle'),
    circleText: document.getElementById('circleText'),
    phaseText: document.getElementById('phaseText'),
    timer: document.getElementById('timer'),
    progressBar: document.getElementById('progressBar'),
    roundsCount: document.getElementById('roundsCount'),
    currentRound: document.getElementById('currentRound'),
    totalRounds: document.getElementById('totalRounds')
};

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    const decreaseButton = document.getElementById('decreaseRounds');
    const increaseButton = document.getElementById('increaseRounds');

    if (decreaseButton && increaseButton) {
        addTouchSupport(decreaseButton, () => {
            if (state.rounds.total > 1) {
                state.rounds.total--;
                updateRoundsDisplay();
                saveUserData();
            }
        });

        addTouchSupport(increaseButton, () => {
            if (state.rounds.total < 10) {
                state.rounds.total++;
                updateRoundsDisplay();
                saveUserData();
            }
        });
    }

    if (elements.breathCircle) {
        addTouchSupport(elements.breathCircle, handleBreathCircleClick);
    }

    document.querySelectorAll('.stats-tab').forEach(tab => {
        addTouchSupport(tab, (e) => handleStatsTabClick(e));
    });

    loadUserData();
    updateStatsDisplay();
    updateDailyChart();
    checkAchievements();
});

// Обработчик нажатия на круг
function handleBreathCircleClick() {
    if (state.currentPhase === 'idle') {
        startBreathingSession();
    } else if (state.currentPhase === 'holding') {
        finishHoldingPhase();
    }
}

// Начало сессии дыхания
function startBreathingSession() {
    state.currentPhase = 'breathing';
    state.rounds.current++;
    state.rounds.breathCount = 0;
    startBreathingCycle();
    updateRoundsDisplay();
    
    if (!isPlaying) {
        toggleMusic();
    }
}

// Цикл дыхания
function startBreathingCycle() {
    if (state.currentPhase !== 'breathing') return;

    state.rounds.breathCount++;
    if (state.rounds.breathCount <= 30) {
        elements.breathCircle.classList.add('breathing-in');
        elements.breathCircle.classList.remove('breathing-out');
        elements.circleText.textContent = `Вдох ${state.rounds.breathCount}/30`;
        elements.phaseText.textContent = 'Глубокий вдох через нос';
        
        setTimeout(() => {
            if (state.currentPhase === 'breathing') {
                elements.breathCircle.classList.remove('breathing-in');
                elements.breathCircle.classList.add('breathing-out');
                elements.circleText.textContent = `Выдох ${state.rounds.breathCount}/30`;
                elements.phaseText.textContent = 'Спокойный выдох через рот';
                
                setTimeout(() => {
                    elements.breathCircle.classList.remove('breathing-out');
                    if (state.currentPhase === 'breathing') {
                        startBreathingCycle();
                    }
                }, 2000);
            }
        }, 2000);

        elements.progressBar.style.width = `${(state.rounds.breathCount/30) * 100}%`;
    } else {
        // Вибрация после завершения 30 вдохов
        vibrate([200, 100, 200]);
        startHoldingPhase();
    }
}

// Начало фазы задержки дыхания
function startHoldingPhase() {
    state.currentPhase = 'holding';
    elements.breathCircle.classList.remove('breathing-in', 'breathing-out');
    elements.circleText.textContent = 'Задержка';
    elements.phaseText.textContent = 'Выдохните и задержите дыхание';
    
    state.timer.startTime = Date.now();
    state.timer.interval = setInterval(updateTimer, 1000);
}
// Завершение фазы задержки дыхания
function finishHoldingPhase() {
    if (state.currentPhase !== 'holding') return;

    clearInterval(state.timer.interval);
    const holdTime = Math.floor((Date.now() - state.timer.startTime) / 1000);
    updateStats(holdTime);
    
    if (state.rounds.current < state.rounds.total) {
        startRecoveryPhase();
    } else {
        startFinalHold();
    }
}

// Фаза восстановления
function startRecoveryPhase() {
    state.currentPhase = 'recovery';
    elements.circleText.textContent = 'Восстановление';
    
    // 2 секунды на глубокий вдох
    let breathInTime = 2;
    elements.phaseText.textContent = 'Сделайте глубокий вдох';
    elements.timer.textContent = formatTime(breathInTime);
    
    const breathInInterval = setInterval(() => {
        breathInTime--;
        elements.timer.textContent = formatTime(breathInTime);
        
        if (breathInTime <= 0) {
            clearInterval(breathInInterval);
            // 15 секунд задержки
            let holdTime = 15;
            elements.phaseText.textContent = 'Задержите дыхание';
            elements.timer.textContent = formatTime(holdTime);
            
            const holdInterval = setInterval(() => {
                holdTime--;
                elements.timer.textContent = formatTime(holdTime);
                
                if (holdTime <= 0) {
                    clearInterval(holdInterval);
                    // Вибрация после завершения 15-секундной задержки
                    vibrate([200, 100, 200]);
                    
                    // 2 секунды на выдох
                    let breathOutTime = 2;
                    elements.phaseText.textContent = 'Медленно выдохните';
                    elements.timer.textContent = formatTime(breathOutTime);
                    
                    const breathOutInterval = setInterval(() => {
                        breathOutTime--;
                        elements.timer.textContent = formatTime(breathOutTime);
                        
                        if (breathOutTime <= 0) {
                            clearInterval(breathOutInterval);
                            startBreathingSession();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
}

// Финальная задержка дыхания
function startFinalHold() {
    state.currentPhase = 'finalHold';
    elements.circleText.textContent = 'Восстановление';
    
    // 2 секунды на глубокий вдох
    let breathInTime = 2;
    elements.phaseText.textContent = 'Сделайте глубокий вдох';
    elements.timer.textContent = formatTime(breathInTime);
    
    const breathInInterval = setInterval(() => {
        breathInTime--;
        elements.timer.textContent = formatTime(breathInTime);
        
        if (breathInTime <= 0) {
            clearInterval(breathInInterval);
            // 15 секунд задержки
            let holdTime = 15;
            elements.phaseText.textContent = 'Задержите дыхание';
            elements.timer.textContent = formatTime(holdTime);
            
            const holdInterval = setInterval(() => {
                holdTime--;
                elements.timer.textContent = formatTime(holdTime);
                
                if (holdTime <= 0) {
                    clearInterval(holdInterval);
                    // Вибрация после завершения финальной 15-секундной задержки (более длинная)
                    vibrate([400, 100, 400]);
                    
                    // 2 секунды на выдох
                    let breathOutTime = 2;
                    elements.phaseText.textContent = 'Медленно выдохните';
                    elements.timer.textContent = formatTime(breathOutTime);
                    
                    const breathOutInterval = setInterval(() => {
                        breathOutTime--;
                        elements.timer.textContent = formatTime(breathOutTime);
                        
                        if (breathOutTime <= 0) {
                            clearInterval(breathOutInterval);
                            finishSession();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
}

// Завершение сессии
function finishSession() {
    state.currentPhase = 'idle';
    state.rounds.current = 0;
    state.rounds.breathCount = 0;
    
    elements.circleText.textContent = 'Начать';
    elements.phaseText.textContent = 'Нажмите на круг, чтобы начать';
    elements.timer.textContent = '00:00';
    elements.progressBar.style.width = '0%';
    
    if (isPlaying) {
        toggleMusic();
    }
    
    updateRoundsDisplay();
}
// Завершение фазы задержки дыхания
function finishHoldingPhase() {
    if (state.currentPhase !== 'holding') return;

    clearInterval(state.timer.interval);
    const holdTime = Math.floor((Date.now() - state.timer.startTime) / 1000);
    updateStats(holdTime);
    
    if (state.rounds.current < state.rounds.total) {
        startRecoveryPhase();
    } else {
        startFinalHold();
    }
}

// Фаза восстановления
function startRecoveryPhase() {
    state.currentPhase = 'recovery';
    elements.circleText.textContent = 'Восстановление';
    
    // 2 секунды на глубокий вдох
    let breathInTime = 2;
    elements.phaseText.textContent = 'Сделайте глубокий вдох';
    elements.timer.textContent = formatTime(breathInTime);
    
    const breathInInterval = setInterval(() => {
        breathInTime--;
        elements.timer.textContent = formatTime(breathInTime);
        
        if (breathInTime <= 0) {
            clearInterval(breathInInterval);
            // 15 секунд задержки
            let holdTime = 15;
            elements.phaseText.textContent = 'Задержите дыхание';
            elements.timer.textContent = formatTime(holdTime);
            
            const holdInterval = setInterval(() => {
                holdTime--;
                elements.timer.textContent = formatTime(holdTime);
                
                if (holdTime <= 0) {
                    clearInterval(holdInterval);
                    // Вибрация после завершения 15-секундной задержки
                    vibrate([200, 100, 200]);
                    
                    // 2 секунды на выдох
                    let breathOutTime = 2;
                    elements.phaseText.textContent = 'Медленно выдохните';
                    elements.timer.textContent = formatTime(breathOutTime);
                    
                    const breathOutInterval = setInterval(() => {
                        breathOutTime--;
                        elements.timer.textContent = formatTime(breathOutTime);
                        
                        if (breathOutTime <= 0) {
                            clearInterval(breathOutInterval);
                            startBreathingSession();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
}

// Финальная задержка дыхания
function startFinalHold() {
    state.currentPhase = 'finalHold';
    elements.circleText.textContent = 'Восстановление';
    
    // 2 секунды на глубокий вдох
    let breathInTime = 2;
    elements.phaseText.textContent = 'Сделайте глубокий вдох';
    elements.timer.textContent = formatTime(breathInTime);
    
    const breathInInterval = setInterval(() => {
        breathInTime--;
        elements.timer.textContent = formatTime(breathInTime);
        
        if (breathInTime <= 0) {
            clearInterval(breathInInterval);
            // 15 секунд задержки
            let holdTime = 15;
            elements.phaseText.textContent = 'Задержите дыхание';
            elements.timer.textContent = formatTime(holdTime);
            
            const holdInterval = setInterval(() => {
                holdTime--;
                elements.timer.textContent = formatTime(holdTime);
                
                if (holdTime <= 0) {
                    clearInterval(holdInterval);
                    // Вибрация после завершения финальной 15-секундной задержки (более длинная)
                    vibrate([400, 100, 400]);
                    
                    // 2 секунды на выдох
                    let breathOutTime = 2;
                    elements.phaseText.textContent = 'Медленно выдохните';
                    elements.timer.textContent = formatTime(breathOutTime);
                    
                    const breathOutInterval = setInterval(() => {
                        breathOutTime--;
                        elements.timer.textContent = formatTime(breathOutTime);
                        
                        if (breathOutTime <= 0) {
                            clearInterval(breathOutInterval);
                            finishSession();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
}

// Завершение сессии
function finishSession() {
    state.currentPhase = 'idle';
    state.rounds.current = 0;
    state.rounds.breathCount = 0;
    
    elements.circleText.textContent = 'Начать';
    elements.phaseText.textContent = 'Нажмите на круг, чтобы начать';
    elements.timer.textContent = '00:00';
    elements.progressBar.style.width = '0%';
    
    if (isPlaying) {
        toggleMusic();
    }
    
    updateRoundsDisplay();
}
