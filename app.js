let tg = window.Telegram.WebApp;
tg.expand();

const breathCircle = document.getElementById('breathCircle');
const circleText = document.getElementById('circleText');
const phaseText = document.getElementById('phaseText');
const timer = document.getElementById('timer');
const progressBar = document.getElementById('progressBar');

let isBreathing = false;
let currentPhase = 'idle';
let breathCount = 0;
let holdTime = 0;
let timerInterval;

const BREATH_CYCLES = 30;
const BREATH_IN_TIME = 2; // 2 секунды на вдох
const BREATH_OUT_TIME = 2; // 2 секунды на выдох

breathCircle.addEventListener('click', startBreathing);

function startBreathing() {
    if (currentPhase === 'idle') {
        isBreathing = true;
        breathCount = 0;
        currentPhase = 'breathing';
        startBreathCycle();
    }
}

function startBreathCycle() {
    breathCount++;
    if (breathCount <= BREATH_CYCLES) {
        // Фаза вдоха
        breathCircle.classList.add('breathing-in');
        breathCircle.classList.remove('breathing-out');
        circleText.textContent = `Вдох ${breathCount}/${BREATH_CYCLES}`;
        phaseText.textContent = 'Глубокий вдох через нос';
        
        setTimeout(() => {
            if (isBreathing) {
                // Фаза выдоха
                breathCircle.classList.remove('breathing-in');
                breathCircle.classList.add('breathing-out');
                circleText.textContent = `Выдох ${breathCount}/${BREATH_CYCLES}`;
                phaseText.textContent = 'Спокойный выдох через рот';
                
                setTimeout(() => {
                    if (isBreathing) {
                        startBreathCycle();
                    }
                }, BREATH_OUT_TIME * 1000);
            }
        }, BREATH_IN_TIME * 1000);

        progressBar.style.width = `${(breathCount/BREATH_CYCLES) * 100}%`;
    } else {
        startHoldingPhase();
    }
}

// ... [остальной код остается без изменений] ...

function startHoldingPhase() {
    breathCircle.classList.remove('breathing');
    currentPhase = 'holding';
    circleText.textContent = 'Задержка';
    phaseText.textContent = 'Выдохните и задержите дыхание';
    
    holdTime = 0;
    timerInterval = setInterval(() => {
        holdTime++;
        timer.textContent = formatTime(holdTime);
    }, 1000);
    
    breathCircle.addEventListener('click', finishHoldingPhase);
}

function finishHoldingPhase() {
    if (currentPhase === 'holding') {
        clearInterval(timerInterval);
        breathCircle.removeEventListener('click', finishHoldingPhase);
        
        // Сохраняем результат
        const bestTimeStr = localStorage.getItem('bestTime') || '0';
        const bestTime = parseInt(bestTimeStr);
        if (holdTime > bestTime) {
            localStorage.setItem('bestTime', holdTime.toString());
            document.getElementById('bestTime').textContent = formatTime(holdTime);
        }
        
        // Увеличиваем количество сессий
        const sessionsToday = parseInt(localStorage.getItem('sessionsToday') || '0') + 1;
        localStorage.setItem('sessionsToday', sessionsToday.toString());
        document.getElementById('sessionsToday').textContent = sessionsToday;
        
        startRecoveryPhase();
    }
}

function startRecoveryPhase() {
    currentPhase = 'recovery';
    circleText.textContent = 'Восстановление';
    phaseText.textContent = 'Сделайте глубокий вдох и задержите на 15 секунд';
    
    let recoveryTime = 15;
    timer.textContent = formatTime(recoveryTime);
    
    const recoveryInterval = setInterval(() => {
        recoveryTime--;
        timer.textContent = formatTime(recoveryTime);
        
        if (recoveryTime <= 0) {
            clearInterval(recoveryInterval);
            resetExercise();
        }
    }, 1000);
}

function resetExercise() {
    isBreathing = false;
    currentPhase = 'idle';
    breathCount = 0;
    circleText.textContent = 'Начать';
    phaseText.textContent = 'Нажмите на круг, чтобы начать';
    timer.textContent = '00:00';
    progressBar.style.width = '0%';
    breathCircle.classList.remove('breathing');
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Инициализация статистики
document.addEventListener('DOMContentLoaded', () => {
    const bestTime = localStorage.getItem('bestTime') || '0';
    document.getElementById('bestTime').textContent = formatTime(parseInt(bestTime));
    
    const sessionsToday = localStorage.getItem('sessionsToday') || '0';
    document.getElementById('sessionsToday').textContent = sessionsToday;
});