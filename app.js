const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    console.log('Telegram WebApp version:', tg.version);
}

const userId = tg?.initDataUnsafe?.user?.id || 'local_user';

// === КЛЮЧИ ХРАНИЛИЩА ===
const KEY_SETTINGS = `wimhof_settings_${userId}`;
const KEY_DAILY = `wimhof_daily_${userId}`;
const KEY_AGGREGATE = `wimhof_${userId}`;

// === TELEGRAM CLOUDSTORAGE (синхронизация между устройствами) ===
// localStorage остаётся источником истины внутри сессии (синхронный),
// CloudStorage — фоновое зеркало для переноса данных между устройствами/переустановками.
function cloudAvailable() {
    return !!(tg && tg.CloudStorage && typeof tg.CloudStorage.setItem === 'function');
}
function cloudSet(key, value) {
    if (!cloudAvailable()) return;
    try { tg.CloudStorage.setItem(key, value, (err) => { if (err) console.warn('CloudStorage set:', key, err); }); }
    catch (e) { console.warn('CloudStorage set failed:', e); }
}
function cloudGetItems(keys) {
    return new Promise(resolve => {
        if (!cloudAvailable()) return resolve({});
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v || {}); } };
        try {
            tg.CloudStorage.getItems(keys, (err, values) => finish(err ? {} : values));
        } catch (e) { finish({}); }
        setTimeout(() => finish({}), 2500); // не блокируем запуск, если TG не ответил
    });
}
function persist(key, value) {
    localStorage.setItem(key, value);
    cloudSet(key, value);
}
async function hydrateFromCloud() {
    const keys = [KEY_SETTINGS, KEY_DAILY, KEY_AGGREGATE];
    const cloudValues = await cloudGetItems(keys);
    keys.forEach(k => {
        if (cloudValues[k]) localStorage.setItem(k, cloudValues[k]);
    });
}

// === НАСТРОЙКИ ===
// accentColor: null = следовать теме Telegram (авто), иначе — конкретный hex
const DEFAULT_SETTINGS = {
    breathsPerRound: 30,
    inhaleSec: 2,
    exhaleSec: 2,
    recoveryHoldSec: 15,
    accentColor: null
};
let settings = { ...DEFAULT_SETTINGS };
let pendingAccent = settings.accentColor;

function loadSettings() {
    try {
        const raw = localStorage.getItem(KEY_SETTINGS);
        if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { settings = { ...DEFAULT_SETTINGS }; }
    pendingAccent = settings.accentColor;
    applySettings();
}

function saveSettings() {
    persist(KEY_SETTINGS, JSON.stringify(settings));
}

function applySettings() {
    if (settings.accentColor) {
        document.documentElement.style.setProperty('--accent-color', settings.accentColor);
    } else {
        document.documentElement.style.removeProperty('--accent-color'); // авто-режим — берём из темы Telegram
    }
}

function getAccentHex() {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    return val || '#2481ff';
}
function accentToRgba(alpha) {
    let c = getAccentHex();
    let r, g, b;
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        const num = parseInt(hex, 16);
        r = (num >> 16) & 255; g = (num >> 8) & 255; b = num & 255;
    } else {
        const m = c.match(/\d+/g) || [36, 129, 255];
        [r, g, b] = m.map(Number);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function populateSettingsForm() {
    document.getElementById('setBreaths').value = settings.breathsPerRound;
    document.getElementById('valBreaths').textContent = settings.breathsPerRound;
    document.getElementById('setInhale').value = settings.inhaleSec;
    document.getElementById('valInhale').textContent = settings.inhaleSec.toFixed(1);
    document.getElementById('setExhale').value = settings.exhaleSec;
    document.getElementById('valExhale').textContent = settings.exhaleSec.toFixed(1);
    document.getElementById('setRecovery').value = settings.recoveryHoldSec;
    document.getElementById('valRecovery').textContent = settings.recoveryHoldSec;

    pendingAccent = settings.accentColor;
    document.getElementById('setCustomColor').value = settings.accentColor || getAccentHex();
    document.querySelectorAll('.swatch[data-color]').forEach(sw => {
        const isAuto = sw.dataset.color === 'auto';
        const selected = settings.accentColor
            ? (!isAuto && sw.dataset.color.toLowerCase() === settings.accentColor.toLowerCase())
            : isAuto;
        sw.classList.toggle('selected', selected);
    });
    document.getElementById('accentHint').textContent = settings.accentColor
        ? 'Свой цвет'
        : 'Следует теме Telegram';

    document.querySelectorAll('.styled-range').forEach(updateRangeFill);
}

function updateRangeFill(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value);
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', pct + '%');
}

// Живое обновление, если пользователь сменит тему Telegram прямо во время использования
tg?.onEvent?.('themeChanged', () => {
    if (!settings.accentColor) document.documentElement.style.removeProperty('--accent-color');
    updateChart();
});

// === ХАПТИКИ (работают на iOS и Android) ===
function haptic(type = 'light') {
    if (!tg?.HapticFeedback) return;
    try { tg.HapticFeedback.impactOccurred(type); } 
    catch { try { tg.HapticFeedback.notificationOccurred('success'); } catch {} }
}
function successHaptic() {
    if (!tg?.HapticFeedback) return;
    try { tg.HapticFeedback.notificationOccurred('success'); } catch {}
}

// === КОЛЬЦО-ПЕЙСЕР ВДОХА/ВЫДОХА ===
const RING_R = 47;
const RING_CIRC = 2 * Math.PI * RING_R;
function ringInit() {
    if (!el.ring) return;
    el.ring.style.strokeDasharray = RING_CIRC.toFixed(2);
    el.ring.style.transition = 'none';
    el.ring.style.strokeDashoffset = RING_CIRC.toFixed(2); // пусто
}
// fromFraction/toFraction: 0 = пусто, 1 = кольцо нарисовано полностью
function ringAnimate(fromFraction, toFraction, durationSec) {
    if (!el.ring) return;
    el.ring.style.transition = 'none';
    el.ring.style.strokeDashoffset = (RING_CIRC * (1 - fromFraction)).toFixed(2);
    void el.ring.getBoundingClientRect(); // форсируем reflow перед анимацией
    requestAnimationFrame(() => {
        el.ring.style.transition = `stroke-dashoffset ${durationSec}s linear`;
        el.ring.style.strokeDashoffset = (RING_CIRC * (1 - toFraction)).toFixed(2);
    });
}

// === СОСТОЯНИЕ ===
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
    stage: document.getElementById('breathStage'),
    ring: document.getElementById('ringProgress'),
    circleText: document.getElementById('circleText'),
    phase: document.getElementById('phaseText'),
    timer: document.getElementById('timer'),
    progress: document.getElementById('progressBar'),
    roundsCount: document.getElementById('roundsCount'),
    currentRound: document.getElementById('currentRound'),
    totalRounds: document.getElementById('totalRounds')
};
ringInit();

// === ЗАГРУЗКА ===
document.addEventListener('DOMContentLoaded', async () => {
    // Кнопки раундов — работают
    document.getElementById('decreaseRounds').addEventListener('click', () => {
        if (state.rounds.total > 1) { state.rounds.total--; updateRounds(); save(); haptic(); }
    });
    document.getElementById('increaseRounds').addEventListener('click', () => {
        if (state.rounds.total < 10) { state.rounds.total++; updateRounds(); save(); haptic(); }
    });

    // Главный круг
    el.circle.addEventListener('click', () => {
        if (state.currentPhase === 'idle') startSession();
        else if (state.currentPhase === 'holding' || state.currentPhase === 'finalHold') finishHold();
    });

    // Вкладки статистики — чистые
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('statsToday').style.display = 'none';
            document.getElementById('statsAlltime').style.display = 'none';
            if (tab.dataset.tab === 'today') {
                document.getElementById('statsToday').style.display = 'block';
            } else {
                document.getElementById('statsAlltime').style.display = 'block';
                updateChart();
            }
        });
    });

    // Стартовая вкладка
    document.querySelector('.stats-tab[data-tab="today"]').classList.add('active');
    document.getElementById('statsToday').style.display = 'block';
    document.getElementById('statsAlltime').style.display = 'none';

    await hydrateFromCloud(); // подтягиваем данные из Telegram CloudStorage, если есть
    loadData();
    loadSettings();
    resetTodayIfNewDay();
    updateAllDisplays();
    setupSettingsUI();
});

// === НАСТРОЙКИ: UI ===
function setupSettingsUI() {
    const overlay = document.getElementById('settingsOverlay');
    const openBtn = document.getElementById('settingsBtn');
    const closeBtn = document.getElementById('closeSettings');
    const saveBtn = document.getElementById('saveSettings');
    const resetBtn = document.getElementById('resetSettings');

    const breathsInput = document.getElementById('setBreaths');
    const inhaleInput = document.getElementById('setInhale');
    const exhaleInput = document.getElementById('setExhale');
    const recoveryInput = document.getElementById('setRecovery');
    const customColorInput = document.getElementById('setCustomColor');

    openBtn.addEventListener('click', () => {
        if (state.currentPhase !== 'idle') return; // не даём менять настройки во время сессии
        populateSettingsForm();
        overlay.classList.add('open');
        haptic();
    });
    closeBtn.addEventListener('click', () => { applySettings(); overlay.classList.remove('open'); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { applySettings(); overlay.classList.remove('open'); } });

    breathsInput.addEventListener('input', () => {
        document.getElementById('valBreaths').textContent = breathsInput.value;
        updateRangeFill(breathsInput);
    });
    inhaleInput.addEventListener('input', () => {
        document.getElementById('valInhale').textContent = parseFloat(inhaleInput.value).toFixed(1);
        updateRangeFill(inhaleInput);
    });
    exhaleInput.addEventListener('input', () => {
        document.getElementById('valExhale').textContent = parseFloat(exhaleInput.value).toFixed(1);
        updateRangeFill(exhaleInput);
    });
    recoveryInput.addEventListener('input', () => {
        document.getElementById('valRecovery').textContent = recoveryInput.value;
        updateRangeFill(recoveryInput);
    });

    document.querySelectorAll('.swatch[data-color]').forEach(sw => {
        sw.addEventListener('click', () => {
            const color = sw.dataset.color;
            document.querySelectorAll('.swatch[data-color]').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            if (color === 'auto') {
                pendingAccent = null;
                document.documentElement.style.removeProperty('--accent-color');
                document.getElementById('accentHint').textContent = 'Следует теме Telegram';
            } else {
                pendingAccent = color;
                customColorInput.value = color;
                document.documentElement.style.setProperty('--accent-color', color);
                document.getElementById('accentHint').textContent = 'Свой цвет';
            }
            haptic();
        });
    });
    customColorInput.addEventListener('input', () => {
        document.querySelectorAll('.swatch[data-color]').forEach(s => s.classList.remove('selected'));
        pendingAccent = customColorInput.value;
        document.documentElement.style.setProperty('--accent-color', customColorInput.value);
        document.getElementById('accentHint').textContent = 'Свой цвет';
    });

    saveBtn.addEventListener('click', () => {
        settings.breathsPerRound = parseInt(breathsInput.value, 10);
        settings.inhaleSec = parseFloat(inhaleInput.value);
        settings.exhaleSec = parseFloat(exhaleInput.value);
        settings.recoveryHoldSec = parseInt(recoveryInput.value, 10);
        settings.accentColor = pendingAccent;
        applySettings();
        saveSettings();
        updateChart();
        overlay.classList.remove('open');
        successHaptic();
    });

    resetBtn.addEventListener('click', () => {
        settings = { ...DEFAULT_SETTINGS };
        applySettings();
        populateSettingsForm();
        haptic();
    });
}

// === ОСНОВНОЙ ЦИКЛ ===
function startSession() {
    state.rounds.current++;
    state.rounds.breathCount = 0;
    state.currentPhase = 'breathing';
    updateRounds();
    startBreathingCycle();
    haptic('heavy');
    try { tg?.enableClosingConfirmation(); } catch {} // не даём случайно закрыть во время сессии
}

function startBreathingCycle() {
    const total = settings.breathsPerRound;
    const inhaleMs = settings.inhaleSec * 1000;
    const exhaleMs = settings.exhaleSec * 1000;

    if (state.rounds.breathCount >= total) { startHold(); return; }
    state.rounds.breathCount++;
    el.progress.style.width = (state.rounds.breathCount / total * 100) + '%';

    el.stage.classList.add('show-ring');
    el.circle.className = 'breath-circle breathing-in';
    el.circle.style.animationDuration = settings.inhaleSec + 's';
    el.circleText.textContent = `Вдох ${state.rounds.breathCount}/${total}`;
    el.phase.textContent = 'Глубокий вдох через нос';
    ringAnimate(0, 1, settings.inhaleSec);

    setTimeout(() => {
        if (state.currentPhase !== 'breathing') return;
        el.circle.className = 'breath-circle breathing-out';
        el.circle.style.animationDuration = settings.exhaleSec + 's';
        el.circleText.textContent = `Выдох ${state.rounds.breathCount}/${total}`;
        el.phase.textContent = 'Спокойный выдох через рот';
        ringAnimate(1, 0, settings.exhaleSec);
        setTimeout(() => { if (state.currentPhase === 'breathing') startBreathingCycle(); }, exhaleMs);
    }, inhaleMs);
}

function startHold() {
    state.currentPhase = state.rounds.current < state.rounds.total ? 'holding' : 'finalHold';
    el.stage.classList.remove('show-ring'); // задержка — без фиксированной длительности, кольцо не показываем
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

    // Статистика
    state.stats.today.sessions++;
    state.stats.today.times.push(holdTime);
    state.stats.today.bestTime = Math.max(state.stats.today.bestTime, holdTime);
    state.stats.allTime.sessions++;
    state.stats.allTime.times.push(holdTime);
    state.stats.allTime.bestTime = Math.max(state.stats.allTime.bestTime, holdTime);

    // Стрик
    const todayStr = new Date().toDateString();
    if (state.stats.allTime.lastPractice !== todayStr) {
        const daysDiff = state.stats.allTime.lastPractice
            ? Math.floor((new Date(todayStr) - new Date(state.stats.allTime.lastPractice)) / 86400000)
            : 999;
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
    el.stage.classList.add('show-ring');

    // === 1. Глубокий вдох ===
    el.phase.textContent = 'Глубокий вдох';
    el.circle.className = 'breath-circle breathing-in';
    el.circle.style.animationDuration = settings.inhaleSec + 's';
    ringAnimate(0, 1, settings.inhaleSec);
    let breathIn = Math.max(1, Math.round(settings.inhaleSec));
    el.timer.textContent = formatTime(breathIn);

    const breathInInterval = setInterval(() => {
        breathIn--;
        el.timer.textContent = formatTime(breathIn);
        if (breathIn <= 0) {
            clearInterval(breathInInterval);
            haptic();

            // === 2. Задержка на восстановлении ===
            el.phase.textContent = `Задержите на ${settings.recoveryHoldSec} сек`;
            el.circle.className = 'breath-circle';
            el.circle.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            ringAnimate(1, 0, settings.recoveryHoldSec);
            let hold = settings.recoveryHoldSec;
            el.timer.textContent = formatTime(hold);

            const holdInterval = setInterval(() => {
                hold--;
                el.timer.textContent = formatTime(hold);
                if (hold <= 0) {
                    clearInterval(holdInterval);
                    haptic();

                    // === 3. Медленный выдох ===
                    el.phase.textContent = 'Медленный выдох';
                    el.circle.className = 'breath-circle breathing-out';
                    el.circle.style.animationDuration = settings.exhaleSec + 's';
                    ringAnimate(1, 0, settings.exhaleSec);
                    let breathOut = Math.max(1, Math.round(settings.exhaleSec));
                    el.timer.textContent = formatTime(breathOut);

                    const breathOutInterval = setInterval(() => {
                        breathOut--;
                        el.timer.textContent = formatTime(breathOut);
                        if (breathOut <= 0) {
                            clearInterval(breathOutInterval);
                            haptic();

                            // Возврат в исходное состояние
                            el.stage.classList.remove('show-ring');
                            el.circle.className = 'breath-circle';
                            el.circle.style.background = '';
                            el.circle.style.animationDuration = '';
                            el.timer.textContent = '00:00';
                            next();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
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
    el.stage.classList.remove('show-ring');
    el.circle.className = 'breath-circle';
    el.circleText.textContent = 'Начать';
    el.phase.textContent = 'Сессия завершена! Отличная работа';
    el.timer.textContent = '00:00';
    el.progress.style.width = '0%';
    updateRounds();
    successHaptic();
    try { tg?.disableClosingConfirmation(); } catch {}
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
    const raw = localStorage.getItem(KEY_DAILY);
    if (!raw) {
        document.querySelector('.chart-container').style.display = 'none';
        return;
    }

    const daily = JSON.parse(raw);

    // Правильная сортировка дат (строки вида "Mon Dec 04 2025 ..." → Date → сортировка)
    const sortedDates = Object.keys(daily)
        .map(d => ({ str: d, date: new Date(d) }))           // превращаем в объекты
        .sort((a, b) => a.date - b.date)                    // хронологически
        .map(obj => obj.str)                                // обратно в строки
        .slice(-10);                                        // последние 10 дней

    if (sortedDates.length === 0) {
        document.querySelector('.chart-container').style.display = 'none';
        return;
    }

    // Показываем график
    document.querySelector('.chart-container').style.display = 'block';

    const bests = sortedDates.map(d => Math.max(...(daily[d] || [0])));
    const avgs = sortedDates.map(d => {
        const t = daily[d] || [];
        return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : 0;
    });

    const labels = sortedDates.map(d =>
        new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    );

    const canvas = document.getElementById('dailyStatsChart');
    if (!canvas) return;

    if (window.myChart) window.myChart.destroy();

    // Один и тот же акцентный цвет, но с разной насыщенностью —
    // палитра всегда сочетается с темой/кастомным цветом, а столбцы легко различимы
    const bestColor = accentToRgba(0.95);
    const avgColor = accentToRgba(0.35);

    window.myChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Лучшее',  data: bests, backgroundColor: bestColor, borderRadius: 4 },
                { label: 'Среднее', data: avgs,  backgroundColor: avgColor, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}
// === ИКОНКИ ДОСТИЖЕНИЙ (SVG, line-style) ===
const ACH_ICONS = {
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path><path d="M7 5H4a2 2 0 0 0 0 4h1.6"></path><path d="M17 5h3a2 2 0 0 1 0 4h-1.6"></path><path d="M12 14v4"></path><path d="M8 21h8"></path><path d="M10 18h4"></path></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3-2 4.2-2 7.2a4 4 0 0 0 8 0c0-1.2-.5-2.1-1-2.9 1.1 1 3 3.1 3 6.1a6 6 0 0 1-12 0c0-4.3 2.2-6.6 4-10.4z"></path></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5-5.9-3.3-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7z"></path></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="8"></circle><path d="M12 13.5V9"></path><path d="M9.5 2.5h5"></path><path d="M16.5 4.5l1.6-1.6"></path></svg>',
    streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"></rect><path d="M16 2.5v4"></path><path d="M8 2.5v4"></path><path d="M3.5 10h17"></path><path d="M9 15l2 2 4-4.5"></path></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.2 2.5l1.5 4.6 4.6 1.5-4.6 1.5-1.5 4.6-1.5-4.6-4.6-1.5 4.6-1.5z"></path><path d="M18.5 13.5l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9z"></path></svg>'
};

function checkAchievements() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';
    const achs = [
        { title: 'Первая сессия', icon: ACH_ICONS.trophy, cond: () => state.stats.allTime.sessions >= 1 },
        { title: '10 сессий', icon: ACH_ICONS.flame, cond: () => state.stats.allTime.sessions >= 10 },
        { title: '2 минуты', icon: ACH_ICONS.star, cond: () => state.stats.allTime.bestTime >= 120 },
        { title: '3 минуты!', icon: ACH_ICONS.timer, cond: () => state.stats.allTime.bestTime >= 180 },
        { title: 'Неделя подряд', icon: ACH_ICONS.streak, cond: () => state.stats.allTime.streak >= 7 },
        { title: 'Месяц практики', icon: ACH_ICONS.sparkles, cond: () => state.stats.allTime.sessions >=30},
    ];
    achs.forEach(a => {
        if (a.cond()) list.innerHTML += `<div class="achievement"><div class="achievement-icon">${a.icon}</div><div class="achievement-title">${a.title}</div></div>`;
    });
}

function save() {
    const today = new Date().toDateString();
    let daily = JSON.parse(localStorage.getItem(KEY_DAILY) || '{}');
    daily[today] = state.stats.today.times.slice();

    // Храним не больше 60 последних дней — этого достаточно для графика
    // и держит запись в пределах лимита Telegram CloudStorage (4096 символов на ключ)
    const dates = Object.keys(daily).sort((a, b) => new Date(a) - new Date(b));
    if (dates.length > 60) dates.slice(0, dates.length - 60).forEach(d => delete daily[d]);

    persist(KEY_DAILY, JSON.stringify(daily));
    persist(KEY_AGGREGATE, JSON.stringify({
        rounds: state.rounds.total,
        allTime: state.stats.allTime
    }));
}

function loadData() {
    const saved = localStorage.getItem(KEY_AGGREGATE);
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
