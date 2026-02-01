import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import * as Haptics from "expo-haptics";

const SHAKE_THRESHOLD = 2.5;
const SHAKE_COOLDOWN_MS = 1500;
const STARTUP_DELAY_MS = 2000;

interface UseShakeDetectorOptions {
  onShake: () => void;
  enabled?: boolean;
}

export function useShakeDetector({ onShake, enabled = true }: UseShakeDetectorOptions) {
  const lastShakeTime = useRef(0);
  const lastUpdate = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);
  const startTime = useRef(0);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    startTime.current = Date.now();
    isInitialized.current = false;

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
          lastX.current = x;
          lastY.current = y;
          lastZ.current = z;
          lastUpdate.current = currentTime;
          return;
        }

        if (!isInitialized.current) {
          isInitialized.current = true;
          lastX.current = x;
          lastY.current = y;
          lastZ.current = z;
          lastUpdate.current = currentTime;
          return;
        }

        if (currentTime - lastUpdate.current > 100) {
          const diffTime = currentTime - lastUpdate.current;
          lastUpdate.current = currentTime;

          const deltaX = Math.abs(x - lastX.current);
          const deltaY = Math.abs(y - lastY.current);
          const deltaZ = Math.abs(z - lastZ.current);

          const acceleration = (deltaX + deltaY + deltaZ) / diffTime * 10000;

          if (acceleration > SHAKE_THRESHOLD) {
            if (currentTime - lastShakeTime.current > SHAKE_COOLDOWN_MS) {
              lastShakeTime.current = currentTime;
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
              onShake();
            }
          }

          lastX.current = x;
          lastY.current = y;
          lastZ.current = z;
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
