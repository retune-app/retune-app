import React from "react";
import { View, StyleSheet, Image } from "react-native";

interface HeaderTitleProps {
  title?: string;
  logoOnly?: boolean;
}

export function HeaderTitle({ logoOnly = false }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={logoOnly ? styles.iconLarge : styles.icon}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  iconLarge: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
});
