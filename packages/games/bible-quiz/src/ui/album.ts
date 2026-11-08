import type { AlbumSpec } from '@brett-und-blatt/ui';
import { questionCatalog } from '../questions';
import type { BibleQuizState } from '../rules';

/** Kapitel „Bibel-Quiz“ im Sammelalbum des Passes (#148): jede richtig beantwortete Frage, nach Themenbereich. */
export const albumSpec: AlbumSpec<BibleQuizState> = {
  title: 'Bibel-Quiz',
  catalog: () => questionCatalog().map((question) => ({ id: `q${question.id}`, label: question.emojis.slice(0, 24), group: question.category })),
  // Das Ereignis „answered“ sagt, ob die eigene Antwort richtig war; die Frage steht in der öffentlichen Sicht.
  finds: ({ view, events, seat }) => {
    const right = events.some((event) => event.type === 'answered' && event.seat === seat && event.correct === true);
    return right && view.currentQuestion ? [`q${view.currentQuestion.questionId}`] : [];
  },
};
