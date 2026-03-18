import { derived } from 'svelte/store';
import { missionShareStreak } from './missionShareStreak';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const remainingMs = derived(missionShareStreak, ($state, set) => {
  if ($state.stars >= 3 || !$state.lastStarAt) {
    set(0);
    return;
  }

  const calc = () => {
    const elapsed = Date.now() - $state.lastStarAt!;
    const remaining = ONE_DAY_MS - elapsed;
    set(Math.max(0, remaining));
  };

  calc();
  const id = setInterval(calc, 1000);
  return () => clearInterval(id);
});

const isRunning = derived(remainingMs, ($ms) => $ms > 0);

const label = derived(remainingMs, ($ms) => {
  if ($ms <= 0) return '0h 00m';

  const totalSec = Math.floor($ms / 1000);
  const totalMinutes = Math.floor(totalSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
});

export const missionCountdown = {
  remainingMs,
  isRunning,
  label,
};

