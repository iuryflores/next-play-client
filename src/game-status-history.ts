import { t } from './i18n';
export type GameStatusEvent = {
  id: string;
  type: 'added' | 'status' | 'archived' | 'restored' | 'abandoned' | 'resumed';
  fromStatus: 'planned' | 'active' | 'completed' | null;
  toStatus: 'planned' | 'active' | 'completed';
  source: 'manual' | 'session' | 'time-adjustment';
  recordedAt: string;
};
export type GameStatusHistoryData = {
  events: GameStatusEvent[];
  nextBefore: string | null;
  earlierHistoryUnknown: boolean;
};
export function gameStatusEventLabel(event: GameStatusEvent) {
  if (event.type === 'added') return t('Adicionado ao acompanhamento');
  if (event.type === 'archived') return t('Arquivado');
  if (event.type === 'restored') return t('Retomou o acompanhamento');
  if (event.type === 'abandoned') return t('Abandonou o acompanhamento');
  if (event.type === 'resumed') return t('Retomou o acompanhamento');
  if (event.toStatus === 'completed') return t('Concluiu o jogo');
  if (event.toStatus === 'planned') return t('Voltou para Para depois');
  return t(
    event.fromStatus === 'completed' ? 'Voltou a jogar' : 'Começou a jogar',
  );
}
