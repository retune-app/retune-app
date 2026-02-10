export const breathingAutoStartRef = { current: false };

export function setBreathingAutoStart(value: boolean) {
  breathingAutoStartRef.current = value;
}
