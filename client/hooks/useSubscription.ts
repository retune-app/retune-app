import { useQuery } from "@tanstack/react-query";

interface SubscriptionInfo {
  tier: "free" | "premium";
  isPremium: boolean;
  betaMode: boolean;
  freeFeatures: string[];
  premiumFeatures: string[];
}

export function useSubscription() {
  const { data, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
  });

  return {
    tier: data?.tier ?? "free",
    isPremium: data?.isPremium ?? true,
    betaMode: data?.betaMode ?? true,
    freeFeatures: data?.freeFeatures ?? [],
    premiumFeatures: data?.premiumFeatures ?? [],
    isLoading,
  };
}
