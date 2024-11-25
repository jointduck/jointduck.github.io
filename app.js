let tg = window.Telegram.WebApp;
tg.expand();

// Состояние приложения
const state = {
    rounds: {
        current: 0,
        total: 3,
        breathCount: 0
    },
    settings: {
        sound: true,
        vibration: true
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

// Загрузка сохраненных данных
function loadUserData() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        const savedData = localStorage.getItem(`wimhof_${userId}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.assign(state, data);
            updateStatsDisplay();
        }
    }
}

// Сохранение данных пользователя
function saveUserData() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        localStorage.setItem(`wimhof_${userId}`, JSON.stringify(state));
    }
}

// Обновление отображения статистики
function updateStatsDisplay() {
    // Сегодняшняя статистика
    document.getElementById('sessionsToday').textContent = state.stats.today.sessions;
    document.getElementById('bestTimeToday').textContent = formatTime(state.stats.today.bestTime);
    document.getElementById('avgTimeToday').textContent = formatTime(
        state.stats.today.times.length > 0 
            ? state.stats.today.times.reduce((a, b) => a + b, 0) / state.stats.today.times.length 
            : 0
    );

    // Общая статистика
    document.getElementById('totalSessions').textContent = state.stats.allTime.sessions;
    document.getElementById('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime);
    document.getElementById('avgTimeAll').textContent = formatTime(
        state.stats.allTime.times.length > 0 
            ? state.stats.allTime.times.reduce((a, b) => a + b, 0) / state.stats.allTime.times.length 
            : 0
    );
    document.getElementById('streakDays').textContent = state.stats.allTime.streak;

    // Обновление счетчика раундов
    document.getElementById('roundsCount').textContent = state.rounds.total;
    document.getElementById('currentRound').textContent = state.rounds.current;
    document.getElementById('totalRounds').textContent = state.rounds.total;
}

// Управление раундами
document.getElementById('increaseRounds').addEventListener('click', () => {
    if (state.rounds.total < 10) {
        state.rounds.total++;
        updateStatsDisplay();
        saveUserData();
    }
});

document.getElementById('decreaseRounds').addEventListener('click', () => {
    if (state.rounds.total > 1) {
        state.rounds.total--;
        updateStatsDisplay();
        saveUserData();
    }
});

// Переключение вкладок статистики
document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        document.querySelectorAll('.stats-content').forEach(content => {
            content.style.display = 'none';
        });
        
        document.getElementById(`stats${e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1)}`)
            .style.display = 'block';
    });
});

// Обработка достижений
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

// Обновление статистики после сессии
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

// ... [остальной код для дыхательных упражнений остается прежним] ...

// Инициализация
loadUserData();
updateStatsDisplay();
checkAchievements();
