let tg = window.Telegram?.WebApp;
if (tg) tg.expand();

function haptic(type = 'light') {
    try { Telegram.WebApp.HapticFeedback.impactOccurred(type); } catch (e) {}
}
function successHaptic() {
    try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch (e) {}
}

const state = {
    currentPhase: 'idle',
    rounds: { current: 0, total: 3, breathCount: 0 },
    timer: { startTime: null, interval: null },
    stats: {
        today: { sessions: 0, bestTime: 0, times: [] },
        allTime: { sessions: 0, bestTime: 0, times: [], streak: 0, lastPractice: null }
    }
};

let el = {};

function getElements() {
    el = {
        circle: document.getElementById('breathCircle'),
        circleText: document.getElementById('circleText'),
        phase: document.getElementById('phaseText'),
        timer: document.getElementById('timer'),
        progress: document.getElementById('progressBar'),
        roundsCount: document.getElementById('roundsCount'),
        currentRound: document.getElementById('currentRound'),
        totalRounds: document.getElementById('totalRounds')
    };
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
    const id = tg?.initDataUnsafe?.user?.id || 'demo';
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    const today = new Date();
    const labels = [], dates = [];

    for (let i = 9; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toDateString());
        labels.push(d.toLocaleDateString('ru-RU', {day:'numeric', month:'short'}).replace('.', ''));
    }

    const bests = dates.map(d => Math.max(...(daily[d] || [0]), 0));
    const avgs = dates.map(d => {
        const t = daily[d] || [];
        return t.length ? Math.round(t.reduce((a,b)=>a+b,0)/t.length) : 0;
    });

    const chartEl = document.getElementById('dailyStatsChart');
    if (!chartEl) return;
    chartEl.style.display = 'block';
    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(chartEl, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Лучшее', data: bests, backgroundColor: '#00d4ff', borderRadius: 8 },
            { label: 'Среднее', data: avgs, backgroundColor: '#ff00c8', borderRadius: 8 }
        ]},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: formatTime } } },
            plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatTime(c.parsed.y)}` } } }
        }
    });
}

function checkAchievements() {
    const list = document.getElementById('achievementsList');
    if (!list) return;
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

function save() {
    const id = tg?.initDataUnsafe?.user?.id || 'demo';
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
    const id = tg?.initDataUnsafe?.user?.id || 'demo';
    const saved = localStorage.getItem(`wimhof_${id}`);
    if (saved) {
        const d = JSON.parse(saved);
        state.rounds.total = d.rounds || 3;
        if (d.allTime) Object.assign(state.stats.allTime, d.allTime);
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
    el.phase.textContent = 'Выдохните и задержите дыхание';
    el.progress.style.width = '0%';
    el.timer.textContent = '00:00';
   
