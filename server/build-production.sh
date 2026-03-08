#!/bin/bash
set -e
echo "Building server..."
npm run server:build
echo "Building Expo web bundle..."
EXPO_PUBLIC_DOMAIN=retuned.replit.app npx expo export --platform web --output-dir web-build
echo "Build complete."
