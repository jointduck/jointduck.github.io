// Improved Wim Hof Method Logic

class WimHofMethod {
    constructor() {
        this.breathCount = 0;
        this.holdingPhase = false;
        this.recoveryPhase = false;
    }

    startBreathing() {
        console.log('Starting breath sequence...');
        this.breathe();
    }

    breathe() {
        const breathCycles = 30;
        for (let i = 0; i < breathCycles; i++) {
            setTimeout(() => {
                this.breathCount++;
                console.log(`Breath ${this.breathCount}: Inhale deeply...`);
                setTimeout(() => {
                    console.log('Exhale fully...');
                    if (this.breathCount === breathCycles) {
                        this.startHoldingPhase();
                    }
                }, 3000); // Wait for 3 seconds before exhaling
            }, i * 6000); // 6 seconds for inhale and exhale cycle
        }
    }

    startHoldingPhase() {
        this.holdingPhase = true;
        console.log('Holding breath...');
        setTimeout(() => {
            this.holdingPhase = false;
            this.startRecoveryPhase();
        }, 30 * 1000); // Hold for 30 seconds
    }

    startRecoveryPhase() {
        this.recoveryPhase = true;
        console.log('Entering recovery phase...');
        setTimeout(() => {
            this.recoveryPhase = false;
            console.log('Recovery complete.');
            this.resetBreathCount();
        }, 15 * 1000); // Recovery for 15 seconds
    }

    resetBreathCount() {
        this.breathCount = 0;
        console.log('Breath count reset.');
    }
}

const wimHof = new WimHofMethod();
wimHof.startBreathing();
