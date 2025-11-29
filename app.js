let tg = window.Telegram.WebApp;
tg.expand();

// Автоматически добавляем отступ под верхнюю панель Telegram (на некоторых устройствах)
if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.0')) {
    const topInset = tg.viewportStableHeight - tg.viewportHeight;
    if (topInset > 0) {
        document.body.style.paddingTop = `${topInset + 20}px`;
    }
}
function haptic(type = 'light') {
    try {
        Telegram.WebApp.HapticFeedback.impactOccurred(type);
    } catch(e) {}
}
function successHaptic() {
    try {
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } catch(e) {}
}

// Состояние
const state = {
    isBreathing: false,
    currentPhase: 'idle',
    rounds: { current: 0, total: 3, breathCount: 0 },
    timer: { startTime: null, interval: null },
    stats: {
        today: { sessions: 0, bestTime: 0, times: [] },
        allTime: { sessions: 0, bestTime: 0, times: [], streak: 0, lastPractice: null }
    },
    previousBestAllTime: 0 // для определения нового рекорда
};

// DOM
const el = {
    circle: document.getElementById('breathCircle'),
    circleText: document.getElementById('circleText'),
    phase: document.getElementById('phaseText'),
    timer: document.getElementById('timer'),
    progress: document.getElementById('progressBar'),
    roundsCount: document.getElementById('roundsCount'),
    currentRound: document.getElementById('currentRound'),
    totalRounds: document.getElementById('totalRounds')
};

document.addEventListener('DOMContentLoaded', () => {
    // Кнопки раундов
    document.getElementById('decreaseRounds').onclick = () => {
        if (state.rounds.total > 1) {
            state.rounds.total--;
            updateRounds();
            save();
            haptic();
        }
    };
    document.getElementById('increaseRounds').onclick = () => {
        if (state.rounds.total < 10) {
            state.rounds.total++;
            updateRounds();
            save();
            haptic();
        }
    };

    // Круг дыхания
    el.circle.onclick = startOrFinishHold;

    // Вкладки статистики
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.stats-content').forEach(c => c.style.display = 'none');
            document.getElementById('stats' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).style.display = 'block';
            if (tab.dataset.tab === 'allTime') updateChart();
        };
    });

    loadData();
    resetTodayIfNewDay(); // ← это главное исправление
    updateAllDisplays();
});

function startOrFinishHold() {
    if (state.currentPhase === 'idle') {
        startSession();
    } else if (state.currentPhase === 'holding' || state.currentPhase === 'finalHold') {
        finishHold();
    }
}

function startSession() {
    state.rounds.current++;
    state.rounds.breathCount = 0;
    state.currentPhase = 'breathing';
    updateRounds();
    startBreathingCycle();
    haptic('medium');
}

function startBreathingCycle() {
    if (state.rounds.breathCount >= 30) {
        startHold();
        return;
    }

    // Вдох
    state.rounds.breathCount++;
    const progress = (state.rounds.breathCount / 30) * 100;
    el.progress.style.width = progress + '%';

    el.circle.className = 'breath-circle breathing-in';
    el.circleText.textContent = `Вдох ${state.rounds.breathCount}/30`;
    el.phase.textContent = 'Глубокий вдох через нос';

    setTimeout(() => {
        if (state.currentPhase !== 'breathing') return;
        el.circle.className = 'breath-circle breathing-out';
        el.circleText.textContent = `Выдох ${state.rounds.breathCount}/30`;
        el.phase.textContent = 'Спокойный выдох через рот';

        setTimeout(() => {
            if (state.currentPhase === 'breathing') startBreathingCycle();
        }, 2000);
    }, 2000);
}

function startHold() {
    state.currentPhase = state.rounds.current < state.rounds.total ? 'holding' : 'finalHold';
    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Задержка';
    el.phase.textContent = 'Задержите дыхание после выдоха';
    el.progress.style.width = '0%';

    state.timer.startTime = Date.now();
    state.timer.interval = setInterval(() => {
        const sec = Math.floor((Date.now() - state.timer.startTime) / 1000);
        el.timer.textContent = formatTime(sec);
    }, 200);

    haptic('medium');
}

function finishHold() {
    clearInterval(state.timer.interval);
    const holdTime = Math.floor((Date.now() - state.timer.startTime) / 1000);

    // Сохраняем результат
    const today = new Date().toDateString();
    state.stats.today.sessions++;
    state.stats.today.times.push(holdTime);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime, holdTime);

    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    const newBest = Math.max(state.stats.allTime.bestTime, holdTime);
    const isNewRecord = newBest > state.stats.allTime.bestTime;

    state.stats.allTime.bestTime = newBest;
    state.stats.allTime.lastPractice = today;

    // Серия дней
    if (state.stats.allTime.lastPractice === today && state.stats.allTime.streak === 0) {
        state.stats.allTime.streak = 1;
    } else {
        const daysDiff = Math.floor((new Date() - new Date(state.stats.allTime.lastPractice)) / 86400000);
        if (daysDiff === 1) state.stats.allTime.streak++;
        else if (daysDiff > 1) state.stats.allTime.streak = 1;
    }

    // Уведомления о рекорде
    if (isNewRecord) {
        successHaptic();
        el.phase.textContent = `НОВЫЙ РЕКОРД! ${formatTime(holdTime)} 🎉`;
        setTimeout(() => { if (state.currentPhase !== 'idle') el.phase.textContent = ''; }, 4000);
    }

    save();
    updateStats();
    updateChart();
    checkAchievements();

    // Следующий раунд или завершение
        if (state.rounds.current < state.rounds.total) {
        recoveryPhase(startSession); // Переход к следующему раунду
    } else {
        recoveryPhase(finishSession); // Завершение сессии после восстановления
    }
}

function recoveryPhase(nextActionCallback) { // Принимаем функцию, которую нужно вызвать после восстановления
    state.currentPhase = 'recovery';
    el.circleText.textContent = 'Восстановление';
    guidedBreath(2, 'Глубокий вдох', () => {
        guidedBreath(15, 'Задержите на 15 сек', () => {
            guidedBreath(2, 'Медленно выдохните', nextActionCallback); // Вызываем переданную функцию
        });
    });
}

function finishSession() {
    state.currentPhase = 'idle';
    state.rounds.current = 0;
    state.rounds.breathCount = 0;

    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Начать';
    el.phase.textContent = 'Сессия завершена! Отличная работа 💙';
    el.timer.textContent = '00:00';
    el.progress.style.width = '0%';
    updateRounds();

    successHaptic();
    haptic('heavy');

    setTimeout(() => {
        el.phase.textContent = 'Нажмите на круг, чтобы начать';
    }, 5000);
}

// Вспомогательная функция для восстановительного дыхания
function guidedBreath(seconds, text, callback) {
    let time = seconds;
    el.phase.textContent = text;
    el.timer.textContent = formatTime(time);

    const int = setInterval(() => {
        time--;
        el.timer.textContent = formatTime(time);
        if (time <= 0) {
            clearInterval(int);
            haptic();
            callback();
        }
    }, 1000);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateRounds() {
    el.roundsCount.textContent = state.rounds.total;
    el.currentRound.textContent = state.rounds.current || 0;
    el.totalRounds.textContent = state.rounds.total;
}

function updateStats() {
    const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

    document.getElementById('sessionsToday').textContent = state.stats.today.sessions;
    document.getElementById('bestTimeToday').textContent = formatTime(state.stats.today.bestTime);
    document.getElementById('avgTimeToday').textContent = formatTime(avg(state.stats.today.times));

    document.getElementById('totalSessions').textContent = state.stats.allTime.sessions;
    document.getElementById('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime);
    document.getElementById('avgTimeAll').textContent = formatTime(avg(state.stats.allTime.times));
    document.getElementById('streakDays').textContent = state.stats.allTime.streak || 0;
}

function updateChart() {
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${tg.initDataUnsafe?.user?.id}`) || '{}');
    const dates = Object.keys(daily).sort().slice(-10);
    
    if (dates.length === 0) {
        document.getElementById('dailyStatsChart').style.display = 'none';
        return;
    }
    document.getElementById('dailyStatsChart').style.display = 'block';

    const bests = dates.map(d => Math.max(...daily[d]));
    const avgs = dates.map(d => Math.round(daily[d].reduce((a,b)=>a+b,0)/daily[d].length));

    if (window.chart) window.chart.destroy();

    window.chart = new Chart(document.getElementById('dailyStatsChart'), {
        type: 'bar',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('ru-RU', {day:'numeric', month:'short'})),
            datasets: [{
                label: 'Лучшее',
                data: bests,
                backgroundColor: 'rgba(76, 175, 80, 0.7)'
            }, {
                label: 'Среднее',
                data: avgs,
                backgroundColor: 'rgba(33, 150, 243, 0.7)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function checkAchievements() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';

    const achs = [
        {id:1, title:'Первая сессия', icon:'🏆', cond:() => state.stats.allTime.sessions >= 1},
        {id:2, title:'10 сессий', icon:'🔥', cond:() => state.stats.allTime.sessions >= 10},
        {id:3, title:'3 минуты!', icon:'⏱️', cond:() => state.stats.allTime.bestTime >= 180},
        {id:4, title:'Неделя подряд', icon:'🏃‍♂️', cond:() => state.stats.allTime.streak >= 7},
        {id:5, title:'2 минуты', icon:'⭐', cond:() => state.stats.allTime.bestTime >= 120},
        {id:6, title:'Месяц практики', icon:'🌟', cond:() => state.stats.allTime.sessions >= 30},
    ];

    achs.forEach(a => {
        if (a.cond()) {
            list.innerHTML += `
                <div class="achievement">
                    <div class="achievement-icon">${a.icon}</div>
                    <div class="achievement-info">
                        <div class="achievement-title">${a.title}</div>
                    </div>
                </div>`;
        }
    });
}

// ======== Сохранение / загрузка ========
function save() {
    const id = tg.initDataUnsafe?.user?.id;
    if (!id) return;

    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    const today = new Date().toDateString();
    if (!daily[today]) daily[today] = [];
    // Сохраняем только сегодняшние результаты в daily
    daily[today] = state.stats.today.times.slice();

    localStorage.setItem(`wimhof_daily_${id}`, JSON.stringify(daily));
    localStorage.setItem(`wimhof_${id}`, JSON.stringify({
        rounds: state.rounds.total,
        allTime: state.stats.allTime
    }));
}

function loadData() {
    const id = tg.initDataUnsafe?.user?.id;
    if (!id) return;

    const saved = localStorage.getItem(`wimhof_${id}`);
    if (saved) {
        const d = JSON.parse(saved);
       state.rounds.total = typeof d.rounds === 'number'
    ? d.rounds
    : (d.rounds?.total || 3);
        state.stats.allTime = d.allTime || state.stats.allTime;
    }
}

function resetTodayIfNewDay() {
    const today = new Date().toDateString();
    if (state.stats.allTime.lastPractice !== today) {
        state.stats.today = { sessions: 0, bestTime: 0, times: [] };
    }
}

function updateAllDisplays() {
    resetTodayIfNewDay();
    updateRounds();
    updateStats();
    updateChart();
    checkAchievements();
}
