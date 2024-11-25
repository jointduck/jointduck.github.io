let tg = window.Telegram.WebApp;
tg.expand();

// Состояние приложения
const state = {
    isBreathing: false,
    currentPhase: 'idle', // idle, breathing, holding, recovery
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
    // Обработчики для кнопок раундов
    const decreaseButton = document.getElementById('decreaseRounds');
    const increaseButton = document.getElementById('increaseRounds');

    if (decreaseButton && increaseButton) {
        decreaseButton.addEventListener('click', () => {
            if (state.rounds.total > 1) {
                state.rounds.total--;
                updateRoundsDisplay();
                saveUserData();
            }
        });

        increaseButton.addEventListener('click', () => {
            if (state.rounds.total < 10) {
                state.rounds.total++;
                updateRoundsDisplay();
                saveUserData();
            }
        });
    }

    // Обработчик для круга дыхания
    elements.breathCircle.addEventListener('click', handleBreathCircleClick);

    // Обработчики для вкладок статистики
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', handleStatsTabClick);
    });

    // Загрузка сохраненных данных при старте
    loadUserData();
    updateStatsDisplay();
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
}

// Цикл дыхания
function startBreathingCycle() {
    if (state.currentPhase !== 'breathing') return;

    state.rounds.breathCount++;
    if (state.rounds.breathCount <= 30) {
        // Фаза вдоха
        elements.breathCircle.classList.add('breathing-in');
        elements.breathCircle.classList.remove('breathing-out');
        elements.circleText.textContent = `Вдох ${state.rounds.breathCount}/30`;
        elements.phaseText.textContent = 'Глубокий вдох через нос';
        
        setTimeout(() => {
            if (state.currentPhase === 'breathing') {
                // Фаза выдоха
                elements.breathCircle.classList.remove('breathing-in');
                elements.breathCircle.classList.add('breathing-out');
                elements.circleText.textContent = `Выдох ${state.rounds.breathCount}/30`;
                elements.phaseText.textContent = 'Спокойный выдох через рот';
                
                setTimeout(() => {
                    elements.breathCircle.classList.remove('breathing-out');
                    if (state.currentPhase === 'breathing') {
                        startBreathingCycle();
                    }
                }, 2000); // Длительность выдоха
            }
        }, 2000); // Длительность вдоха

        elements.progressBar.style.width = `${(state.rounds.breathCount/30) * 100}%`;
    } else {
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
        finishSession();
    }
}

// Фаза восстановления
function startRecoveryPhase() {
    state.currentPhase = 'recovery';
    elements.circleText.textContent = 'Восстановление';
    elements.phaseText.textContent = 'Глубокий вдох и задержка на 15 секунд';
    
    let recoveryTime = 15;
    elements.timer.textContent = formatTime(recoveryTime);
    
    const recoveryInterval = setInterval(() => {
        recoveryTime--;
        elements.timer.textContent = formatTime(recoveryTime);
        
        if (recoveryTime <= 0) {
            clearInterval(recoveryInterval);
            if (state.rounds.current < state.rounds.total) {
                startBreathingSession();
            } else {
                finishSession();
            }
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
    
    updateRoundsDisplay();
}

// Обновление таймера
function updateTimer() {
    const elapsed = Math.floor((Date.now() - state.timer.startTime) / 1000);
    elements.timer.textContent = formatTime(elapsed);
}

// Форматирование времени
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Обработчик вкладок статистики
function handleStatsTabClick(e) {
    document.querySelectorAll('.stats-tab').forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');
    
    document.querySelectorAll('.stats-content').forEach(content => {
        content.style.display = 'none';
    });
    
    document.getElementById(`stats${e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1)}`)
        .style.display = 'block';
}

// Обновление отображения раундов
function updateRoundsDisplay() {
    elements.roundsCount.textContent = state.rounds.total;
    elements.currentRound.textContent = state.rounds.current;
    elements.totalRounds.textContent = state.rounds.total;
}

// Обновление статистики
function updateStats(holdTime) {
    const today = new Date().toDateString();
    
    // Обновление дневной статистики
    state.stats.today.sessions++;
    state.stats.today.times.push(holdTime);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime, holdTime);

    // Обновление общей статистики
    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime, holdTime);

    // Обновление серии дней
    if (state.stats.allTime.lastPractice !== today) {
        const lastDate = new Date(state.stats.allTime.lastPractice);
        const currentDate = new Date(today);
        const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            state.stats.allTime.streak++;
        } else if (diffDays > 1) {
            state.stats.allTime.streak = 1;
        }
        state.stats.allTime.lastPractice = today;
    }

    saveUserData();
    updateStatsDisplay();
    checkAchievements();
}

// Обновление отображения статистики
function updateStatsDisplay() {
    document.getElementById('sessionsToday').textContent = state.stats.today.sessions;
    document.getElementById('bestTimeToday').textContent = formatTime(state.stats.today.bestTime);
    document.getElementById('avgTimeToday').textContent = formatTime(
        state.stats.today.times.length > 0 
            ? Math.floor(state.stats.today.times.reduce((a, b) => a + b, 0) / state.stats.today.times.length)
            : 0
    );

    document.getElementById('totalSessions').textContent = state.stats.allTime.sessions;
    document.getElementById('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime);
    document.getElementById('avgTimeAll').textContent = formatTime(
        state.stats.allTime.times.length > 0 
            ? Math.floor(state.stats.allTime.times.reduce((a, b) => a + b, 0) / state.stats.allTime.times.length)
            : 0
    );
    document.getElementById('streakDays').textContent = state.stats.allTime.streak;
}

// Проверка достижений
function checkAchievements() {
    const achievements = [
        {
            id: 'firstSession',
            title: 'Первый шаг',
            condition: () => state.stats.allTime.sessions === 1,
            icon: '🎯'
        },
        {
            id: 'tenSessions',
            title: 'Постоянная практика',
            condition: () => state.stats.allTime.sessions >= 10,
            icon: '🌟'
        },
        {
            id: 'threeMinutes',
            title: 'Мастер задержки',
            condition: () => state.stats.allTime.bestTime >= 180,
            icon: '⭐'
        },
        {
            id: 'weekStreak',
            title: 'Недельный марафон',
            condition: () => state.stats.allTime.streak >= 7,
            icon: '🏃'
        }
    ];

    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = '';

    achievements.forEach(achievement => {
        if (achievement.condition()) {
            const achievementElement = document.createElement('div');
            achievementElement.className = 'achievement';
            achievementElement.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-title">${achievement.title}</div>
                </div>
            `;
            achievementsList.appendChild(achievementElement);
        }
    });
}

// Сохранение данных пользователя
function saveUserData() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        localStorage.setItem(`wimhof_${userId}`, JSON.stringify({
            stats: state.stats,
            rounds: {
                total: state.rounds.total
            }
        }));
    }
}

// Загрузка данных пользователя
function loadUserData() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        const savedData = localStorage.getItem(`wimhof_${userId}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            state.stats = data.stats;
            state.rounds.total = data.rounds.total;
            updateRoundsDisplay();
        }
    }
}
