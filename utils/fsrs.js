/**
 * FSRS (Free Spaced Repetition Scheduler) v4
 * Implementação matemática do algoritmo de repetição espaçada moderno.
 * 
 * Baseado no open-source FSRS4Anki.
 */

export class FSRS {
    constructor() {
        // Pesos padrão do FSRS v4 otimizados para language learning
        this.w = [
            0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 
            1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 0.0
        ];
        this.requestRetention = 0.90; // 90% de retenção desejada
        this.decay = -0.5;
        this.factor = 19 / 81;
    }

    /**
     * Calcula o próximo estado do card baseado no FSRS.
     * @param {Object} card { difficulty: Number, stability: Number, reps: Number, lapses: Number }
     * @param {Number} rating 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
     * @returns {Object} Novo estado { difficulty, stability, interval }
     */
    nextState(card, rating) {
        let { difficulty = 0, stability = 0, reps = 0, lapses = 0 } = card;

        // Se for um card novo (sem estabilidade prévia)
        if (stability === 0) {
            stability = this.w[rating - 1]; // Inicializa S baseado no primeiro rating
            difficulty = this.w[4] - this.w[5] * (rating - 3);
            difficulty = Math.min(Math.max(difficulty, 1), 10);
            reps = 1;
        } else {
            // Card já existe em revisão
            const retrievability = Math.pow(1 + this.factor * card.interval / stability, this.decay);
            
            // Nova dificuldade
            let nextD = difficulty - this.w[6] * (rating - 3);
            nextD = this.w[7] * this.w[4] + (1 - this.w[7]) * nextD;
            difficulty = Math.min(Math.max(nextD, 1), 10);

            // Nova estabilidade
            let nextS;
            if (rating === 1) { // Lapsed (Again)
                nextS = this.w[11] * Math.pow(difficulty, -this.w[12]) * Math.pow(stability, this.w[13]) * Math.pow(Math.exp((1 - retrievability) * this.w[14]) - 1, 1);
                lapses += 1;
            } else { // Hard, Good, Easy
                let easeFactor = Math.exp(this.w[8]) * (11 - difficulty) * Math.pow(stability, -this.w[9]) * (Math.exp((1 - retrievability) * this.w[10]) - 1);
                if (rating === 2) easeFactor *= this.w[15]; // Penalidade para Hard
                if (rating === 4) easeFactor *= this.w[16]; // Bônus para Easy
                nextS = stability * (1 + easeFactor);
            }
            stability = nextS;
            reps += 1;
        }

        // Calcula o intervalo real (I) = 9 * S * (1/R - 1)
        const nextInterval = Math.round(9 * stability * (1 / this.requestRetention - 1));

        return {
            difficulty: parseFloat(difficulty.toFixed(4)),
            stability: parseFloat(stability.toFixed(4)),
            interval: Math.max(1, nextInterval), // Mínimo de 1 dia
            reps,
            lapses
        };
    }
}

export const fsrs = new FSRS();
