import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import * as Haptics from "expo-haptics";

const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN_MS = 1500;

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

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    const startListening = async () => {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) {
        return;
      }

      Accelerometer.setUpdateInterval(100);

      subscription = Accelerometer.addListener((data: AccelerometerMeasurement) => {
        const { x, y, z } = data;
        const currentTime = Date.now();

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
