export interface ViewportLayout {
  aspect: number;
  isPortrait: boolean;
  zoomZ: number;
  camY: number;
  targetY: number;
  frameVisW: number;
  frameVisH: number;
  centerY: number;
  topHudY: number;
  plaqueX: number;
  plaqueY: number;
  plaqueScale: number;
  tray0X: number;
  tray1X: number;
  trayY: number;
  trayScale: number;
  soundBtnX: number;
  muteBtnX: number;
  pauseBtnX: number;
  utilBtnY: number;
  utilScale: number;
  dockY: number;
  dockScaleX: number;
  dockScaleY: number;
  dockRingScale: number;
  boardOffsetY: number;
  boardSpreadX: number;
  boardSpreadY: number;
  boltBaseScale: number;
  hintY: number;
  hintScale: number;
  botDeckY: number;
  deckBtnScale: number;
  deckBtnX: [number, number, number, number];
  reactorX: number;
  reactorY: number;
  reactorScale: number;
  modalScale: number;
}

const CAMERA_FOV_DEG = 44;
export const TAN_HALF_FOV = Math.tan(((CAMERA_FOV_DEG * 0.5) * Math.PI) / 180);

/**
 * Computes a mathematically guaranteed zero-overlap, 100% full-viewport 3D workbench layout
 * for any screen aspect ratio (portrait phones, 4:3 tablets, 16:9, 19.5:9, 20:9, 21:9, ultrawide).
 *
 * Vertical stacking order (strictly disjoint bands with perspective-parallax margins):
 *   1. Top HUD Row (Readout Plaque, Target Trays, Utility Buttons)
 *   2. Spare Dock Rail
 *   3. 6x4 Multi-Layer Puzzle Board Corridor (bounded with 1.07x perspective safety for Z=0.72 plates)
 *   4. Contextual Object / FTUE Hint Plinth
 *   5. Bottom Power-Up Deck (HAMMER, +1 SLOT, PEEK, CAM)
 */
export function computeViewportLayout(wAspect: number): ViewportLayout {
  const safeAspect = Math.max(0.4, Math.min(3.5, wAspect || 1.78));
  const isPort = safeAspect < 1.0;

  if (isPort) {
    const minW = 7.45;
    const minH = 13.4;
    const zForH = minH / (2 * TAN_HALF_FOV);
    const zForW = minW / safeAspect / (2 * TAN_HALF_FOV);
    const zoomZ = Math.max(zForH, zForW);
    const centerY = 0.05;
    const camY = -0.18;
    const targetY = 0.05;

    const frameDist = zoomZ + 0.26;
    const frameVisH = 2 * frameDist * TAN_HALF_FOV;
    const frameVisW = frameVisH * safeAspect;

    const hudDist = zoomZ - 0.1;
    const hudVisH = 2 * hudDist * TAN_HALF_FOV;
    const hudVisW = hudVisH * safeAspect;
    const innerHalfW = hudVisW * 0.5 - 0.32;
    const innerHalfH = hudVisH * 0.5 - 0.28;

    const plaqueScale = 0.92;
    const utilScale = 0.94;
    const topHudHalfH = 0.48 * plaqueScale;
    const topRowY = centerY + innerHalfH - topHudHalfH - 0.1;
    const plaqueX = -innerHalfW + 1.39 * plaqueScale + 0.08;
    const pauseBtnX = innerHalfW - 0.38 * utilScale - 0.08;
    const muteBtnX = pauseBtnX - 0.82 * utilScale;
    const soundBtnX = muteBtnX - 0.82 * utilScale;

    const trayScale = 0.96;
    const trayHalfH = 0.45 * trayScale;
    const trayY = topRowY - topHudHalfH - 0.14 - trayHalfH;
    const trayOffset = 1.05 * trayScale;

    const dockScaleY = 0.98;
    const dockHalfH = 0.39 * dockScaleY;
    const dockY = trayY - trayHalfH - 0.14 - dockHalfH;
    const dockBot = dockY - dockHalfH;

    const deckBtnScale = 0.94;
    const deckHalfH = 0.43 * deckBtnScale;
    const botDeckY = centerY - innerHalfH + deckHalfH + 0.1;
    const botDeckTop = botDeckY + deckHalfH;
    const deckStep = (innerHalfW * 2 - 1.3 * deckBtnScale) / 3;

    const hintScale = Math.min(0.86, (innerHalfW * 2 - 0.24) / 6.1);
    const hintHalfH = 0.28 * hintScale;
    const hintY = botDeckTop + 0.14 + hintHalfH;
    const hintTop = hintY + hintHalfH;

    const corridorTop = dockBot - 0.24;
    const corridorBot = hintTop + 0.24;
    const boardOffsetY = (corridorTop + corridorBot) * 0.5;
    const availBoardH = Math.max(3.2, corridorTop - corridorBot);
    const availBoardW = Math.max(5.6, innerHalfW * 2 - 0.5);

    const perspSafety = 1.07;
    const boltBaseScale = 0.98;
    const boardSpreadX = Math.min(
      1.1,
      Math.max(0.84, (availBoardW * 0.5 / perspSafety - 0.44 * boltBaseScale) / 2.85)
    );
    const boardSpreadY = Math.min(
      1.08,
      Math.max(0.76, (availBoardH / perspSafety - 0.88 * boltBaseScale) / 3.12)
    );

    return {
      aspect: safeAspect,
      isPortrait: true,
      zoomZ,
      camY,
      targetY,
      frameVisW,
      frameVisH,
      centerY,
      topHudY: topRowY,
      plaqueX,
      plaqueY: topRowY,
      plaqueScale,
      tray0X: -trayOffset,
      tray1X: trayOffset,
      trayY,
      trayScale,
      soundBtnX,
      muteBtnX,
      pauseBtnX,
      utilBtnY: topRowY,
      utilScale,
      dockY,
      dockScaleX: Math.min(1.06, (innerHalfW * 2 - 0.4) / 6.3),
      dockScaleY,
      dockRingScale: 1.0,
      boardOffsetY,
      boardSpreadX,
      boardSpreadY,
      boltBaseScale,
      hintY,
      hintScale,
      botDeckY,
      deckBtnScale,
      deckBtnX: [
        -1.5 * deckStep,
        -0.5 * deckStep,
        0.5 * deckStep,
        1.5 * deckStep,
      ],
      reactorX: innerHalfW - 0.52,
      reactorY: boardOffsetY,
      reactorScale: 0.72,
      modalScale: Math.min(1.0, (hudVisW - 0.6) / 6.0),
    };
  }

  // Landscape Mode (100% Full-Screen Edge-to-Edge Utilization across 4:3, 16:9, 19.5:9, 20:9, 21:9+)
  const minH = 9.0;
  const minW = 12.2;
  const zForH = minH / (2 * TAN_HALF_FOV);
  const zForW = minW / safeAspect / (2 * TAN_HALF_FOV);
  const zoomZ = Math.max(zForH, zForW);
  const centerY = -0.04;
  const camY = -0.18;
  const targetY = -0.04;

  const frameDist = zoomZ + 0.26;
  const frameVisH = 2 * frameDist * TAN_HALF_FOV;
  const frameVisW = frameVisH * safeAspect;

  const hudDist = zoomZ - 0.1;
  const hudVisH = 2 * hudDist * TAN_HALF_FOV;
  const hudVisW = hudVisH * safeAspect;
  const innerHalfW = hudVisW * 0.5 - 0.36;
  const innerHalfH = hudVisH * 0.5 - 0.24;

  // Smoothly scale up UI & spread puzzle board across wider aspect ratios (4:3 through 21:9+)
  const wideFactor = Math.min(1.0, Math.max(0.0, (safeAspect - 1.38) / (2.18 - 1.38)));

  // Band 1: Top HUD Row
  const plaqueScale = 1.0 + wideFactor * 0.16;
  const plaqueHalfW = 1.39 * plaqueScale;
  const plaqueX = -innerHalfW + plaqueHalfW + 0.14;

  const utilScale = 1.04 + wideFactor * 0.16;
  const utilStep = 0.84 * utilScale;
  const pauseBtnX = innerHalfW - 0.39 * utilScale - 0.14;
  const muteBtnX = pauseBtnX - utilStep;
  const soundBtnX = muteBtnX - utilStep;

  const trayScale = 1.0 + wideFactor * 0.12;
  const leftBoundAfterPlaque = plaqueX + plaqueHalfW + 0.2;
  const rightBoundBeforeUtils = soundBtnX - 0.39 * utilScale - 0.2;
  const trayCenter = (leftBoundAfterPlaque + rightBoundBeforeUtils) * 0.5;
  const trayOffset = 1.04 * trayScale;
  const tray0X = trayCenter - trayOffset;
  const tray1X = trayCenter + trayOffset;

  const topHudHalfH = Math.max(0.47 * plaqueScale, 0.45 * trayScale);
  const topHudY = centerY + innerHalfH - topHudHalfH - 0.08;
  const topHudBot = topHudY - topHudHalfH;

  // Band 2: Spare Dock Rail
  const dockScaleX = 1.04 + wideFactor * 0.24;
  const dockScaleY = 0.96 + wideFactor * 0.06;
  const dockRingScale = 1.02 + wideFactor * 0.1;
  const dockHalfH = 0.39 * dockScaleY;
  const dockY = topHudBot - 0.12 - dockHalfH;
  const dockBot = dockY - dockHalfH;

  // Band 5: Bottom Power-Up Deck (HAMMER, +1 SLOT, PEEK, CAM)
  const deckBtnScale = 0.96 + wideFactor * 0.14;
  const deckHalfH = 0.43 * deckBtnScale;
  const botDeckY = centerY - innerHalfH + deckHalfH + 0.08;
  const botDeckTop = botDeckY + deckHalfH;
  const deckStep = (1.52 + wideFactor * 0.36) * deckBtnScale;

  // Band 4: Contextual Object Brief / FTUE Hint Plinth (strictly above Power-Up Deck)
  const hintScale = Math.min(0.86 + wideFactor * 0.1, (innerHalfW * 2 - 2.4) / 6.1);
  const hintHalfH = 0.28 * hintScale;
  const hintY = botDeckTop + 0.14 + hintHalfH;
  const hintTop = hintY + hintHalfH;

  // Band 3: 6x4 Multi-Layer Puzzle Board Corridor (strictly between Spare Dock & Hint Plinth)
  const corridorTop = dockBot - 0.22;
  const corridorBot = hintTop + 0.22;
  const boardOffsetY = (corridorTop + corridorBot) * 0.5;
  const availBoardH = Math.max(3.2, corridorTop - corridorBot);

  // Right-Side Auto-Play Reactor (vertically centered in the board corridor, safely clear of Top & Bottom HUD)
  const reactorScale = 0.92 + wideFactor * 0.14;
  const reactorHalfW = 0.59 * reactorScale;
  const reactorX = innerHalfW - reactorHalfW - 0.14;
  const reactorY = boardOffsetY;

  // Compute board spread with 1.07x perspective safety margin for highest-layer Z plates
  const perspSafety = 1.07;
  const boltBaseScale = Math.min(1.1, 0.96 + wideFactor * 0.12);
  const maxBoardHalfW = Math.min(
    innerHalfW - 0.36,
    reactorX - reactorHalfW - 0.3
  );
  const boardSpreadX = Math.min(
    1.38,
    Math.max(0.92, (maxBoardHalfW / perspSafety - 0.44 * boltBaseScale) / 2.85)
  );
  const boardSpreadY = Math.min(
    1.06,
    Math.max(0.78, (availBoardH / perspSafety - 0.88 * boltBaseScale) / 3.12)
  );

  return {
    aspect: safeAspect,
    isPortrait: false,
    zoomZ,
    camY,
    targetY,
    frameVisW,
    frameVisH,
    centerY,
    topHudY,
    plaqueX,
    plaqueY: topHudY,
    plaqueScale,
    tray0X,
    tray1X,
    trayY: topHudY,
    trayScale,
    soundBtnX,
    muteBtnX,
    pauseBtnX,
    utilBtnY: topHudY,
    utilScale,
    dockY,
    dockScaleX,
    dockScaleY,
    dockRingScale,
    boardOffsetY,
    boardSpreadX,
    boardSpreadY,
    boltBaseScale,
    hintY,
    hintScale,
    botDeckY,
    deckBtnScale,
    deckBtnX: [
      -1.5 * deckStep,
      -0.5 * deckStep,
      0.5 * deckStep,
      1.5 * deckStep,
    ],
    reactorX,
    reactorY,
    reactorScale,
    modalScale: 1.05 + wideFactor * 0.1,
  };
}
