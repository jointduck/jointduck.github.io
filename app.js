let tg = window.Telegram?.WebApp;
if (tg) tg.expand();

function haptic(type = 'light') {
    try { Telegram.WebApp.HapticFeedback.impactOccurred(type); } catch(e) {}
}
function successHaptic() {
    try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch(e) {}
}

const state = {
    phase: 'idle',           // idle, breathing, holding, recovery
    rounds: { current: 1, total: 3 },
    breathCount: 0,
    holdSeconds: 0,
    stats: {
        today: { sessions: 0, best: 0, times: [] },
        all: { sessions: 0, best: 0, streak: 0, lastDay: null }
    }
};

const el = {};
function $(id) { return document.getElementById(id); }
function uid() { return tg?.initDataUnsafe?.user?.id || 'demo'; }

function formatTime(s) {
    s = Math.max(0, Math.floor(s));
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

// === ХРАНИЛИЩЕ ===
function save() {
    const id = uid();
    const today = new Date().toDateString();
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    daily[today] = state.stats.today.times.slice();
    localStorage.setItem(`wimhof_daily_${id}`, JSON.stringify(daily));
    localStorage.setItem(`wimhof_main_${id}`, JSON.stringify({
        rounds: state.rounds.total,
        all: state.stats.all
    }));
}

function load() {
    const id = uid();
    const main = localStorage.getItem(`wimhof_main_${id}`);
    if (main) {
        const d = JSON.parse(main);
        state.rounds.total = d.rounds || 3;
        if (d.all) Object.assign(state.stats.all, d.all);
    }
    resetToday();
}

function resetToday() {
    const today = new Date().toDateString();
    if (state.stats.all.lastDay !== today) {
        state.stats.today = { sessions: 0, best: 0, times: [] };
    }
}

// === UI ===
function updateRounds() {
    $('roundsCount').textContent = state.rounds.total;
    $('currentRound').textContent = state.rounds.current;
    $('totalRounds').textContent = state.rounds.total;
}

function updateStats() {
    const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0;
    $('sessionsToday').textContent = state.stats.today.sessions;
    $('bestTimeToday').textContent = formatTime(state.stats.today.best);
    $('avgTimeToday').textContent = formatTime(avg(state.stats.today.times));
    $('totalSessions').textContent = state.stats.all.sessions;
    $('bestTimeAll').textContent = formatTime(state.stats.all.best);
    $('avgTimeAll').textContent = formatTime(avg(state.stats.all.times));
    $('streakDays').textContent = state.stats.all.streak || 0;
}

function updateChart() {
    const id = uid();
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    const labels = [], bests = [], avgs = [];
    const today = new Date();
    for (let i = 9; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toDateString();
        const times = daily[key] || [];
        labels.push(d.toLocaleDateString('ru-RU', {day:'numeric', month:'short'}).replace('.', ''));
        bests.push(times.length ? Math.max(...times) : 0);
        avgs.push(times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : 0);
    }
    const ctx = $('dailyStatsChart');
    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Лучшее', data: bests, backgroundColor: '#00d4ff', borderRadius: 8 },
            { label: 'Среднее', data: avgs, backgroundColor: '#ff00c8', borderRadius: 8 }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: formatTime } } },
            plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatTime(c.parsed.y)}` } } }
        }
    });
}

function checkAchievements() {
    const list = $('achievementsList');
    list.innerHTML = '';
    const achs = [
        {t:'Первая сессия',i:'Trophy',c:()=>state.stats.all.sessions>=1},
        {t:'10 сессий',i:'Fire',c:()=>state.stats.all.sessions>=10},
        {t:'2 минуты',i:'Star',c:()=>state.stats.all.best>=120},
        {t:'3 минуты!',i:'Stopwatch',c:()=>state.stats.all.best>=180},
        {t:'Неделя подряд',i:'Running Man',c:()=>state.stats.all.streak>=7},
        {t:'Месяц практики',i:'Sparkles',c:()=>state.stats.all.sessions>=30}
    ];
    achs.forEach(a => {
        if (a.c()) list.innerHTML += `<div class="achievement"><div class="achievement-icon">${a.i}</div><div class="achievement-title">${a.t}</div></div>`;
    });
}

// === СЕССИЯ ===
function startSession() {
    if (state.phase !== 'idle') return;
    state.phase = 'breathing';
    state.rounds.current = 1;
    state.breathCount = 0;
    updateRounds();
    el.progress.style.width = '0%';
    haptic('medium');
    breathe();
}

function breathe() {
    if (state.phase !== 'breathing') return;
    state.breathCount++;
    if (state.breathCount > 30) { startHold(); return; }

    el.progress.style.width = (state.breathCount / 30 * 100) + '%';
    el.circle.className = 'breath-circle breathing-in';
    el.circleText.textContent = `Вдох ${state.breathCount}/30`;
    el.phase.textContent = 'Глубокий вдох через нос';

    setTimeout(() => {
        if (state.phase !== 'breathing') return;
        el.circle.className = 'breath-circle breathing-out';
        el.circleText.textContent = `Выдох ${state.breath locomotion}/30`;
        el.phase.textContent = 'Полный выдох через рот';
        setTimeout(breathe, 2000);
    }, 2000);
}

function startHold() {
    state.phase = 'holding';
    state.holdSeconds = 0;
    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Задержка';
    el.phase.textContent = 'Полный выдох → задержи дыхание\nНажми круг, когда не можешь больше';
    el.timer.textContent = '00:00';
    el.progress.style.width = '0%';
    state.holdInterval = setInterval(() => {
        state.holdSeconds++;
        el.timer.textContent = formatTime(state.holdSeconds);
    }, 1000);
}

function finishHold() {
    if (state.phase !== 'holding') return;
    clearInterval(state.holdInterval);
    const time = state.holdSeconds;

    // СТАТИСТИКА — ИДЕАЛЬНО
    state.stats.today.sessions++;
    state.stats.today.times.push(time);
    state.stats.today.best = Math.max(state.stats.today.best, time);
    state.stats.all.sessions++;
    const wasBest = state.stats.all.best;
    state.stats.all.best = Math.max(state.stats.all.best, time);

    const today = new Date().toDateString();
    if (state.stats.all.lastDay !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        state.stats.all.streak = (state.stats.all.lastDay === yesterday.toDateString()) ? state.stats.all.streak + 1 : 1;
        state.stats.all.lastDay = today;
    }

    save();
    updateStats();
    updateChart();
    checkAchievements();

    if (time > wasBest) {
        successHaptic();
        el.phase.textContent = `НОВЫЙ РЕКОРД: ${formatTime(time)}!`;
        setTimeout(recovery, 3000);
    } else {
        recovery();
    }
}

function recovery() {
    state.phase = 'recovery';
    el.circle.className = 'breath-circle breathing-in';
    el.circleText.textContent = 'ГЛУБОКИЙ ВДОХ';
    el.phase.textContent = 'Максимальный вдох → держи 15 сек';
    haptic('heavy');

    setTimeout(() => {
        let sec = 15;
        el.circle.className = 'breath-circle';
        el.circleText.textContent = 'Держи';
        el.timer.textContent = formatTime(sec);
        const int = setInterval(() => {
            sec--;
            el.timer.textContent = formatTime(sec);
            if (sec <= 0) { clearInterval(int); nextRound(); }
        }, 1000);
    }, 1500);
}

function nextRound() {
    if (state.rounds.current >= state.rounds.total) {
        endSession();
    } else {
        state.rounds.current++;
        state.breathCount = 0;
        updateRounds();
        state.phase = 'breathing';
        el.progress.style.width = '0%';
        setTimeout(breathe, 800);
    }
}

function endSession() {
    state.phase = 'idle';
    state.rounds.current = 0;
    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Начать';
    el.phase.textContent = 'Сессия завершена. Ты — бог.';
    el.timer.textContent = '00:00';
    el.progress.style.width = '0%';
    successHaptic();
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    el.circle = $('breathCircle');
    el.circleText = $('circleText');
    el.phase = $('phaseText');
    el.timer = $('timer');
    el.progress = $('progressBar');

    // КНОПКИ РАУНДОВ — РАБОТАЮТ ВСЕГДА
    $('decreaseRounds').onclick = () => {
        if (state.rounds.total > 1) {
            state.rounds.total--;
            updateRounds();
            save();
            haptic();
        }
    };
    $('increaseRounds').onclick = () => {
        if (state.rounds.total < 10) {
            state.rounds.total++;
            updateRounds();
            save();
            haptic();
        }
    };

    // КРУГ
    el.circle.onclick = () => {
        if (state.phase === 'idle') startSession();
        else if (state.phase === 'holding') finishHold();
    };

    // ВКЛАДКИ
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.stats-content').forEach(c => c.style.display = 'none');
            const target = 'stats' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
            $(target).style.display = 'block';
            if (tab.dataset.tab === 'allTime') updateChart();
        };
    });

    load();
    updateRounds();
    updateStats();
    updateChart();
    checkAchievements();
});
