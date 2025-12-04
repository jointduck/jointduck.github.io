let tg = window.Telegram.WebApp;
tg.expand();

// Отступ под чёлку / верхнюю панель
if (tg.isVersionAtLeast?.('6.0')) {
    const topInset = tg.viewportStableHeight - tg.viewportHeight;
    if (topInset > 0) document.body.style.paddingTop = `${topInset + 20}px`;
}

function haptic(type = 'light') {
    try { Telegram.WebApp.HapticFeedback.impactOccurred(type); } catch (e) {}
}
function successHaptic() {
    try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch (e) {}
}

// === Состояние ===
const state = {
    currentPhase: 'idle',
    rounds: { current: 0, total: 3, breathCount: 0 },
    timer: { startTime: null, interval: null },
    stats: {
        today: { sessions: 0, bestTime: 0, times: [] },
        allTime: { sessions: 0, bestTime: 0, times: [], streak: 0, lastPractice: null }
    }
};

// === DOM ===
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

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('decreaseRounds').onclick = () => {
        if (state.rounds.total > 1) { state.rounds.total--; updateRounds(); save(); haptic(); }
    };
    document.getElementById('increaseRounds').onclick = () => {
        if (state.rounds.total < 10) { state.rounds.total++; updateRounds(); save(); haptic(); }
    };

    el.circle.onclick = () => {
        if (state.currentPhase === 'idle') startSession();
        else if (state.currentPhase === 'holding' || state.currentPhase === 'finalHold') finishHold();
    };

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
    resetTodayIfNewDay();
    updateAllDisplays();
});

// === Вспомогательные функции (обязательно выше вызова!) ===
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
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    document.getElementById('sessionsToday').textContent = state.stats.today.sessions;
    document.getElementById('bestTimeToday').textContent = formatTime(state.stats.today.bestTime || 0);
    document.getElementById('avgTimeToday').textContent = formatTime(avg(state.stats.today.times));

    document.getElementById('totalSessions').textContent = state.stats.allTime.sessions;
    document.getElementById('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime || 0);
    document.getElementById('avgTimeAll').textContent = formatTime(avg(state.stats.allTime.times));
    document.getElementById('streakDays').textContent = state.stats.allTime.streak || 0;
}

// === Основной цикл ===
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
    state.rounds.breathCount++;
    el.progress.style.width = (state.rounds.breathCount / 30 * 100) + '%';

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
    el.phase.textContent = 'Выдохните и задержите дыхание';
    el.progress.style.width = '0%';
    el.timer.textContent = '00:00';

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
    const today = new Date().toDateString();

    // Сегодняшняя статистика
    state.stats.today.sessions++;
    state.stats.today.times.push(holdTime);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime, holdTime);

    // Общая статистика
    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    const wasBest = state.stats.allTime.bestTime;
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime, holdTime);

    // Стрейк — 100% правильно
    if (!state.stats.allTime.lastPractice || state.stats.allTime.lastPractice !== today) {
        const daysDiff = state.stats.allTime.lastPractice
            ? Math.round((new Date(today) - new Date(state.stats.allTime.lastPractice)) / 86400000)
            : 0;
        if (daysDiff === 1) state.stats.allTime.streak++;
        else if (daysDiff > 1) state.stats.allTime.streak = 1;
        else state.stats.allTime.streak = 1;
        state.stats.allTime.lastPractice = today;
    }

    // Новый рекорд
    if (holdTime > wasBest) {
        successHaptic();
        el.phase.textContent = `НОВЫЙ РЕКОРД! ${formatTime(holdTime)}`;
        setTimeout(() => {
            if (state.currentPhase !== 'idle') el.phase.textContent = 'Выдохните и задержите дыхание';
        }, 4000);
    }

    save();
    updateStats();
    updateChart();
    checkAchievements();

    // Переход к восстановлению
    if (state.rounds.current < state.rounds.total) {
        recoveryPhase(startSession);
    } else {
        recoveryPhase(finishSession);
    }
}

function recoveryPhase(nextCallback) {
    state.currentPhase = 'recovery';
    el.circleText.textContent = 'Восстановление';
    guidedBreath(2, 'Глубокий вдох', () => {
        guidedBreath(15, 'Задержите на 15 сек', () => {
            guidedBreath(2, 'Медленно выдохните', () => {
                haptic();
                nextCallback();
            });
        });
    });
}

function finishSession() {
    state.currentPhase = 'idle';
    state.rounds.current = 0;
    state.rounds.breathCount = 0;

    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Начать';
    el.phase.textContent = 'Сессия завершена! Отличная работа';
    el.timer.textContent = '00:00';
    el.progress.style.width = '0%';
    updateRounds();

    successHaptic();
    haptic('heavy');

    setTimeout(() => el.phase.textContent = 'Нажмите на круг, чтобы начать', 5000);
}

function guidedBreath(sec, text, cb) {
    let time = sec;
    el.phase.textContent = text;
    el.timer.textContent = formatTime(time);
    const int = setInterval(() => {
        time--;
        el.timer.textContent = formatTime(time);
        if (time <= 0) {
            clearInterval(int);
            cb();
        }
    }, 1000);
}

// График (10 последних дней)
function updateChart() {
    const id = tg.initDataUnsafe?.user?.id;
    if (!id) return;

    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    const today = new Date();
    const labels = [];
    const dates = [];

    for (let i = 9; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const str = d.toDateString();
        dates.push(str);
        labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''));
    }

    const bests = dates.map(d => Math.max(...(daily[d] || [0]), 0));
    const avgs = dates.map(d => {
        const t = daily[d] || [];
        return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : 0;
    });

    document.getElementById('dailyStatsChart').style.display = 'block';
    if (window.chart) window.chart.destroy();

    window.chart = new Chart(document.getElementById('dailyStatsChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Лучшее', data: bests, backgroundColor: 'rgba(0, 212, 255, 0.85)', borderRadius: 6 },
                { label: 'Среднее', data: avgs, backgroundColor: 'rgba(255, 0, 200, 0.65)', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: v => formatTime(v) } } },
            plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y)}` } } }
        }
    });
}

function checkAchievements() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';
    const achs = [
        { title: 'Первая сессия', icon: 'Trophy', cond: () => state.stats.allTime.sessions >= 1 },
        { title: '10 сессий', icon: 'Fire', cond: () => state.stats.allTime.sessions >= 10 },
        { title: '2 минуты', icon: 'Star', cond: () => state.stats.allTime.bestTime >= 120 },
        { title: '3 минуты!', icon: 'Stopwatch', cond: () => state.stats.allTime.bestTime >= 180 },
        { title: 'Неделя подряд', icon: 'Running Man', cond: () => state.stats.allTime.streak >= 7 },
        { title: 'Месяц практики', icon: 'Sparkles', cond: () => state.stats.allTime.sessions >= 30 }
    ];

    achs.forEach(a => {
        if (a.cond()) {
            list.innerHTML += `<div class="achievement"><div class="achievement-icon">${a.icon}</div><div class="achievement-title">${a.title}</div></div>`;
        }
    });
}

// === Сохранение ===
function save() {
    const id = tg.initDataUnsafe?.user?.id;
    if (!id) return;

    const today = new Date().toDateString();
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
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
        state.rounds.total = d.rounds || 3;
        if (d.allTime) state.stats.allTime = d.allTime;
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
