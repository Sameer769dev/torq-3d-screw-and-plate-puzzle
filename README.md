# TORQ: 3D Screw & Plate Puzzle (Android / Capacitor)

A tactile 3D mechanical screw-matching puzzle game built with React, Three.js, and Capacitor for Android. Unscrew anodized bolts, drop layered plates, and clear intricate procedural mechanisms without jamming your holding dock.

---

## 📱 Android Application Details

| Parameter | Value |
| :--- | :--- |
| **App Name** | **TORQ: 3D Screw & Plate** |
| **Full Title** | **TORQ: 3D Screw & Plate Puzzle** |
| **Package Name / Application ID** | `com.torq.screwplatepuzzle` |
| **Platform** | Android (minSdkVersion: 23, targetSdkVersion: 35) |
| **Runtime Engine** | Capacitor 7 + Vite 8 + Three.js + React 19 |
| **Orientation** | Sensor Portrait (locked for vertical puzzle gameplay) |

---

## 🚀 Key Mobile Features

- **Native Haptics**: Uses `@capacitor/haptics` with fallback to `navigator.vibrate` for distinct mechanical vibration impulses (bolt unscrewing, tray match lock-ins, plate drop clanks, hammer strikes, and blocked warnings).
- **Immersive Dark HUD**: Integrated with `@capacitor/status-bar` and dark theme overlay `#111318` matching the 3D metal workbench.
- **Hardware Back Button**: Smooth handling via `@capacitor/app` to exit modals, return from active game to title screen, or exit the application cleanly.
- **Aspect Ratio Adaptation**: Perspective camera dynamically zooms and scales to fit any Android phone or tablet screen.
- **Touch Safeguards**: Prevent accidental gestures (pinch-zoom, pull-to-refresh, double-tap zoom) during puzzle manipulation.

---

## 🛠️ Development & Build Commands

### 1. Run in Browser (Local Dev)
```bash
npm run dev
```

### 2. Run Test Suite
```bash
npm test
```

### 3. Typecheck
```bash
npm run lint
```

### 4. Build Web Assets & Sync to Android
```bash
npm run cap:build
```

### 5. Open in Android Studio
```bash
npm run cap:open
```

### 6. Compile Debug APK Directly
```bash
npm run android:build
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📦 Project Structure

```
├── android/                             # Native Android project
│   ├── app/
│   │   ├── build.gradle                 # applicationId: com.torq.screwplatepuzzle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml      # Permissions (VIBRATE, INTERNET) & orientation
│   │       ├── java/com/torq/screwplatepuzzle/MainActivity.java
│   │       └── res/                     # Splash screens, icons, strings & themes
├── capacitor.config.json                # Capacitor configuration
├── src/
│   ├── App.tsx                          # Main game state & Capacitor lifecycle hooks
│   ├── components/
│   │   ├── ScrewBoardCanvas.tsx         # Three.js 3D mechanical scene
│   │   └── GameOverlayHUD.tsx           # Accessible semantic HUD overlay
│   └── game/
│       ├── haptics.ts                   # Native & web haptic feedback engine
│       ├── rules.ts                     # Core puzzle rules & physics simulation
│       ├── sound.ts                     # Multi-pack soundscape synthesizer
│       ├── dda.ts                       # Dynamic difficulty adjustment
│       └── autoPlay.ts                  # Procedural solver & auto-play bot
```
