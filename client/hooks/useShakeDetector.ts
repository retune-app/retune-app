import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import * as Haptics from "expo-haptics";

const SHAKE_THRESHOLD = 1.5;
const SHAKE_COUNT_THRESHOLD = 3;
const SHAKE_TIME_WINDOW_MS = 500;
const SHAKE_COOLDOWN_MS = 2000;
const STARTUP_DELAY_MS = 3000;

interface UseShakeDetectorOptions {
  onShake: () => void;
  enabled?: boolean;
}

export function useShakeDetector({ onShake, enabled = true }: UseShakeDetectorOptions) {
  const lastShakeTime = useRef(0);
  const shakeCount = useRef(0);
  const lastShakeEventTime = useRef(0);
  const startTime = useRef(0);
  const lastMagnitude = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    startTime.current = Date.now();
    shakeCount.current = 0;

    const startListening = async () => {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) {
        return;
      }

      Accelerometer.setUpdateInterval(100);

      subscription = Accelerometer.addListener((data: AccelerometerMeasurement) => {
        const { x, y, z } = data;
        const currentTime = Date.now();

        // Ignore readings during startup period
        if (currentTime - startTime.current < STARTUP_DELAY_MS) {
          return;
        }

        // Calculate magnitude of acceleration (excluding gravity ~1g)
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const delta = Math.abs(magnitude - lastMagnitude.current);
        lastMagnitude.current = magnitude;

        // Detect a shake event (rapid change in acceleration)
        if (delta > SHAKE_THRESHOLD) {
          // Reset count if too much time passed since last shake event
          if (currentTime - lastShakeEventTime.current > SHAKE_TIME_WINDOW_MS) {
            shakeCount.current = 0;
          }

          shakeCount.current++;
          lastShakeEventTime.current = currentTime;

          // Trigger if we have enough shake events in the time window
          if (shakeCount.current >= SHAKE_COUNT_THRESHOLD) {
            if (currentTime - lastShakeTime.current > SHAKE_COOLDOWN_MS) {
              lastShakeTime.current = currentTime;
              shakeCount.current = 0;
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
              onShake();
            }
          }
        }
      });
    };

    startListening();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled, onShake]);
}
