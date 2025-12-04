// === Автоопределение окружения ===
const isTelegram = !!window.Telegram?.WebApp;
let tg = isTelegram ? window.Telegram.WebApp : null;
if (tg) tg.expand();

// Фолбэк для хаптиков в браузере
function haptic(type = 'light') {
    if (tg) {
        try { tg.HapticFeedback.impactOccurred(type); } catch(e) {}
    } else if (navigator.vibrate) {
        const patterns = { light: [20], medium: [50], heavy: [100], success: [30, 50, 30] };
        navigator.vibrate(patterns[type] || patterns.light);
    }
}
function successHaptic() {
    if (tg) {
        try { tg.HapticFeedback.notificationOccurred('success'); } catch(e) {}
    } else if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
}

// Уникальный ID пользователя (Telegram или demo)
const userId = isTelegram && tg.initDataUnsafe?.user?.id 
    ? tg.initDataUnsafe.user.id 
    : 'standalone_user';

// Состояние и DOM остаются теми же
const state = {
    currentPhase: 'idle',
    rounds: { current: 0, total: 3, breathCount: 0 },
    timer: { startTime: null, interval: null },
    stats: {
        today: { sessions: 0, bestTime: 0, times: [] },
        allTime: { sessions: 0, bestTime: 0, times: [], streak: 0, lastPractice: null }
    }
};

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

// === Всё остальное — 100% идентично предыдущей версии, только с userId ===
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

    // Подсказка, если открыто не в Telegram
    if (!isTelegram) {
        setTimeout(() => {
            if (confirm('🚀 Это демо-версия для браузера!\nХочешь установить как приложение на телефон?')) {
                alert('Нажми «Поделиться → На экран домой» (iOS) или «Добавить на главный экран» (Android)');
            }
        }, 2000);
    }
});

// === ВСЁ НИЖЕ — БЕЗ ИЗМЕНЕНИЙ (кроме userId в save/load) ===

function startSession() {
    state.rounds.current++;
    state.rounds.breathCount = 0;
    state.currentPhase = 'breathing';
    updateRounds();
    startBreathingCycle();
    haptic('medium');
}

function startBreathingCycle() {
    if (state.rounds.breathCount >= 30) { startHold(); return; }
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
    el.phase.textContent = 'Выдохните полностью и задержите дыхание';
    el.progress.style.width = '0%';
    el.timer.textContent = '00:00';

    state.timer.startTime = Date.now();
    state.timer.interval = setInterval(() => {
        const sec = Math.floor((Date.now() - state.timer.startTime) / 1000);
        el.timer.textContent = formatTime(sec);
    }, 200);
}

function finishHold() {
    clearInterval(state.timer.interval);
    const holdTime = Math.floor((Date.now() - state.timer.startTime) / 1000);
    const wasBest = state.stats.allTime.bestTime;

    state.stats.today.sessions++;
    state.stats.today.times.push(holdTime);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime, holdTime);

    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime, holdTime);

    const todayStr = new Date().toDateString();
    if (state.stats.allTime.lastPractice !== todayStr) {
        const prev = state.stats.allTime.lastPractice;
        const daysDiff = prev ? Math.floor((new Date(todayStr) - new Date(prev)) / 86400000) : 999;
        state.stats.allTime.streak = daysDiff === 1 ? state.stats.allTime.streak + 1 : 1;
        state.stats.allTime.lastPractice = todayStr;
    }

    if (holdTime > wasBest) {
        successHaptic();
        el.phase.textContent = `НОВЫЙ РЕКОРД! ${formatTime(holdTime)}`;
        setTimeout(() => el.phase.textContent = 'Круто!', 4000);
    }

    save();
    updateStats();
    updateChart();
    checkAchievements();

    state.rounds.current < state.rounds.total ? recoveryPhase(startSession) : recoveryPhase(finishSession);
}

function recoveryPhase(next) {
    state.currentPhase = 'recovery';
    el.circleText.textContent = 'Восстановление';
    guidedBreath(2, 'Глубокий вдох', () => {
        guidedBreath(15, 'Задержите на 15 сек', () => {
            guidedBreath(2, 'Медленный выдох', next);
        });
    });
}

function guidedBreath(sec, text, cb) {
    let t = sec;
    el.phase.textContent = text;
    el.timer.textContent = formatTime(t);
    const int = setInterval(() => {
        t--;
        el.timer.textContent = formatTime(t);
        if (t <= 0) { clearInterval(int); haptic(); cb(); }
    }, 1000);
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
    setTimeout(() => el.phase.textContent = 'Нажмите на круг, чтобы начать', 5000);
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
    document.getElementById('bestTimeToday').textContent = formatTime(state.stats.today.bestTime || 0);
    document.getElementById('avgTimeToday').textContent = formatTime(avg(state.stats.today.times));

    document.getElementById('totalSessions').textContent = state.stats.allTime.sessions;
    document.getElementById('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime || 0);
    document.getElementById('avgTimeAll').textContent = formatTime(avg(state.stats.allTime.times));
    document.getElementById('streakDays').textContent = state.stats.allTime.streak || 0;
}

function updateChart() {
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${userId}`) || '{}');
    const dates = Object.keys(daily).sort().slice(-10);
    const ctx = document.getElementById('dailyStatsChart').getContext('2d');

    if (!dates.length) {
        ctx.canvas.closest('.chart-container').style.display = 'none';
        return;
    }
    ctx.canvas.closest('.chart-container').style.display = 'block';

    const bests = dates.map(d => Math.max(...(daily[d] || [0])));
    const avgs = dates.map(d => {
        const t = daily[d] || [];
        return t.length ? Math.round(t.reduce((a,b)=>a+b,0)/t.length) : 0;
    });

    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('ru-RU', {day:'numeric', month:'short'})),
            datasets: [
                { label: 'Лучшее', data: bests, backgroundColor: '#4caf50' },
                { label: 'Среднее', data: avgs, backgroundColor: '#2196f3' }
            ]
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
        {title:'Первая сессия', icon:'Trophy', cond:()=>state.stats.allTime.sessions>=1},
        {title:'10 сессий', icon:'Fire', cond:()=>state.stats.allTime.sessions>=10},
        {title:'2 минуты', icon:'Star', cond:()=>state.stats.allTime.bestTime>=120},
        {title:'3 минуты!', icon:'Stopwatch', cond:()=>state.stats.allTime.bestTime>=180},
        {title:'Неделя подряд', icon:'Running Man', cond:()=>state.stats.allTime.streak>=7},
        {title:'Месяц практики', icon:'Sparkles', cond:()=>state.stats.allTime.sessions>=30},
    ];
    achs.forEach(a => {
        if (a.cond()) list.innerHTML += `<div class="achievement"><div class="achievement-icon">${a.icon}</div><div class="achievement-info"><div class="achievement-title">${a.title}</div></div></div>`;
    });
}

function save() {
    const today = new Date().toDateString();
    let daily = JSON.parse(localStorage.getItem(`wimhof_daily_${userId}`) || '{}');
    daily[today] = state.stats.today.times.slice();
    localStorage.setItem(`wimhof_daily_${userId}`, JSON.stringify(daily));

    localStorage.setItem(`wimhof_${userId}`, JSON.stringify({
        rounds: state.rounds.total,
        allTime: state.stats.allTime
    }));
}

function loadData() {
    const saved = localStorage.getItem(`wimhof_${userId}`);
    if (saved) {
        const d = JSON.parse(saved);
        state.rounds.total = d.rounds || 3;
        if (d.allTime) state.stats.allTime = Object.assign(state.stats.allTime, d.allTime);
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
