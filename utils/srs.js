// utils/srs.js
import { db } from './db.js';

/**
 * LinguaFlow - SuperMemo-2 Engine (Módulo 7)
 * Implementação matemática e estrita do SM-2 exigido na Etapa 7.
 */

class SRS {
    /**
     * Aplica a fórmula do SM-2 no Flashcard.
     * @param {Object} card 
     * @param {Number} q (0=errei total, 1=errei, 2=difícil, 3=bom, 4=fácil)
     */
    grade(card, q) {
        if (q < 3) {
            card.reps = 0;
            card.interval = 1;
        } else {
            if (card.reps === 0) card.interval = 1;
            else if (card.reps === 1) card.interval = 6;
            else card.interval = Math.round(card.interval * card.ease_factor);
            card.reps += 1;
        }
        
        // Calculo protetivo do Ease Factor (Mínimo 1.3)
        card.ease_factor = Math.max(1.3, card.ease_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        
        card.due_date = Date.now() + (card.interval * 24 * 60 * 60 * 1000);
        
        if (card.reps === 0) card.status = "learning";
        else if (card.interval >= 21) card.status = "mature";
        else card.status = "review";
        
        return card;
    }

    async getDueCards(limit = 20) {
        return await db.getCardsDue(limit);
    }

    async processReview(cardId, gradeValue) {
        // Encapsulamento para UI do Dashboard (Etapa 10)
    }

    /**
     * @returns {Number} tempo estimado em minutos baseando-se em 20s/card.
     */
    estimateTime(nCards) {
        return Math.ceil((nCards * 20) / 60); 
    }
}

export const srs = new SRS();
