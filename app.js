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

// Функция для тактильной обратной связи
function hapticFeedback(type, intensity = 'light') {
    try {
        if (window.Telegram && window.Telegram.WebApp && 
            window.Telegram.WebApp.HapticFeedback) {
            const haptic = window.Telegram.WebApp.HapticFeedback;
            
            switch(type) {
                case 'impact':
                    if (haptic.impactOccurred) {
                        haptic.impactOccurred(intensity);
                    }
                    break;
                case 'notification':
                    if (haptic.notificationOccurred) {
                        haptic.notificationOccurred(intensity);
                    }
                    break;
                case 'selection':
                    if (haptic.selectionChanged) {
                        haptic.selectionChanged();
                    }
                    break;
            }
        } else {
            console.log('Haptic feedback not available');
        }
    } catch (e) {
        console.log('Haptic feedback error:', e);
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
    const breathCircle = document.getElementById('breathCircle');
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

    if (breathCircle) {
        console.log('Setting up click handler for breath circle');
        // Добавляем оба типа событий для надежности
        breathCircle.addEventListener('click', handleBreathCircleClick);
        breathCircle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleBreathCircleClick();
        }, { passive: false });
        breathCircle.style.cursor = 'pointer';
        console.log('Click handler set up for breath circle');
    } else {
        console.error('Breath circle element not found!');
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
    console.log('Circle clicked, current phase:', state.currentPhase);
    
    if (state.currentPhase === 'idle' || state.currentPhase === undefined) {
        console.log('Starting breathing session');
        startBreathingSession();
    } else if (state.currentPhase === 'holding') {
        console.log('Finishing holding phase');
        finishHoldingPhase();
    } else {
        console.log('Click ignored in phase:', state.currentPhase);
    }
}

// Начало сессии дыхания
function startBreathingSession() {
    state.currentPhase = 'breathing';
    state.rounds.current++;
    state.rounds.breathCount = 0;
    
    startBreathingCycle();
    updateRoundsDisplay();
    
    // Тактильная обратная связь при старте
    hapticFeedback('impact', 'light');
}

// Цикл дыхания
function startBreathingCycle() {
    if (state.currentPhase !== 'breathing') {
        console.log('Not in breathing phase, current phase:', state.currentPhase);
        return;
    }

    // Фаза вдоха
    function startInhale() {
        if (state.currentPhase !== 'breathing') return;
        
        // Увеличиваем счетчик только в начале вдоха
        if (state.rounds.breathCount < 30) {
            state.rounds.breathCount++;
            console.log('Breath count:', state.rounds.breathCount);
            
            // Обновляем прогресс-бар
            const progress = Math.min((state.rounds.breathCount / 30) * 100, 100);
            elements.progressBar.style.width = `${progress}%`;
        }
        
        const isLastBreath = state.rounds.breathCount >= 30;
        
        elements.breathCircle.classList.add('breathing-in');
        elements.breathCircle.classList.remove('breathing-out');
        elements.circleText.textContent = `Вдох ${Math.min(state.rounds.breathCount, 30)}/30`;
        elements.phaseText.textContent = 'Глубокий вдох через нос';
        
        if (isLastBreath) {
            console.log('Last breath, moving to hold phase');
            hapticFeedback('impact', 'light');
            // Даем немного времени на последний вдох
            setTimeout(() => {
                if (state.currentPhase === 'breathing') {
                    startHoldingPhase();
                }
            }, 1000);
            return;
        }

        // Переход к выдоху через 2 секунды
        setTimeout(startExhale, 2000);
    }
    
    // Фаза выдоха
    function startExhale() {
        if (state.currentPhase !== 'breathing') return;
        
        elements.breathCircle.classList.remove('breathing-in');
        elements.breathCircle.classList.add('breathing-out');
        elements.circleText.textContent = `Выдох ${state.rounds.breathCount}/30`;
        elements.phaseText.textContent = 'Спокойный выдох через рот';

        // Переход к следующему вдоху через 2 секунды
        setTimeout(() => {
            if (state.currentPhase === 'breathing') {
                startInhale();
            }
        }, 2000);
    }
    
    // Начинаем с вдоха
    startInhale();
}

// Начало фазы задержки дыхания
function startHoldingPhase() {
    state.currentPhase = 'holding';
    elements.breathCircle.classList.remove('breathing-in', 'breathing-out');
    elements.circleText.textContent = 'Задержка';
    elements.phaseText.textContent = 'Выдохните и задержите дыхание';
    hapticFeedback('impact', 'medium'); // Вибрация при начале задержки
    
    state.timer.startTime = Date.now();
    state.timer.interval = setInterval(updateTimer, 1000);
}

// Завершение фазы задержки дыхания
function finishHoldingPhase() {
    if (state.currentPhase !== 'holding') return;

    clearInterval(state.timer.interval);
    const holdTime = Math.floor((Date.now() - state.timer.startTime) / 1000);
    hapticFeedback('impact', 'medium'); // Вибрация при окончании задержки
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
                    hapticFeedback('impact', 'medium'); // Вибрация после 15-секундной задержки
                    
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
    hapticFeedback('impact', 'heavy'); // Сильная вибрация при завершении
    hapticFeedback('notification', 'success'); // Уведомление об успешном завершении
    
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
    
    const targetContent = document.getElementById(`stats${e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1)}`);
    targetContent.style.display = 'block';
    
    // Обновляем график только при переключении на вкладку "За все время"
    if (e.target.dataset.tab === 'allTime') {
        updateDailyChart();
    }
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
    
    // Обновление общей статистики
    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    
    // Обновление лучшего времени
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime || 0, holdTime);
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime || 0, holdTime);

    // Обновление ежедневной статистики для графика
    const dailyStats = JSON.parse(localStorage.getItem(`wimhof_${tg.initDataUnsafe?.user?.id}_daily`) || '{}');
    if (!dailyStats[today]) {
        dailyStats[today] = [];
    }
    dailyStats[today].push(holdTime);
    localStorage.setItem(`wimhof_${tg.initDataUnsafe?.user?.id}_daily`, JSON.stringify(dailyStats));

    // Обновление серии дней
    const currentDate = new Date(today);
    
    if (!state.stats.allTime.lastPractice) {
        // Первая практика пользователя
        state.stats.allTime.streak = 1;
    } else {
        const lastDate = new Date(state.stats.allTime.lastPractice);
        const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Та же дата, не обновляем стрик
        } else if (diffDays === 1) {
            // Следующий день - увеличиваем стрик
            state.stats.allTime.streak++;
        } else if (diffDays > 1) {
            // Пропустили день - сбрасываем стрик
            state.stats.allTime.streak = 1;
        }
    }
    
    // Всегда обновляем дату последней практики
    state.stats.allTime.lastPractice = today;

    // Уведомление о новом рекорде (если текущий результат лучше предыдущего лучшего)
    if (holdTime > (state.stats.allTime.bestTime || 0)) {
        hapticFeedback('notification', 'success');
    }

    saveUserData();
    updateStatsDisplay();
    updateDailyChart();
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

// Обновление графика
function updateDailyChart() {
    const dailyStats = JSON.parse(localStorage.getItem(`wimhof_${tg.initDataUnsafe?.user?.id}_daily`) || '{}');
    const ctx = document.getElementById('dailyStatsChart').getContext('2d');
    
    // Получаем последние 7 дней
    const dates = Object.keys(dailyStats).sort().slice(-7);
    
    // Подготавливаем данные для обоих наборов
    const bestTimeData = dates.map(date => {
        const times = dailyStats[date];
        return Math.max(...times); // Лучший результат за день
    });

    const avgTimeData = dates.map(date => {
        const times = dailyStats[date];
        return times.length > 0 
            ? Math.floor(times.reduce((a, b) => a + b, 0) / times.length) 
            : 0; // Среднее время за день
    });

    // Уничтожаем предыдущий график, если он существует
    if (window.dailyChart) {
        window.dailyChart.destroy();
    }

    // Создаем новый график с двумя наборами данных
    window.dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(date => new Date(date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Лучшее время задержки (сек)',
                    data: bestTimeData,
                    backgroundColor: 'rgba(75, 192, 75, 0.6)', // Зеленый цвет
                    borderColor: 'rgba(75, 192, 75, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Среднее время задержки (сек)',
                    data: avgTimeData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', // Синий цвет
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Секунды'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Дата'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
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
            
            // Проверка и сброс дневной статистики
            const today = new Date().toDateString();
            if (state.stats.allTime.lastPractice !== today) {
                state.stats.today = {
                    sessions: 0,
                    bestTime: 0,
                    times: []
                };
            }
            
            updateRoundsDisplay();
        }
    }
}
