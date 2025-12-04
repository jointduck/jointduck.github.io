
/*
  Full working app.js for Wim Hof mini-app
  Features:
  - Rounds control (+/-)
  - Breathing cycle: 30 breaths (2s inhale, 2s exhale)
  - Hold phase after breaths: user clicks circle to end hold
  - Recovery breath (short pause)
  - Session timing and stats (today / all-time)
  - LocalStorage persistence per Telegram user (or 'demo')
  - Chart.js integration for last 10 days
  - Achievements based on sessions, streak, best time
  - Telegram WebApp haptic support if available
*/

let tg = window.Telegram?.WebApp;
if (tg && tg.expand) try { tg.expand(); } catch(e){}

function haptic(type = 'light') {
    try { if (Telegram.WebApp?.HapticFeedback?.impactOccurred) Telegram.WebApp.HapticFeedback.impactOccurred(type); } catch (e) {}
}
function successHaptic() {
    try { if (Telegram.WebApp?.HapticFeedback?.notificationOccurred) Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch (e) {}
}

const state = {
    currentPhase: 'idle', // idle | breathing | holding | recovery | finished
    rounds: { current: 0, total: 3, breathCount: 0 },
    timer: { startTime: null, interval: null, holdInterval: null },
    stats: {
        today: { sessions: 0, bestTime: 0, times: [] },
        allTime: { sessions: 0, bestTime: 0, times: [], streak: 0, lastPractice: null }
    },
    ui: {}
};

function $(id){ return document.getElementById(id); }

function getUserId() {
    return tg?.initDataUnsafe?.user?.id?.toString() || 'demo';
}

function formatTime(sec) {
    // produce mm:ss, calculate digit-by-digit to avoid mistakes
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mm = m.toString().padStart(2,'0');
    const ss = s.toString().padStart(2,'0');
    return `${mm}:${ss}`;
}

function loadElements() {
    state.ui.circle = $('breathCircle');
    state.ui.circleText = $('circleText');
    state.ui.phase = $('phaseText');
    state.ui.timer = $('timer');
    state.ui.progress = $('progressBar');
    state.ui.roundsCount = $('roundsCount');
    state.ui.currentRound = $('currentRound');
    state.ui.totalRounds = $('totalRounds');
    state.ui.decrease = $('decreaseRounds');
    state.ui.increase = $('increaseRounds');
    state.ui.statsTabs = Array.from(document.querySelectorAll('.stats-tab'));
    state.ui.achievementsList = $('achievementsList');
}

function saveToLocal() {
    const id = getUserId();
    const payload = {
        rounds: state.rounds.total,
        allTime: state.stats.allTime
    };
    localStorage.setItem(`wimhof_${id}`, JSON.stringify(payload));
    // daily
    const today = new Date().toDateString();
    const dailyKey = `wimhof_daily_${id}`;
    const daily = JSON.parse(localStorage.getItem(dailyKey) || "{}");
    daily[today] = state.stats.today.times.slice();
    localStorage.setItem(dailyKey, JSON.stringify(daily));
}

function loadFromLocal() {
    const id = getUserId();
    const saved = localStorage.getItem(`wimhof_${id}`);
    if (saved) {
        try {
            const d = JSON.parse(saved);
            if (d.rounds) state.rounds.total = d.rounds;
            if (d.allTime) state.stats.allTime = Object.assign(state.stats.allTime, d.allTime);
        } catch(e){}
    }
    resetTodayIfNewDay();
}

function resetTodayIfNewDay() {
    const today = new Date().toDateString();
    if (state.stats.allTime.lastPractice !== today) {
        state.stats.today = { sessions: 0, bestTime: 0, times: [] };
    }
}

function updateRoundsUI() {
    state.ui.roundsCount.textContent = state.rounds.total;
    state.ui.currentRound.textContent = state.rounds.current || 0;
    state.ui.totalRounds.textContent = state.rounds.total;
}

function avg(arr) {
    if (!arr || !arr.length) return 0;
    const sum = arr.reduce((a,b)=>a+b,0);
    return Math.round(sum / arr.length);
}

function updateStatsUI() {
    $('sessionsToday').textContent = state.stats.today.sessions || 0;
    $('bestTimeToday').textContent = formatTime(state.stats.today.bestTime || 0);
    $('avgTimeToday').textContent = formatTime(avg(state.stats.today.times));
    $('totalSessions').textContent = state.stats.allTime.sessions || 0;
    $('bestTimeAll').textContent = formatTime(state.stats.allTime.bestTime || 0);
    $('avgTimeAll').textContent = formatTime(avg(state.stats.allTime.times));
    $('streakDays').textContent = state.stats.allTime.streak || 0;
}

let chartInstance = null;
function updateChart() {
    const id = getUserId();
    const daily = JSON.parse(localStorage.getItem(`wimhof_daily_${id}`) || '{}');
    const today = new Date();
    const labels = [], dates = [];
    for (let i = 9; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toDateString());
        labels.push(d.toLocaleDateString('ru-RU', {day:'numeric', month:'short'}).replace('.', ''));
    }
    const bests = dates.map(d => {
        const arr = daily[d] || [];
        return arr.length ? Math.max(...arr) : 0;
    });
    const avgs = dates.map(d => {
        const arr = daily[d] || [];
        if (!arr.length) return 0;
        const s = arr.reduce((a,b)=>a+b,0);
        return Math.round(s / arr.length);
    });
    const canvas = $('dailyStatsChart');
    if (!canvas) return;
    canvas.style.display = 'block';
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Лучшее', data: bests, backgroundColor: '#00d4ff', borderRadius: 8 },
                { label: 'Среднее', data: avgs, backgroundColor: '#ff00c8', borderRadius: 8 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: function(v){ return formatTime(v); } } } },
            plugins: { tooltip: { callbacks: { label: function(c){ return `${c.dataset.label}: ${formatTime(c.parsed.y)}`; } } } }
        }
    });
}

function checkAchievements() {
    const list = state.ui.achievementsList;
    list.innerHTML = '';
    const achs = [
        { title: 'Первая сессия', icon: '🏆', cond: () => state.stats.allTime.sessions >= 1 },
        { title: '10 сессий', icon: '🔥', cond: () => state.stats.allTime.sessions >= 10 },
        { title: '2 минуты', icon: '⭐', cond: () => state.stats.allTime.bestTime >= 120 },
        { title: '3 минуты!', icon: '⏱️', cond: () => state.stats.allTime.bestTime >= 180 },
        { title: 'Неделя подряд', icon: '🏃', cond: () => state.stats.allTime.streak >= 7 },
        { title: 'Месяц практики', icon: '✨', cond: () => state.stats.allTime.sessions >= 30 }
    ];
    achs.forEach(a => {
        if (a.cond()) {
            const div = document.createElement('div');
            div.className = 'achievement';
            div.innerHTML = `<div class="achievement-icon">${a.icon}</div><div class="achievement-title">${a.title}</div>`;
            list.appendChild(div);
        }
    });
}

function updateAllUI() {
    resetTodayIfNewDay();
    updateRoundsUI();
    updateStatsUI();
    updateChart();
    checkAchievements();
}

// --- Session flow ---
function startSession() {
    if (state.currentPhase !== 'idle' && state.currentPhase !== 'finished') return;
    state.rounds.current = 1;
    state.rounds.breathCount = 0;
    state.currentPhase = 'breathing';
    state.timer.startTime = Date.now();
    updateRoundsUI();
    haptic('medium');
    startBreathingCycle();
}

function startBreathingCycle() {
    // 30 cycles of inhale+exhale, each step uses 2000ms for inhale and 2000ms for exhale => 4s per breath round
    const target = 30;
    const inhaleMs = 2000;
    const exhaleMs = 2000;
    state.rounds.breathCount++;
    const progress = Math.min(100, (state.rounds.breathCount / target) * 100);
    state.ui.progress.style.width = progress + '%';
    state.ui.circle.className = 'breath-circle breathing-in';
    state.ui.circleText.textContent = `Вдох ${state.rounds.breathCount}/${target}`;
    state.ui.phase.textContent = 'Глубокий вдох через нос';
    // inhale -> exhale -> next
    state.timer.interval = setTimeout(() => {
        if (state.currentPhase !== 'breathing') return;
        state.ui.circle.className = 'breath-circle breathing-out';
        state.ui.circleText.textContent = `Выдох ${state.rounds.breathCount}/${target}`;
        state.ui.phase.textContent = 'Спокойный выдох через рот';
        state.timer.interval = setTimeout(() => {
            if (state.currentPhase !== 'breathing') return;
            if (state.rounds.breathCount < target) {
                startBreathingCycle();
            } else {
                // breaths finished -> start hold
                startHold();
            }
        }, exhaleMs);
    }, inhaleMs);
}

function startHold() {
    state.currentPhase = (state.rounds.current < state.rounds.total) ? 'holding' : 'finalHold';
    state.ui.circle.className = 'breath-circle';
    state.ui.circleText.textContent = 'Задержка';
    state.ui.phase.textContent = 'Выдохните и задержите дыхание. Нажмите круг, чтобы закончить задержку.';
    state.ui.progress.style.width = '0%';
    // start hold timer
    let seconds = 0;
    state.ui.timer.textContent = formatTime(seconds);
    state.timer.holdInterval = setInterval(() => {
        seconds++;
        state.ui.timer.textContent = formatTime(seconds);
    }, 1000);
    // allow user to click circle to end hold
    // we'll record hold seconds as part of session 'time'
    state._currentHoldSeconds = 0;
    state._holdStart = Date.now();
}

function endHoldAndRecovery() {
    // stop hold timer
    if (state.timer.holdInterval) {
        clearInterval(state.timer.holdInterval);
        state.timer.holdInterval = null;
    }
    const holdSeconds = Math.round((Date.now() - state._holdStart) / 1000);
    state._currentHoldSeconds = holdSeconds;
    // quick recovery breath phase
    state.currentPhase = 'recovery';
    state.ui.phase.textContent = 'Сделайте глубокий вдох и расслабьтесь (восстановление)';
    state.ui.circle.className = 'breath-circle breathing-in';
    state.ui.circleText.textContent = 'Вдох восстановления';
    // short pause for recovery
    setTimeout(() => {
        // finalize round
        finalizeRound();
    }, 3000);
}

function finalizeRound() {
    // increment stats for this round/session if last round or continue
    // If finalHold then session ends, otherwise go to next round
    if (state.rounds.current >= state.rounds.total) {
        finishSession();
    } else {
        // move to next round
        state.rounds.current++;
        state.rounds.breathCount = 0;
        state.currentPhase = 'breathing';
        updateRoundsUI();
        setTimeout(() => startBreathingCycle(), 800);
    }
}

function finishSession() {
    // stop any intervals
    if (state.timer.interval) { clearTimeout(state.timer.interval); state.timer.interval = null; }
    if (state.timer.holdInterval) { clearInterval(state.timer.holdInterval); state.timer.holdInterval = null; }
    state.currentPhase = 'finished';
    state.ui.circle.className = 'breath-circle';
    state.ui.circleText.textContent = 'Готово';
    state.ui.phase.textContent = 'Сессия завершена';
    const sessionSeconds = Math.round((Date.now() - state.timer.startTime) / 1000);
    // update stats
    state.stats.today.sessions = (state.stats.today.sessions || 0) + 1;
    state.stats.today.times.push(sessionSeconds);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime || 0, sessionSeconds);
    state.stats.allTime.sessions = (state.stats.allTime.sessions || 0) + 1;
    state.stats.allTime.times.push(sessionSeconds);
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime || 0, sessionSeconds);
    // streak logic
    const today = new Date().toDateString();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const ystr = yesterday.toDateString();
    if (state.stats.allTime.lastPractice === ystr) {
        state.stats.allTime.streak = (state.stats.allTime.streak || 0) + 1;
    } else if (state.stats.allTime.lastPractice === today) {
        // same day, don't change
    } else {
        // new day and not consecutive
        state.stats.allTime.streak = 1;
    }
    state.stats.allTime.lastPractice = today;
    saveToLocal();
    updateAllUI();
    successHaptic();
}

function stopSessionAbrupt() {
    // used to cancel session mid-way
    if (state.timer.interval) { clearTimeout(state.timer.interval); state.timer.interval = null; }
    if (state.timer.holdInterval) { clearInterval(state.timer.holdInterval); state.timer.holdInterval = null; }
    state.currentPhase = 'idle';
    state.ui.circle.className = 'breath-circle';
    state.ui.circleText.textContent = 'Начать';
    state.ui.phase.textContent = 'Сессия прервана';
    state.rounds.current = 0;
    state.rounds.breathCount = 0;
    updateRoundsUI();
}

// --- UI interactions ---
function bindUI() {
    // rounds
    state.ui.decrease.addEventListener('click', () => {
        if (state.rounds.total > 1) state.rounds.total--;
        updateRoundsUI();
        saveToLocal();
    });
    state.ui.increase.addEventListener('click', () => {
        if (state.rounds.total < 10) state.rounds.total++;
        updateRoundsUI();
        saveToLocal();
    });
    // circle click
    state.ui.circle.addEventListener('click', () => {
        if (state.currentPhase === 'idle' || state.currentPhase === 'finished') {
            startSession();
        } else if (state.currentPhase === 'breathing') {
            // allow abort
            stopSessionAbrupt();
        } else if (state.currentPhase === 'holding' || state.currentPhase === 'finalHold') {
            endHoldAndRecovery();
        } else if (state.currentPhase === 'recovery') {
            // do nothing
        }
    });
    // tabs
    state.ui.statsTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            state.ui.statsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            if (target === 'today') {
                $('statsToday').style.display = 'block';
                $('statsAlltime').style.display = 'none';
            } else {
                $('statsToday').style.display = 'none';
                $('statsAlltime').style.display = 'block';
                updateChart();
            }
        });
    });
}

// initialization
function init() {
    loadElements();
    loadFromLocal();
    bindUI();
    updateAllUI();
    // handle visibility change to pause timers if needed
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.timer.holdInterval) {
            // keep going but no change; could optionally pause
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
