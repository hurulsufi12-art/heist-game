// Alarm meter: all active sources SUM per second; decays -6/s when unseen.
// Pure logic.
import { CONFIG } from './config.js';

export function createAlarm() {
  return { value: 0 };
}

// rates: array of per-second rates from currently-seeing sources.
// instant: one-off addition (Komet grab +25, EMP +12, smoke +5, re-online +5).
export function alarmUpdate(alarm, dt, rates, instant = 0) {
  const total = rates.reduce((a, b) => a + b, 0);
  if (total > 0) alarm.value += total * dt;
  else alarm.value -= CONFIG.ALARM_DECAY * dt;
  alarm.value += instant;
  alarm.value = Math.max(0, Math.min(100, alarm.value));
  return alarm;
}

export function alarmLabel(value) {
  if (value >= 100) return 'LOCKDOWN';
  if (value >= CONFIG.ALARM_HUNT_ON) return 'HUNT';
  if (value >= CONFIG.ALARM_SUSPICIOUS_LABEL) return 'SUSPICIOUS';
  return 'CALM';
}

export function alarmColor(value) {
  if (value >= 80) return '#ff3b30';
  if (value >= 60) return '#ff9500';
  if (value >= 30) return '#ffd60a';
  return '#30d158';
}
