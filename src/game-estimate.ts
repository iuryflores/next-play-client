export type GameEstimateData = {
  supported: boolean;
  source: 'igdb';
  mainMinutes: number | null;
  extrasMinutes: number | null;
  completionistMinutes: number | null;
  sampleCount: number | null;
};
export type EstimateMode =
  | 'mainMinutes'
  | 'extrasMinutes'
  | 'completionistMinutes';
export function remainingEstimate(
  estimate: number | null,
  played: number,
  completed: boolean,
) {
  // A média pode ser ultrapassada; isso não comprova que o usuário terminou o jogo.
  if (
    completed ||
    estimate === null ||
    !Number.isFinite(estimate) ||
    estimate <= 0
  )
    return null;
  return Math.max(
    0,
    estimate - Math.max(0, Number.isFinite(played) ? played : 0),
  );
}
export function estimateTime(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
}
