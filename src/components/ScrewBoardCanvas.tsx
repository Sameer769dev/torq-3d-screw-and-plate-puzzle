import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AutoPlayState } from '../game/autoPlay';
import { DifficultyGaugeState } from '../game/dda';
import {
  FtueState,
  isControlUnlocked,
  NewToolAnnouncement,
} from '../game/ftue';
import {
  Button3DHandle,
  create3DControlButton,
  create3DDiegeticModalStage,
  create3DFtueHintPlinth,
  create3DNativeAdBillboard,
  create3DNewToolPlaque,
  create3DRadioactiveAutoPlayRig,
  create3DReadoutPlaque,
  create3DTargetBoxTray,
  Gui3DAction,
  ModalOverlay3DState,
  NativeAdBillboardHandle,
  updateButton3DCapTexture,
} from '../game/gui3d';
import {
  createIdleHandState,
  DEFAULT_IDLE_THRESHOLD_SEC,
  forceIdleHand,
  getIdleHandStats,
  resetIdleTimer,
  stepIdleHandState,
} from '../game/idleHand';
import {
  createLevelTransition3DState,
  easeOutBack,
  getLevelTransitionStats,
  PowerUpSlotIndex,
  startLevelTransition3D,
  stepLevelTransition3D,
  triggerPowerUpActivation3D,
} from '../game/levelTransition3d';
import {
  create3DHammerGroup,
  create3DIdleGuideHandGroup,
  createCompositePlateGroup,
  createCompositeScrewGroup,
  createStudioHDREnvironment,
  createWorkbenchEnvironment,
  createWorkshopTextures,
  getSpecialBoltBadgeTexture,
} from '../game/models3d';
import {
  createSceneParticleSystem3D,
  getParticle3DStats,
} from '../game/particles3d';
import { findBestHintScrew, getDockSlotWorldX, isScrewBlocked } from '../game/rules';
import {
  createScreenShake3DState,
  getScreenShakeStats,
  stepScreenShake3D,
  triggerAuxiliaryShake,
  triggerBoxCompleteShake,
  triggerPlateDropShake,
  triggerVictoryShake,
} from '../game/screenShake3d';
import { soundEngine, SoundSettingsState } from '../game/sound';
import { DayStreakState } from '../game/streak';
import {
  BoardState,
  GamePhase,
  RunSnapshot,
  SCREW_COLOR_META,
} from '../game/types';

// Pre-allocated scratch math objects at module scope (Zero GC in render loop)
const _vec3 = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _colA = new THREE.Color();
const _colB = new THREE.Color();

interface ScrewAnimData {
  group: THREE.Group;
  currX: number;
  currY: number;
  currZ: number;
  spinZ: number;
  shakeTimer: number;
}

interface PlateAnimData {
  pivotGroup: THREE.Group;
  plateGroup: THREE.Group;
  currZ: number;
  currRotZ: number;
  rotVel: number;
  fallY: number;
  fallVelY: number;
  fallRotX: number;
  clearedDone: boolean;
}

interface Props {
  board: BoardState;
  gamePhase: GamePhase;
  bestScore: number;
  muted: boolean;
  soundSettingsOpen: boolean;
  soundState: SoundSettingsState;
  explodedPeek: boolean;
  cameraPreset: 'top' | 'angled' | 'side';
  runSnapshot: RunSnapshot | null;
  difficultyGauge: DifficultyGaugeState;
  dayStreak: DayStreakState;
  autoPlay: AutoPlayState;
  ftueState: FtueState;
  highestLevelIndex: number;
  activeModalOpen: boolean;
  overlayModal: ModalOverlay3DState;
  hintText: string | null;
  newToolToast: NewToolAnnouncement | null;
  hasBottomBoostersUnlocked: boolean;
  cloudConnected: boolean;
  idleThresholdSec: number;
  nativeAdsMinLevelIndex: number;
  onUnscrewAttempt: (screwId: string) => void;
  onGuiAction: (action: Gui3DAction) => void;
  onHoverScrew?: (screwId: string | null) => void;
}

export const ScrewBoardCanvas: React.FC<Props> = ({
  board,
  gamePhase,
  bestScore,
  muted,
  soundSettingsOpen,
  soundState,
  explodedPeek,
  cameraPreset,
  runSnapshot,
  difficultyGauge,
  dayStreak,
  autoPlay,
  ftueState,
  highestLevelIndex,
  activeModalOpen,
  overlayModal,
  hintText,
  newToolToast,
  hasBottomBoostersUnlocked,
  cloudConnected,
  idleThresholdSec,
  nativeAdsMinLevelIndex,
  onUnscrewAttempt,
  onGuiAction,
  onHoverScrew,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store mutable refs so the 60fps loop never re-mounts WebGL when React state updates
  const boardRef = useRef<BoardState>(board);
  boardRef.current = board;

  const ftueStateRef = useRef<FtueState>(ftueState);
  ftueStateRef.current = ftueState;

  const highestLevelIndexRef = useRef<number>(highestLevelIndex);
  highestLevelIndexRef.current = highestLevelIndex;

  const activeModalOpenRef = useRef<boolean>(activeModalOpen);
  activeModalOpenRef.current = activeModalOpen;

  const overlayModalRef = useRef<ModalOverlay3DState>(overlayModal);
  overlayModalRef.current = overlayModal;

  const hintTextRef = useRef<string | null>(hintText);
  hintTextRef.current = hintText;

  const newToolToastRef = useRef<NewToolAnnouncement | null>(newToolToast);
  newToolToastRef.current = newToolToast;

  const hasBottomBoostersRef = useRef<boolean>(hasBottomBoostersUnlocked);
  hasBottomBoostersRef.current = hasBottomBoostersUnlocked;

  const cloudConnectedRef = useRef<boolean>(cloudConnected);
  cloudConnectedRef.current = cloudConnected;

  const idleThresholdRef = useRef<number>(idleThresholdSec);
  idleThresholdRef.current = idleThresholdSec;

  const nativeAdsMinLevelRef = useRef<number>(nativeAdsMinLevelIndex);
  nativeAdsMinLevelRef.current = nativeAdsMinLevelIndex;

  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;

  const bestScoreRef = useRef<number>(bestScore);
  bestScoreRef.current = bestScore;

  const mutedRef = useRef<boolean>(muted);
  mutedRef.current = muted;

  const soundSettingsOpenRef = useRef<boolean>(soundSettingsOpen);
  soundSettingsOpenRef.current = soundSettingsOpen;

  const soundStateRef = useRef<SoundSettingsState>(soundState);
  soundStateRef.current = soundState;

  const explodedPeekRef = useRef<boolean>(explodedPeek);
  explodedPeekRef.current = explodedPeek;

  const cameraPresetRef = useRef<'top' | 'angled' | 'side'>(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  const runSnapshotRef = useRef<RunSnapshot | null>(runSnapshot);
  runSnapshotRef.current = runSnapshot;

  const difficultyGaugeRef = useRef<DifficultyGaugeState>(difficultyGauge);
  difficultyGaugeRef.current = difficultyGauge;

  const dayStreakRef = useRef<DayStreakState>(dayStreak);
  dayStreakRef.current = dayStreak;

  const autoPlayRef = useRef<AutoPlayState>(autoPlay);
  autoPlayRef.current = autoPlay;

  const onUnscrewRef = useRef(onUnscrewAttempt);
  onUnscrewRef.current = onUnscrewAttempt;

  const onGuiActionRef = useRef(onGuiAction);
  onGuiActionRef.current = onGuiAction;

  const onHoverRef = useRef(onHoverScrew);
  onHoverRef.current = onHoverScrew;

  const rebuildTriggerRef = useRef<((withEntrance?: boolean) => void) | null>(
    null
  );
  const startTransitionRef = useRef<(() => void) | null>(null);
  const triggerPowerUpAnimRef = useRef<
    ((slotIdx: PowerUpSlotIndex) => void) | null
  >(null);
  const triggerFeedbackRef = useRef<
    ((feedback: BoardState['lastActionFeedback']) => void) | null
  >(null);

  // Detect endless board transitions, phase changes, or power-up toggles
  const prevLevelIdxRef = useRef<number>(board.levelIndex);
  const prevFirstScrewIdRef = useRef<string>(board.screws[0]?.id ?? '');
  const prevMovesRef = useRef<number>(board.movesCount);
  const prevPhaseRef = useRef<GamePhase>(gamePhase);
  const prevHammerModeRef = useRef<boolean>(board.hammerMode);
  const prevExplodedRef = useRef<boolean>(explodedPeek);
  const prevCamPresetRef = useRef<'top' | 'angled' | 'side'>(cameraPreset);
  const prevFeedbackTimestampRef = useRef<number>(0);

  useEffect(() => {
    const firstScrewId = board.screws[0]?.id ?? '';
    const levelChanged =
      prevLevelIdxRef.current !== board.levelIndex ||
      prevFirstScrewIdRef.current !== firstScrewId;
    const phaseEnteredPlaying =
      prevPhaseRef.current !== 'playing' && gamePhase === 'playing';
    const restartedStage =
      board.movesCount === 0 && prevMovesRef.current > 0;

    if (levelChanged || phaseEnteredPlaying || restartedStage) {
      prevLevelIdxRef.current = board.levelIndex;
      prevFirstScrewIdRef.current = firstScrewId;
      prevMovesRef.current = board.movesCount;
      prevPhaseRef.current = gamePhase;
      rebuildTriggerRef.current?.(true);
      if (gamePhase === 'playing') {
        startTransitionRef.current?.();
      }
    } else {
      prevMovesRef.current = board.movesCount;
    }
    prevPhaseRef.current = gamePhase;

    if (board.hammerMode !== prevHammerModeRef.current) {
      prevHammerModeRef.current = board.hammerMode;
      if (board.hammerMode) {
        triggerPowerUpAnimRef.current?.(0);
      }
    }

    if (
      board.lastActionFeedback &&
      board.lastActionFeedback.timestamp !== prevFeedbackTimestampRef.current
    ) {
      prevFeedbackTimestampRef.current = board.lastActionFeedback.timestamp;
      triggerFeedbackRef.current?.(board.lastActionFeedback);
    }
  }, [board, gamePhase]);

  useEffect(() => {
    if (explodedPeek !== prevExplodedRef.current) {
      prevExplodedRef.current = explodedPeek;
      triggerPowerUpAnimRef.current?.(2);
    }
  }, [explodedPeek]);

  useEffect(() => {
    if (cameraPreset !== prevCamPresetRef.current) {
      prevCamPresetRef.current = cameraPreset;
      triggerPowerUpAnimRef.current?.(3);
    }
  }, [cameraPreset]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene & Glare-Free 360° Perimeter Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1118);
    scene.fog = new THREE.FogExp2(0x0d1118, 0.022);

    scene.environment = createStudioHDREnvironment(renderer);
    scene.environmentIntensity = 0.95;

    // 3. Camera & OrbitControls (Aspect-Ratio Responsive for Portrait Mobile & Desktop)
    const initAspect =
      (container.clientWidth || window.innerWidth) /
      (container.clientHeight || window.innerHeight);
    const isPortrait = initAspect < 1.0;

    const initZoomZ = isPortrait
      ? Math.min(20.0, Math.max(13.5, 7.6 / Math.max(0.38, initAspect)))
      : (initAspect < 1.15 ? 11.4 * (1.18 / Math.max(0.7, initAspect)) : 11.8);

    const initTargetY = isPortrait ? (gamePhaseRef.current === 'playing' ? 0.65 : 0.45) : 0.15;
    const initCamY = isPortrait ? (gamePhaseRef.current === 'playing' ? -0.15 : 0.45) : -0.55;

    const camera = new THREE.PerspectiveCamera(44, initAspect, 0.1, 100);
    camera.position.set(0, initCamY, initZoomZ);
    camera.lookAt(0, initTargetY, isPortrait && gamePhaseRef.current !== 'playing' ? 2.2 : 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 6.5;
    controls.maxDistance = 32.0;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.minAzimuthAngle = -Math.PI * 0.35;
    controls.maxAzimuthAngle = Math.PI * 0.35;
    controls.target.set(0, initTargetY, isPortrait && gamePhaseRef.current !== 'playing' ? 2.2 : 0);
    controls.update();

    let userOrbiting = false;
    controls.addEventListener('start', () => {
      userOrbiting = true;
    });
    controls.addEventListener('end', () => {
      userOrbiting = false;
    });

    // 4. Symmetrical 4-Quadrant Studio Lighting Rig (Evenly distributed, zero front glare)
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.15);
    scene.add(hemiLight);

    // Top-Right Grazing Key Light (casts soft shadows)
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    keyLight.position.set(7.5, 7.5, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    const d = 7.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // Top-Left Grazing Fill Light
    const topLeftLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
    topLeftLight.position.set(-7.5, 7.5, 6.5);
    scene.add(topLeftLight);

    // Bottom-Left Grazing Rim Light
    const botLeftLight = new THREE.DirectionalLight(0xfef3c7, 0.85);
    botLeftLight.position.set(-7.5, -7.5, 6.5);
    scene.add(botLeftLight);

    // Bottom-Right Grazing Fill Light
    const botRightLight = new THREE.DirectionalLight(0xe2e8f0, 0.85);
    botRightLight.position.set(7.5, -7.5, 6.5);
    scene.add(botRightLight);

    // 5. Procedural Textures & Static Workbench Environment
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const { brushedBumpMap, workbenchTexture } =
      createWorkshopTextures(maxAnisotropy);
    const workbenchGroup = createWorkbenchEnvironment(
      workbenchTexture,
      brushedBumpMap,
      isPortrait
    );
    scene.add(workbenchGroup);

    // 6. 3D DIEGETIC WORKBENCH GUI HARDWARE (Mounted directly in 3D scene!)
    const gui3DGroup = new THREE.Group();
    scene.add(gui3DGroup);

    const topHud3DGroup = new THREE.Group();
    const bottomDeck3DGroup = new THREE.Group();
    gui3DGroup.add(topHud3DGroup, bottomDeck3DGroup);

    // 6a. 3D Digital LED Readout Plaque (Top-Left of Workbench)
    const readoutPlaque = create3DReadoutPlaque(maxAnisotropy);
    if (isPortrait) {
      readoutPlaque.group.position.set(-1.45, 4.85, 0.06);
      readoutPlaque.group.scale.set(0.85, 0.85, 0.85);
    }
    topHud3DGroup.add(readoutPlaque.group);

    // 6b. 3D Physical Target Collector Trays (Top-Center of Workbench)
    const targetTray0 = create3DTargetBoxTray(0);
    const targetTray1 = create3DTargetBoxTray(1);
    if (isPortrait) {
      targetTray0.group.position.set(-1.05, 3.65, 0.06);
      targetTray1.group.position.set(1.05, 3.65, 0.06);
    }
    topHud3DGroup.add(targetTray0.group, targetTray1.group);

    // 6c. Physical 3D Mechanical Push-Buttons on Workbench Rails
    // Top-Right Utility 3D Buttons (SOUND PACK MENU, MUTE, PAUSE)
    const soundMenuBtn3D = create3DControlButton(
      isPortrait ? 0.85 : 2.7,
      isPortrait ? 4.85 : 3.65,
      0.08,
      0.62,
      0.72,
      { type: 'open_sound_settings' },
      maxAnisotropy
    );
    const muteBtn3D = create3DControlButton(
      isPortrait ? 1.7 : 3.55,
      isPortrait ? 4.85 : 3.65,
      0.08,
      0.6,
      0.72,
      { type: 'toggle_mute' },
      maxAnisotropy
    );
    const pauseBtn3D = create3DControlButton(
      isPortrait ? 2.55 : 4.4,
      isPortrait ? 4.85 : 3.65,
      0.08,
      0.6,
      0.72,
      { type: 'pause_toggle' },
      maxAnisotropy
    );
    if (isPortrait) {
      soundMenuBtn3D.group.scale.set(0.85, 0.85, 0.85);
      muteBtn3D.group.scale.set(0.85, 0.85, 0.85);
      pauseBtn3D.group.scale.set(0.85, 0.85, 0.85);
    }
    topHud3DGroup.add(
      soundMenuBtn3D.group,
      muteBtn3D.group,
      pauseBtn3D.group
    );

    // Bottom Thumb-Zone 3D Power-Up Deck Buttons (HAMMER, +SLOT, PEEK, CAM)
    const hammerBtn3D = create3DControlButton(
      -2.25,
      -3.35,
      0.1,
      1.24,
      0.78,
      { type: 'hammer' },
      maxAnisotropy
    );
    const slotBtn3D = create3DControlButton(
      -0.75,
      -3.35,
      0.1,
      1.24,
      0.78,
      { type: 'extra_slot' },
      maxAnisotropy
    );
    const peekBtn3D = create3DControlButton(
      0.75,
      -3.35,
      0.1,
      1.24,
      0.78,
      { type: 'toggle_explode' },
      maxAnisotropy
    );
    const camBtn3D = create3DControlButton(
      2.25,
      -3.35,
      0.1,
      1.24,
      0.78,
      { type: 'cycle_camera' },
      maxAnisotropy
    );

    const powerUpDeckButtons3D: Button3DHandle[] = [
      hammerBtn3D,
      slotBtn3D,
      peekBtn3D,
      camBtn3D,
    ];
    for (const b of powerUpDeckButtons3D) {
      bottomDeck3DGroup.add(b.group);
    }

    // 6c-right. Right-Side 3D Radioactive Liquid Auto-Play Reactor Vessel & Activator
    const autoPlayRig = create3DRadioactiveAutoPlayRig(maxAnisotropy);
    if (isPortrait) {
      autoPlayRig.group.position.set(2.8, -1.5, 0.12);
      autoPlayRig.group.scale.set(0.72, 0.72, 0.72);
    }
    gui3DGroup.add(autoPlayRig.group);

    const workbenchButtons3D: Button3DHandle[] = [
      soundMenuBtn3D,
      muteBtn3D,
      pauseBtn3D,
      ...powerUpDeckButtons3D,
      autoPlayRig.buttonHandle,
    ];

    // 6d. 3D Machinist's Hammer (Hovers over target bolts in Hammer Mode & swings down on impact)
    const hammer3D = create3DHammerGroup(brushedBumpMap);
    hammer3D.visible = false;
    scene.add(hammer3D);
    let hammerStrikeTimer = 0;
    const hammerStrikePos = new THREE.Vector3();

    // 6d-idle. 3D Articulated Idle Guide Hand (Hovers & double-taps over the optimal solver bolt when player is idle)
    const idleGuideHand = create3DIdleGuideHandGroup(brushedBumpMap);
    scene.add(idleGuideHand.root);

    // 6e. 3D Diegetic Modal Stage (Title / Pause / Victory / Defeat / Sound Settings / PGS / Recap / Conflict)
    const modal3D = create3DDiegeticModalStage(maxAnisotropy);
    if (isPortrait) {
      modal3D.root.position.set(0, 0.45, 2.2);
      modal3D.root.scale.set(0.88, 0.88, 0.88);
    }
    scene.add(modal3D.root);

    // 6e-banners. 3D Contextual FTUE Hint Plinth & New-Tool Unlock Plaque
    const ftueHintPlinth = create3DFtueHintPlinth(maxAnisotropy);
    const newToolPlaque = create3DNewToolPlaque(maxAnisotropy);
    gui3DGroup.add(ftueHintPlinth.group, newToolPlaque.group);
    let hintPlaqueBlend = 0;
    let toolPlaqueBlend = 0;

    // 6f. Dual 3D Native Ad Billboards (Flanking Left & Right Workbench in Empty Lateral Space)
    const nativeAdsGroup = new THREE.Group();
    nativeAdsGroup.name = 'native_ads_billboards';
    scene.add(nativeAdsGroup);

    const leftAdBillboard = create3DNativeAdBillboard('left', maxAnisotropy);
    const rightAdBillboard = create3DNativeAdBillboard('right', maxAnisotropy);
    nativeAdsGroup.add(leftAdBillboard.group, rightAdBillboard.group);

    const updateBillboardLayout = (wAspect: number) => {
      const isPort = wAspect < 1.0;
      const isNative = Capacitor.isNativePlatform();
      // On native Android, real Google AdMob NativeAdView cards are displayed by MainActivity
      // In web browser preview mode, procedural 3D billboards are displayed
      leftAdBillboard.group.visible = !isPort && !isNative;
      rightAdBillboard.group.visible = !isPort && !isNative;
      if (!isPort && !isNative) {
        const halfWidth = 4.72 * wAspect;
        const adCenterX = Math.min(7.6, Math.max(6.65, (5.35 + halfWidth) * 0.5));
        const adScale = Math.min(1.0, Math.max(0.78, (halfWidth - 5.35) / 3.2));
        leftAdBillboard.group.position.x = -adCenterX;
        leftAdBillboard.group.scale.setScalar(adScale);
        rightAdBillboard.group.position.x = adCenterX;
        rightAdBillboard.group.scale.setScalar(adScale);
      }
    };
    updateBillboardLayout(initAspect);

    const isHierarchyVisible = (obj: THREE.Object3D | null): boolean => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    };

    const syncWorkbenchFtueVisibility = (boardLevelIndex: number) => {
      const curFtue = ftueStateRef.current;
      const curHighestLvl = Math.max(highestLevelIndexRef.current, boardLevelIndex);
      const ftueGateOpts = {
        totalDaysPlayed: dayStreakRef.current.totalDaysPlayed,
        activeModalOpen: activeModalOpenRef.current,
        nativeAdsMinLevelIndex: nativeAdsMinLevelRef.current,
      };
      soundMenuBtn3D.group.visible = isControlUnlocked('soundPack', curHighestLvl, curFtue, ftueGateOpts);
      muteBtn3D.group.visible = isControlUnlocked('mute', curHighestLvl, curFtue, ftueGateOpts);
      pauseBtn3D.group.visible = isControlUnlocked('pause', curHighestLvl, curFtue, ftueGateOpts);
      hammerBtn3D.group.visible = isControlUnlocked('hammer', curHighestLvl, curFtue, ftueGateOpts);
      slotBtn3D.group.visible = isControlUnlocked('slot', curHighestLvl, curFtue, ftueGateOpts);
      peekBtn3D.group.visible = isControlUnlocked('peek', curHighestLvl, curFtue, ftueGateOpts);
      camBtn3D.group.visible = isControlUnlocked('cam', curHighestLvl, curFtue, ftueGateOpts);
      const autoPlayUnlocked = isControlUnlocked('autoPlay', curHighestLvl, curFtue, ftueGateOpts);
      autoPlayRig.group.visible = autoPlayUnlocked;
      autoPlayRig.buttonHandle.group.visible = autoPlayUnlocked;

      const webNativeAdsAllowed = isControlUnlocked('nativeAds', curHighestLvl, curFtue, ftueGateOpts);
      if (!Capacitor.isNativePlatform() && camera.aspect >= 1.0) {
        leftAdBillboard.group.visible = webNativeAdsAllowed;
        rightAdBillboard.group.visible = webNativeAdsAllowed;
      } else {
        leftAdBillboard.group.visible = false;
        rightAdBillboard.group.visible = false;
      }
      return {
        showStreakCard: isControlUnlocked('streakCard', curHighestLvl, curFtue, ftueGateOpts),
      };
    };
    syncWorkbenchFtueVisibility(boardRef.current.levelIndex);

    // 7. Dual-InstancedMesh 3D Particle System (Metallic Sparks + Physical 3D Debris Shards)
    const particleSystem = createSceneParticleSystem3D(scene);
    let victoryFireworkTimer = 0;
    let boxCompletePopTimer = 0;

    // 8. Dynamic Level Scene Graph Containers
    const levelGroup = new THREE.Group();
    scene.add(levelGroup);

    const screwAnims = new Map<string, ScrewAnimData>();
    const plateAnims = new Map<string, PlateAnimData>();
    const dockHoleMeshes: THREE.Mesh[] = [];
    const interactableScrewTargets: THREE.Object3D[] = [];

    function buildLevelScene(withEntrance = true) {
      while (levelGroup.children.length > 0) {
        levelGroup.remove(levelGroup.children[0]);
      }
      screwAnims.clear();
      plateAnims.clear();
      dockHoleMeshes.length = 0;
      interactableScrewTargets.length = 0;

      const currentBoard = boardRef.current;

      // Build Spare Dock Socket Rings (up to 8 slots at y = 2.65)
      const socketRingGeo = new THREE.TorusGeometry(0.32, 0.052, 16, 32);
      const socketHoleGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 24);
      socketHoleGeo.rotateX(Math.PI / 2);

      for (let i = 0; i < 8; i++) {
        const slotX = getDockSlotWorldX(i, currentBoard.maxDockSlots);
        const ringMat = new THREE.MeshPhysicalMaterial({
          color: i < currentBoard.maxDockSlots ? 0xe5a93c : 0x38bdf8,
          roughness: 0.16,
          metalness: 0.94,
          clearcoat: 0.65,
          envMapIntensity: 2.0,
        });
        const ring = new THREE.Mesh(socketRingGeo, ringMat);
        ring.position.set(slotX, 2.65, 0.13);
        ring.visible = i < currentBoard.maxDockSlots;
        levelGroup.add(ring);
        dockHoleMeshes.push(ring);

        const holeMat = new THREE.MeshBasicMaterial({ color: 0x070a10 });
        const hole = new THREE.Mesh(socketHoleGeo, holeMat);
        hole.position.set(slotX, 2.65, 0.085);
        hole.visible = i < currentBoard.maxDockSlots;
        levelGroup.add(hole);
      }

      // Build Plates with subtle per-plate Z sub-offset & smooth level-start 3D drop-in entrance
      currentBoard.plates.forEach((plateState, pIdx) => {
        const holeCoords: { x: number; y: number }[] = [];
        for (const sId of plateState.initialScrewIds) {
          const s = currentBoard.screws.find((sc) => sc.id === sId);
          if (s) {
            holeCoords.push({ x: s.x - plateState.x, y: s.y - plateState.y });
          }
        }

        const plateZ = plateState.layer * 0.14 + (pIdx % 3) * 0.015;
        const startZ = withEntrance
          ? plateZ + 0.32 + plateState.layer * 0.08
          : plateZ;
        const pivotGroup = new THREE.Group();
        pivotGroup.position.set(plateState.pivotX, plateState.pivotY, startZ);

        const plateGroup = createCompositePlateGroup(
          plateState.id,
          plateState.shape,
          plateState.materialType,
          plateState.width,
          plateState.height,
          holeCoords,
          isSoftwareGl,
          brushedBumpMap
        );
        plateGroup.position.set(
          plateState.x - plateState.pivotX,
          plateState.y - plateState.pivotY,
          0
        );
        pivotGroup.add(plateGroup);
        levelGroup.add(pivotGroup);

        plateAnims.set(plateState.id, {
          pivotGroup,
          plateGroup,
          currZ: startZ,
          currRotZ: plateState.baseRotation,
          rotVel: 0,
          fallY: 0,
          fallVelY: 0,
          fallRotX: 0,
          clearedDone: plateState.status === 'cleared',
        });
      });

      // Build Screws with staggered 3D thread-in entrance spin & drop flush with plate grommets
      currentBoard.screws.forEach((screwState, sIdx) => {
        const screwGroup = createCompositeScrewGroup(
          screwState.color,
          screwState.id,
          brushedBumpMap
        );
        const initZ = screwState.layer * 0.14 + 0.09;
        const startZ = withEntrance
          ? initZ + 0.36 + (sIdx % 6) * 0.04
          : initZ;
        const startSpin = withEntrance ? Math.PI * 2.0 : 0;

        screwGroup.position.set(screwState.x, screwState.y, startZ);
        screwGroup.rotation.set(0, 0, startSpin);
        if (withEntrance) {
          screwGroup.scale.setScalar(0.75);
        }
        levelGroup.add(screwGroup);
        interactableScrewTargets.push(screwGroup);

        screwAnims.set(screwState.id, {
          group: screwGroup,
          currX: screwState.x,
          currY: screwState.y,
          currZ: startZ,
          spinZ: startSpin,
          shakeTimer: 0,
        });
      });
    }

    buildLevelScene(true);
    rebuildTriggerRef.current = buildLevelScene;

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Hitstop, 3D Screen-Shake Rig, Idle Guide Hand, Level Transition & Power-Up Choreography
    let hitstopTimer = 0;
    let smoothedGaugeFill = difficultyGaugeRef.current.fillRatio;
    const screenShake = createScreenShake3DState();
    const levelTrans = createLevelTransition3DState(gamePhaseRef.current);

    const urlIdleTimeout = (() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const param = params.get('idle_timeout');
        if (param !== null && param.trim() !== '') {
          const raw = Number(param);
          if (Number.isFinite(raw) && raw >= 0) return raw;
        }
      }
      return null;
    })();
    const hasUrlIdleOverride = urlIdleTimeout !== null;
    const idleHandState = createIdleHandState(
      urlIdleTimeout ?? idleThresholdRef.current
    );

    // Expose programmatic triggers for verifying Screen Shake and Idle Guide Hand
    (window as unknown as Record<string, unknown>).__torqTriggerIdleHand =
      () => {
        const targetId = findBestHintScrew(boardRef.current);
        forceIdleHand(idleHandState, targetId);
        return getIdleHandStats(idleHandState);
      };
    (window as unknown as Record<string, unknown>).__torqTriggerScreenShake = (
      kind:
        | 'plate-drop'
        | 'box-complete'
        | 'hammer'
        | 'victory' = 'box-complete'
    ) => {
      if (kind === 'plate-drop') {
        triggerPlateDropShake(screenShake, 2);
      } else if (kind === 'box-complete') {
        triggerBoxCompleteShake(screenShake, 1);
        boxCompletePopTimer = 0.42;
      } else if (kind === 'hammer') {
        triggerAuxiliaryShake(screenShake, 'hammer');
      } else {
        triggerVictoryShake(screenShake);
      }
      return getScreenShakeStats(screenShake);
    };

    const POWERUP_BUTTON_POS_X = [-2.25, -0.75, 0.75, 2.25];
    const POWERUP_SPARK_COLORS = [
      '#EF4444',
      '#38BDF8',
      '#FDE047',
      '#94A3B8',
    ];

    startTransitionRef.current = () => {
      resetIdleTimer(idleHandState);
      startLevelTransition3D(levelTrans);
    };

    triggerPowerUpAnimRef.current = (slotIdx: PowerUpSlotIndex) => {
      resetIdleTimer(idleHandState);
      triggerPowerUpActivation3D(levelTrans, slotIdx);
      const bx = POWERUP_BUTTON_POS_X[slotIdx] ?? 0;
      const color = POWERUP_SPARK_COLORS[slotIdx] ?? '#F59E0B';
      particleSystem.emitBolt(bx, -3.35, 0.35, color, 16, 4);
    };

    let hoveredScrewId: string | null = null;
    let hoveredButton3D: Button3DHandle | null = null;
    let pointerClientX = window.innerWidth * 0.5;
    let pointerClientY = window.innerHeight * 0.5;

    triggerFeedbackRef.current = (feedback) => {
      if (!feedback) return;
      resetIdleTimer(idleHandState);
      const b = boardRef.current;
      const spacing = explodedPeekRef.current ? 0.56 : 0.28;

      if (feedback.type === 'extra-slot') {
        triggerPowerUpAnimRef.current?.(1);
        particleSystem.emitBolt(2.25, 2.65, 0.3, '#38BDF8', 24, 8);
        return;
      }

      if (feedback.type === 'blocked' && feedback.screwId) {
        const anim = screwAnims.get(feedback.screwId);
        if (anim) anim.shakeTimer = 0.32;
        triggerAuxiliaryShake(screenShake, 'blocked');
      } else if (
        feedback.type === 'hammer' ||
        feedback.type === 'matched' ||
        feedback.type === 'docked' ||
        feedback.type === 'box-cleared' ||
        feedback.type === 'plate-dropped'
      ) {
        if (feedback.type === 'hammer') {
          triggerPowerUpAnimRef.current?.(0);
        }
        if (feedback.screwId) {
          const s = b.screws.find((sc) => sc.id === feedback.screwId);
          const anim = screwAnims.get(feedback.screwId);
          if (s && anim) {
            const meta = SCREW_COLOR_META[s.color];
            if (feedback.type === 'hammer') {
              hammerStrikeTimer = 0.34;
              hammerStrikePos.set(s.x, s.y, s.layer * 0.28 + 0.35);
              triggerAuxiliaryShake(screenShake, 'hammer');
            }
            const isHeavy =
              feedback.type === 'hammer' || feedback.type === 'box-cleared';
            particleSystem.emitBolt(
              anim.currX,
              anim.currY,
              anim.currZ + 0.2,
              feedback.type === 'hammer' ? '#F59E0B' : meta.accentHex,
              isHeavy ? 24 : 12,
              isHeavy ? 8 : 3
            );
            particleSystem.emitBolt(4.36, 0.12, 0.45, '#39FF14', 10, 2);
          }
        }

        const platesDropped =
          feedback.clearedPlateIds?.length || feedback.platesClearedCount || 0;
        if (platesDropped > 0 || feedback.type === 'plate-dropped') {
          triggerPlateDropShake(screenShake, Math.max(1, platesDropped));
          if (feedback.clearedPlateIds) {
            for (const plateId of feedback.clearedPlateIds) {
              const clearedPlate = b.plates.find((p) => p.id === plateId);
              if (clearedPlate) {
                particleSystem.emitPlate(clearedPlate, spacing);
              }
            }
          }
        }

        const boxesCleared = feedback.boxesClearedCount || 0;
        if (boxesCleared > 0 || feedback.type === 'box-cleared') {
          triggerBoxCompleteShake(screenShake, Math.max(1, boxesCleared));
          boxCompletePopTimer = 0.42;
          particleSystem.emitBolt(-0.78, 3.65, 0.38, '#FDE047', 18, 5);
          particleSystem.emitBolt(0.95, 3.65, 0.38, '#38BDF8', 18, 5);
        }

        if (feedback.levelWon || b.outcome === 'victory') {
          triggerVictoryShake(screenShake);
          particleSystem.emitVictory();
          victoryFireworkTimer = 1.25;
        }

        if (
          feedback.type === 'hammer' ||
          feedback.type === 'box-cleared' ||
          feedback.type === 'plate-dropped' ||
          platesDropped > 0 ||
          boxesCleared > 0
        ) {
          hitstopTimer = 0.05;
        }
      }
    };

    // 10. Unified 3D Raycasting (Both 3D GUI Buttons AND 3D Bolts!)
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    function raycast3DScene(
      clientX: number,
      clientY: number
    ): {
      screwId?: string;
      button3D?: Button3DHandle;
      nativeAdAction?: Gui3DAction;
    } {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return {};
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNdc, camera);

      const isOverlayModalOpen = overlayModalRef.current.kind !== 'none';

      // If in modal phase (title, paused, gameover) or when Sound Settings / FTUE / Conflict 3D modal is open, check 3D modal buttons first
      if (
        gamePhaseRef.current !== 'playing' ||
        soundSettingsOpenRef.current ||
        isOverlayModalOpen
      ) {
        const visibleModalBtns = modal3D.allModalButtons.filter(
          (b) => b.group.visible
        );
        const btnMeshes = visibleModalBtns.map((b) => b.group);
        const modalHits = raycaster.intersectObjects(btnMeshes, true);
        if (modalHits.length > 0) {
          let obj: THREE.Object3D | null = modalHits[0].object;
          while (obj) {
            const found = visibleModalBtns.find((b) => b.group === obj);
            if (found) return { button3D: found };
            obj = obj.parent;
          }
        }
        // If Sound Settings is open during 'playing' (without another blocking overlay), also allow clicking the top-right workbench buttons
        if (soundSettingsOpenRef.current && !isOverlayModalOpen && gamePhaseRef.current === 'playing') {
          const topUtilityBtns = [soundMenuBtn3D, muteBtn3D].filter(
            (b) => b.group.visible
          );
          if (topUtilityBtns.length > 0) {
            const topHits = raycaster.intersectObjects(
              topUtilityBtns.map((b) => b.group),
              true
            );
            if (topHits.length > 0) {
              let obj: THREE.Object3D | null = topHits[0].object;
              while (obj) {
                const found = topUtilityBtns.find((b) => b.group === obj);
                if (found) return { button3D: found };
                obj = obj.parent;
              }
            }
          }
        }
        return {};
      }

      // In 'playing' phase, check visible 3D workbench buttons first (hidden FTUE controls cannot intercept hits)
      const visibleWbBtns = workbenchButtons3D.filter((b) =>
        isHierarchyVisible(b.group)
      );
      const wbMeshes = visibleWbBtns.map((b) => b.group);
      const wbHits = raycaster.intersectObjects(wbMeshes, true);
      if (wbHits.length > 0) {
        let obj: THREE.Object3D | null = wbHits[0].object;
        while (obj) {
          const found = visibleWbBtns.find((b) => b.group === obj);
          if (found) return { button3D: found };
          obj = obj.parent;
        }
      }

      // Next check 3D Native Ad Billboards on Left and Right
      if (leftAdBillboard.group.visible) {
        const adHits = raycaster.intersectObjects(
          [leftAdBillboard.group, rightAdBillboard.group],
          true
        );
        if (adHits.length > 0) {
          let obj: THREE.Object3D | null = adHits[0].object;
          while (obj) {
            if (obj === leftAdBillboard.group) {
              return { nativeAdAction: leftAdBillboard.action };
            }
            if (obj === rightAdBillboard.group) {
              return { nativeAdAction: rightAdBillboard.action };
            }
            obj = obj.parent;
          }
        }
      }

      // Next check 3D bolts on the board
      const hits = raycaster.intersectObjects(interactableScrewTargets, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.screwId) {
            const sId = obj.userData.screwId as string;
            const sState = boardRef.current.screws.find((s) => s.id === sId);
            if (sState && sState.location === 'board') {
              return { screwId: sId };
            }
          }
          obj = obj.parent;
        }
      }
      return {};
    }

    let lastHoverTime = 0;
    const handlePointerMove = (e: PointerEvent) => {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;

      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      const { screwId, button3D, nativeAdAction } = raycast3DScene(e.clientX, e.clientY);
      hoveredButton3D = button3D ?? null;
      if ((screwId ?? null) !== hoveredScrewId) {
        hoveredScrewId = screwId ?? null;
        onHoverRef.current?.(hoveredScrewId);
      }
      renderer.domElement.style.cursor =
        screwId || button3D || nativeAdAction ? 'pointer' : 'grab';
    };

    const handlePointerDown = (e: PointerEvent) => {
      soundEngine.unlock();
      pointerDownPos = { x: e.clientX, y: e.clientY };
      const { button3D } = raycast3DScene(e.clientX, e.clientY);
      if (button3D) {
        button3D.currZ = button3D.baseZ - 0.09; // Immediate physical switch depression on touch!
        soundEngine.playButtonClick(true);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      resetIdleTimer(idleHandState);
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist < 14) {
        const { screwId, button3D, nativeAdAction } = raycast3DScene(e.clientX, e.clientY);
        if (button3D) {
          button3D.currZ = button3D.baseZ - 0.04;
          soundEngine.playButtonClick(false);
          onGuiActionRef.current(button3D.action);
        } else if (
          nativeAdAction &&
          gamePhaseRef.current === 'playing' &&
          overlayModalRef.current.kind === 'none'
        ) {
          onGuiActionRef.current(nativeAdAction);
        } else if (
          screwId &&
          gamePhaseRef.current === 'playing' &&
          !soundSettingsOpenRef.current &&
          overlayModalRef.current.kind === 'none'
        ) {
          onUnscrewRef.current(screwId);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('pointerdown', handlePointerDown);
    domElem.addEventListener('pointerup', handlePointerUp);

    // 11. ResizeObserver for Live World Projection
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const newAspect = width / height;
          const isPort = newAspect < 1.0;
          camera.aspect = newAspect;
          camera.updateProjectionMatrix();
          updateBillboardLayout(newAspect);
          const zoomZ = isPort
            ? Math.min(20.0, Math.max(13.5, 7.6 / Math.max(0.38, newAspect)))
            : (newAspect < 1.15 ? 11.4 * (1.18 / Math.max(0.7, newAspect)) : 11.8);
          if (!userOrbiting) {
            const targetY = isPort ? (gamePhaseRef.current === 'playing' ? 0.65 : 0.45) : 0.15;
            const camY = isPort ? (gamePhaseRef.current === 'playing' ? -0.15 : 0.45) : -0.55;
            camera.position.set(0, camY, zoomZ);
            controls.target.set(0, targetY, isPort && gamePhaseRef.current !== 'playing' ? 2.2 : 0);
            camera.lookAt(controls.target);
          }
          renderer.setSize(width, height);
          renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    // 12. 60fps Simulation & Software-WebGL Paced Render Loop
    let lastTimeMs = performance.now();
    const startTimeMs = lastTimeMs;
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync
          ? gl.getSyncParameter(sync, gl.SYNC_STATUS)
          : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 16);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    function tick() {
      if (isDisposed) return;
      if (typeof document !== 'undefined' && document.hidden) {
        lastTimeMs = performance.now();
        frameId = requestAnimationFrame(tick);
        return;
      }
      const nowMs = performance.now();
      const rawDt = Math.max(0.001, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;
      const dt = Math.min(rawDt, 0.05);
      const elapsed = (nowMs - startTimeMs) / 1000;

      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      }
      const simDt = hitstopTimer > 0 ? dt * 0.1 : dt;

      const currentBoard = boardRef.current;
      const phase = gamePhaseRef.current;
      const isSoundOpen = soundSettingsOpenRef.current;
      const curOverlayModal = overlayModalRef.current;
      const isOverlayOpen = curOverlayModal.kind !== 'none';
      const isAnyModalOpen = isSoundOpen || isOverlayOpen;
      const sndState = soundStateRef.current;
      const isExploded = explodedPeekRef.current;
      const layerSpacing = isExploded ? 0.36 : 0.14;

      // Step 3D Level Transition & Sequential Power-Up Charge Wave
      stepLevelTransition3D(
        levelTrans,
        phase,
        dt,
        (slotIdx) => {
          const bx = POWERUP_BUTTON_POS_X[slotIdx] ?? 0;
          const color = POWERUP_SPARK_COLORS[slotIdx] ?? '#F59E0B';
          particleSystem.emitBolt(bx, -3.35, 0.32, color, 12, 3);
        },
        isAnyModalOpen
      );
      (window as unknown as Record<string, unknown>).__torqLevelTransition =
        getLevelTransitionStats(levelTrans);

      // Smoothly slide & display 3D Workbench HUD Controls
      gui3DGroup.visible = levelTrans.hudBlend > 0.015;
      topHud3DGroup.position.y = levelTrans.topRailOffsetY;
      bottomDeck3DGroup.position.y = levelTrans.bottomDeckOffsetY;
      bottomDeck3DGroup.visible = !isAnyModalOpen;

      // Smoothly animate 3D Contextual FTUE Hint Plinth & New-Tool Unlock Plaque
      const isPortNowForHud = (camera.aspect || 1) < 1.0;
      const curHint = hintTextRef.current;
      const wantHintPlaque =
        Boolean(curHint) && phase === 'playing' && !isAnyModalOpen;
      if (wantHintPlaque) {
        ftueHintPlinth.update(curHint);
      }
      hintPlaqueBlend = THREE.MathUtils.damp(
        hintPlaqueBlend,
        wantHintPlaque ? 1 : 0,
        wantHintPlaque ? 14 : 18,
        dt
      );
      ftueHintPlinth.group.visible = hintPlaqueBlend > 0.02;
      if (ftueHintPlinth.group.visible) {
        const hintBaseY = isPortNowForHud
          ? hasBottomBoostersRef.current
            ? -2.42
            : -3.55
          : hasBottomBoostersRef.current
            ? -2.62
            : -3.48;
        const hintScale = isPortNowForHud ? 0.78 : 1.0;
        ftueHintPlinth.group.position.set(
          0,
          hintBaseY - (1 - hintPlaqueBlend) * 0.24,
          0.28
        );
        ftueHintPlinth.group.scale.setScalar(
          hintScale * Math.max(0.01, hintPlaqueBlend)
        );
      }

      const curToolToast = newToolToastRef.current;
      const wantToolPlaque =
        Boolean(curToolToast) && phase === 'playing' && !isAnyModalOpen;
      if (wantToolPlaque) {
        newToolPlaque.update(curToolToast);
      }
      toolPlaqueBlend = THREE.MathUtils.damp(
        toolPlaqueBlend,
        wantToolPlaque ? 1 : 0,
        wantToolPlaque ? 14 : 18,
        dt
      );
      newToolPlaque.group.visible = toolPlaqueBlend > 0.02;
      if (newToolPlaque.group.visible) {
        const toolBaseY = isPortNowForHud ? 5.65 : 4.5;
        const toolScale = isPortNowForHud ? 0.8 : 1.0;
        newToolPlaque.group.position.set(
          0,
          toolBaseY + (1 - toolPlaqueBlend) * 0.24,
          0.28
        );
        newToolPlaque.group.scale.setScalar(
          toolScale * Math.max(0.01, toolPlaqueBlend)
        );
      }

      // Sync 3D Diegetic Readout Plaque (with smoothly animated Difficulty Gauge) & 3D Target Trays
      const remainingBolts = currentBoard.screws.filter(
        (s) => s.location === 'board'
      ).length;
      const gauge = difficultyGaugeRef.current;
      smoothedGaugeFill = THREE.MathUtils.damp(
        smoothedGaugeFill,
        gauge.fillRatio,
        8.5,
        dt
      );
      readoutPlaque.update(
        currentBoard.levelIndex,
        currentBoard.score,
        remainingBolts,
        smoothedGaugeFill,
        gauge.accentHex,
        gauge.tierLabel
      );

      const box0 = currentBoard.activeBoxes[0];
      const box1 = currentBoard.activeBoxes[1];
      if (box0) {
        targetTray0.setColor(box0.color, !box0.completed);
      } else {
        targetTray0.group.visible = false;
      }
      if (box1) {
        targetTray1.setColor(box1.color, !box1.completed);
      } else {
        targetTray1.group.visible = false;
      }

      // Physical 3D Target Collector Tray Recoil Pop on Box Completion
      if (boxCompletePopTimer > 0) {
        boxCompletePopTimer = Math.max(0, boxCompletePopTimer - dt);
        const popPhase = 1 - boxCompletePopTimer / 0.42;
        const popBounce = 1 + Math.sin(popPhase * Math.PI) * 0.14;
        const popZ = Math.sin(popPhase * Math.PI) * 0.16;
        targetTray0.group.scale.setScalar(popBounce);
        targetTray1.group.scale.setScalar(popBounce);
        targetTray0.group.position.z = popZ;
        targetTray1.group.position.z = popZ;
      } else {
        targetTray0.group.scale.setScalar(1);
        targetTray1.group.scale.setScalar(1);
        targetTray0.group.position.z = 0;
        targetTray1.group.position.z = 0;
      }

      // Sync 3D Workbench Push-Button Textures & Spring Depressions
      updateButton3DCapTexture(
        soundMenuBtn3D,
        '♫',
        sndState.shortCode,
        sndState.accentHex,
        undefined,
        isSoundOpen,
        false
      );
      updateButton3DCapTexture(
        muteBtn3D,
        mutedRef.current ? 'MUTE' : 'SND',
        mutedRef.current ? 'OFF' : 'ON',
        '#F59E0B',
        undefined,
        !mutedRef.current
      );
      updateButton3DCapTexture(pauseBtn3D, 'II', 'PAUSE', '#F59E0B');

      const hasHammers = currentBoard.hammersRemaining > 0;
      const canExpandDock = currentBoard.maxDockSlots < 8;
      const extraSlotsAvailable = currentBoard.extraSlotsRemaining ?? 0;
      const hasSlotBoosters = extraSlotsAvailable > 0;

      // Hammer 3D Button: shows number count when available (> 0), or video icon 🎬 when zero
      updateButton3DCapTexture(
        hammerBtn3D,
        '🔨',
        currentBoard.hammerMode
          ? 'SMASH!'
          : 'HAMMER',
        currentBoard.hammerMode ? '#EF4444' : (hasHammers ? '#FDE047' : '#10B981'),
        hasHammers ? String(currentBoard.hammersRemaining) : '🎬',
        currentBoard.hammerMode,
        false
      );

      // Slot 3D Button: shows number count when available (> 0), or video icon 🎬 when zero
      if (!canExpandDock) {
        updateButton3DCapTexture(
          slotBtn3D,
          'MAX',
          '8/8',
          '#64748B',
          undefined,
          false,
          true
        );
      } else if (hasSlotBoosters) {
        // Available slot charges: displays number count just like hammer
        updateButton3DCapTexture(
          slotBtn3D,
          '+1',
          'SLOT',
          '#38BDF8',
          String(extraSlotsAvailable),
          false,
          false
        );
      } else {
        // Zero available: shows video icon 🎬 on slot
        updateButton3DCapTexture(
          slotBtn3D,
          '+1',
          'SLOT',
          '#10B981',
          '🎬',
          false,
          false
        );
      }
      updateButton3DCapTexture(
        peekBtn3D,
        '▤',
        'PEEK',
        '#F59E0B',
        undefined,
        isExploded,
        false
      );
      updateButton3DCapTexture(
        camBtn3D,
        'CAM',
        cameraPresetRef.current.toUpperCase(),
        '#94A3B8'
      );

      // Progressive FTUE visibility gating of workbench controls and side ads
      const ftueModalMeta = syncWorkbenchFtueVisibility(currentBoard.levelIndex);

      // Sync Right-Side 3D Radioactive Liquid Auto-Play Reactor
      const ap = autoPlayRef.current;
      autoPlayRig.update(
        ap.fillRatio,
        ap.chargeBolts,
        ap.targetBolts,
        ap.isReady,
        ap.autoPlaying,
        dt,
        elapsed
      );
      autoPlayRig.group.position.x = 4.36 + (1 - levelTrans.hudBlend) * 1.4;

      // Update Dual 3D Native Ad Billboards (Floating wave, neon pulse, breathing tilt)
      if (leftAdBillboard.group.visible) {
        leftAdBillboard.update(elapsed);
        rightAdBillboard.update(elapsed);
      }

      for (const b of [
        ...workbenchButtons3D,
        ...modal3D.allModalButtons,
      ]) {
        const isHovered = hoveredButton3D === b;
        const targetZ = isHovered ? b.baseZ + 0.035 : b.baseZ;
        b.currZ = THREE.MathUtils.damp(b.currZ, targetZ, 14, dt);
        b.capMesh.position.z = b.currZ;
      }

      // Apply Level-Start Power-Up Charge Wave & Activation Pulse Animations to the 4 Bottom Power-Up Buttons
      for (let i = 0; i < 4; i++) {
        const btnHandle = powerUpDeckButtons3D[i];
        const animState = levelTrans.powerUpButtons[i];
        btnHandle.group.scale.setScalar(animState.scale);
        btnHandle.group.rotation.set(animState.rotX, 0, animState.rotZ);
        btnHandle.capMesh.position.z = btnHandle.currZ + animState.zOffset;
      }

      // Sync & Smoothly Animate 3D Diegetic Modal Plinth (Title / Pause / Victory / Defeat / Sound / PGS / Recap / Conflict)
      modal3D.updateModal3D(
        phase,
        currentBoard,
        bestScoreRef.current,
        runSnapshotRef.current,
        dayStreakRef.current,
        isSoundOpen,
        sndState,
        {
          showStreakCard: ftueModalMeta.showStreakCard,
          cloudConnected: cloudConnectedRef.current,
          overlayModal: curOverlayModal,
        }
      );
      modal3D.root.visible = levelTrans.modalBlend > 0.02;
      if (modal3D.root.visible) {
        const modalEase =
          phase === 'playing' && !isAnyModalOpen
            ? levelTrans.modalBlend * levelTrans.modalBlend
            : easeOutBack(levelTrans.modalBlend, 1.25);
        modal3D.root.scale.setScalar(Math.max(0.01, modalEase));
        modal3D.root.position.y =
          0.15 +
          Math.sin(elapsed * 2.2) * 0.05 +
          (1 - modalEase) * 2.4;
        modal3D.root.rotation.x = -(1 - levelTrans.modalBlend) * 0.35;
        modal3D.root.rotation.y =
          Math.sin(elapsed * 0.9) * 0.04 +
          ((pointerClientX / Math.max(1, window.innerWidth)) - 0.5) * 0.1;
      }

      // Update dock slot visibility, position & pop animation
      for (let i = 0; i < dockHoleMeshes.length; i++) {
        const mesh = dockHoleMeshes[i];
        const isUnlocked = i < currentBoard.maxDockSlots;
        mesh.visible = isUnlocked;
        if (isUnlocked) {
          const targetX = getDockSlotWorldX(i, currentBoard.maxDockSlots);
          mesh.position.x += (targetX - mesh.position.x) * Math.min(1, dt * 12);
        }
        if (i >= 5 && mesh.visible && levelTrans.extraSlotPopTimer > 0) {
          const p = 1 - levelTrans.extraSlotPopTimer / 0.55;
          const s = easeOutBack(p, 2.2);
          mesh.scale.setScalar(Math.max(0.05, s));
          mesh.rotation.z = (1 - p) * Math.PI * 2;
        } else {
          mesh.scale.setScalar(1);
          mesh.rotation.z = 0;
        }
      }

      // Step 3D Screen-Shake Rig (Spring-Damper Recoil + Multi-Axis Pitch/Roll + Camera FOV Punch)
      stepScreenShake3D(screenShake, dt, elapsed);
      (window as unknown as Record<string, unknown>).__torqScreenShake =
        getScreenShakeStats(screenShake);

      // Modulate studio key/hemisphere lights during high-impact box completions & plate drops
      keyLight.intensity = 0.95 + screenShake.flashAlpha * 0.65;
      hemiLight.intensity = 1.15 + screenShake.flashAlpha * 0.35;

      // Apply dynamic FOV punch to camera projection matrix
      const targetFov = 44 + screenShake.fovPunch;
      if (Math.abs(camera.fov - targetFov) > 0.005) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      // Apply crisp sub-pixel viewport shake to the canvas DOM element during high-impact events
      if (
        screenShake.trauma > 0.01 ||
        Math.hypot(screenShake.offsetX, screenShake.offsetY) > 0.005
      ) {
        const pxX = (screenShake.offsetX * 18).toFixed(2);
        const pxY = (-screenShake.offsetY * 18).toFixed(2);
        const rotDeg = (screenShake.rollZ * 2.2).toFixed(3);
        renderer.domElement.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) rotate(${rotDeg}deg)`;
      } else if (renderer.domElement.style.transform !== '') {
        renderer.domElement.style.transform = '';
      }

      // Apply 3D mechanical recoil, pitch, and roll to workbench + level + diegetic HUD groups
      workbenchGroup.position.set(
        screenShake.offsetX * 0.78,
        screenShake.offsetY * 0.78,
        screenShake.offsetZ * 0.55
      );
      workbenchGroup.rotation.set(
        screenShake.pitchX * 0.65,
        0,
        screenShake.rollZ * 0.75
      );

      levelGroup.visible = !isAnyModalOpen;
      levelGroup.position.set(
        screenShake.offsetX * 1.0,
        screenShake.offsetY * 1.0,
        screenShake.offsetZ * 0.75
      );
      levelGroup.rotation.set(
        screenShake.pitchX * 0.85,
        0,
        screenShake.rollZ * 0.95
      );

      gui3DGroup.position.set(
        screenShake.offsetX * 0.65,
        screenShake.offsetY * 0.65,
        screenShake.offsetZ * 0.48
      );
      gui3DGroup.rotation.set(
        screenShake.pitchX * 0.5,
        0,
        screenShake.rollZ * 0.65
      );

      nativeAdsGroup.position.set(
        screenShake.offsetX * 0.45,
        screenShake.offsetY * 0.45,
        screenShake.offsetZ * 0.35
      );
      nativeAdsGroup.rotation.set(
        screenShake.pitchX * 0.35,
        0,
        screenShake.rollZ * 0.45
      );

      // Camera Choreography (Responsive to Portrait Mobile & Landscape Desktop)
      const aspect = camera.aspect || 1;
      const isPortraitNow = aspect < 1.0;

      const baseZoomZ = isPortraitNow
        ? Math.min(20.0, Math.max(13.5, 7.6 / Math.max(0.38, aspect)))
        : (aspect < 1.15 ? 11.4 * (1.18 / Math.max(0.7, aspect)) : 11.8);

      if (phase !== 'playing' || isAnyModalOpen) {
        // Modal / Title Screen Camera
        const modalCameraZ = isPortraitNow
          ? Math.min(18.5, Math.max(13.8, 7.2 / Math.max(0.38, aspect)))
          : 11.6;

        const parallaxX =
          ((pointerClientX / Math.max(1, window.innerWidth)) - 0.5) * (isPortraitNow ? 0.25 : 0.6);
        const parallaxY =
          ((pointerClientY / Math.max(1, window.innerHeight)) - 0.5) * (isPortraitNow ? 0.2 : 0.4);

        const targetY = isPortraitNow ? 0.45 : -0.55;

        _targetPos.set(
          Math.sin(elapsed * 0.5) * 0.2 +
          parallaxX +
          screenShake.offsetX * 0.4,
          targetY +
          Math.cos(elapsed * 0.4) * 0.15 -
          parallaxY +
          screenShake.offsetY * 0.4,
          modalCameraZ
        );
        camera.position.lerp(_targetPos, 1 - Math.exp(-5 * dt));
        controls.target.lerp(
          _vec3.set(0, isPortraitNow ? 0.45 : 0.15, isPortraitNow ? 2.2 : 0.5),
          1 - Math.exp(-5 * dt)
        );
        camera.lookAt(controls.target);
      } else if (!userOrbiting) {
        const preset = cameraPresetRef.current;
        const targetY = isPortraitNow ? -0.15 : -0.55;
        const lookY = isPortraitNow ? 0.55 : 0.15;

        if (isExploded || preset === 'angled') {
          _targetPos.set(isPortraitNow ? 1.5 : 2.2, isPortraitNow ? -1.8 : -3.2, baseZoomZ);
        } else if (preset === 'side') {
          _targetPos.set(isPortraitNow ? -2.2 : -3.4, isPortraitNow ? -1.2 : -2.0, baseZoomZ * 0.95);
        } else {
          _targetPos.set(0, targetY, baseZoomZ);
        }

        _targetPos.x += screenShake.offsetX * 0.7;
        _targetPos.y += screenShake.offsetY * 0.7;
        _targetPos.z += screenShake.offsetZ * 0.45;

        camera.position.lerp(_targetPos, 1 - Math.exp(-11 * dt));
        controls.target.lerp(
          _vec3.set(
            screenShake.offsetX * 0.35,
            lookY + screenShake.offsetY * 0.35,
            0
          ),
          1 - Math.exp(-11 * dt)
        );
        controls.update();
      } else {
        controls.update();
      }

      // Step Idle Timer & 3D Guide Hand Choreography over the optimal solver bolt
      if (!hasUrlIdleOverride) {
        idleHandState.thresholdSec = idleThresholdRef.current;
      }
      const isPlayingActiveForIdle =
        phase === 'playing' &&
        !isAnyModalOpen &&
        !activeModalOpenRef.current &&
        currentBoard.outcome === 'ongoing' &&
        !ap.autoPlaying &&
        !currentBoard.hammerMode;
      const solverBoltId = isPlayingActiveForIdle
        ? findBestHintScrew(currentBoard)
        : null;
      stepIdleHandState(
        idleHandState,
        rawDt,
        isPlayingActiveForIdle,
        solverBoltId
      );
      (window as unknown as Record<string, unknown>).__torqIdleHand =
        getIdleHandStats(idleHandState);

      // Update Plates (smooth 3D level-start scale/drop assembly, pinned, dangling, or falling off board)
      currentBoard.plates.forEach((plateState, pIdx) => {
        const anim = plateAnims.get(plateState.id);
        if (!anim) return;

        const targetZ = plateState.layer * layerSpacing + (pIdx % 3) * 0.015;
        anim.currZ = THREE.MathUtils.damp(anim.currZ, targetZ, 16, simDt);

        if (plateState.status === 'cleared') {
          if (!anim.clearedDone) {
            const prevFallY = anim.fallY;
            anim.fallVelY -= 18 * simDt;
            anim.fallY += anim.fallVelY * simDt;
            anim.fallRotX += 3.5 * simDt;
            anim.pivotGroup.position.set(
              plateState.pivotX,
              plateState.pivotY + anim.fallY,
              anim.currZ
            );
            anim.pivotGroup.rotation.set(anim.fallRotX, 0, anim.currRotZ);

            if (prevFallY >= -3.2 && anim.fallY < -3.2) {
              triggerPlateDropShake(screenShake, 1);
              particleSystem.emitBolt(
                plateState.pivotX,
                -3.35,
                0.28,
                '#F59E0B',
                16,
                5
              );
            }

            if (anim.fallY < -10) {
              anim.clearedDone = true;
              anim.pivotGroup.visible = false;
            }
          }
        } else {
          anim.pivotGroup.visible = true;
          anim.fallY = 0;
          anim.fallVelY = 0;
          anim.fallRotX = 0;

          anim.pivotGroup.position.set(
            plateState.pivotX,
            plateState.pivotY,
            anim.currZ
          );
          anim.plateGroup.position.set(
            plateState.x - plateState.pivotX,
            plateState.y - plateState.pivotY,
            0
          );

          const rotDiff = plateState.currentRotation - anim.currRotZ;
          anim.rotVel += rotDiff * 42 * simDt;
          anim.rotVel *= Math.exp(-6.5 * simDt);
          anim.currRotZ += anim.rotVel * simDt;
          anim.pivotGroup.rotation.set(0, 0, anim.currRotZ);
        }
      });

      // Update Screws (board, 3D spare dock, or physical 3D Target Collector Box socket!)
      for (let sIdx = 0; sIdx < currentBoard.screws.length; sIdx++) {
        const screwState = currentBoard.screws[sIdx];
        const anim = screwAnims.get(screwState.id);
        if (!anim) continue;

        let tx = screwState.x;
        let ty = screwState.y;
        let tz = screwState.layer * layerSpacing + 0.09;
        let targetScale = 1.0;

        if (screwState.location === 'dock') {
          const dSlot = screwState.dockSlotIndex ?? 0;
          tx = getDockSlotWorldX(dSlot, currentBoard.maxDockSlots);
          ty = 2.66;
          tz = 0.06;
          targetScale = currentBoard.maxDockSlots > 6 ? 0.72 : 0.78;
        } else if (screwState.location === 'box') {
          const activeBoxIdx = currentBoard.activeBoxes.findIndex(
            (b) => b.id === screwState.targetBoxId && !b.completed
          );
          if (activeBoxIdx === 0 || activeBoxIdx === 1) {
            const tray = activeBoxIdx === 0 ? targetTray0 : targetTray1;
            const sockPos = tray.getSocketWorldPos(
              screwState.targetBoxSlot ?? 0
            );
            tx = sockPos.x;
            ty = sockPos.y;
            tz = sockPos.z;
            targetScale = 0.62;
          } else {
            tx = 0;
            ty = 5.4;
            tz = 0.5;
            targetScale = 0.01;
          }
        }

        const isMoving =
          Math.hypot(tx - anim.currX, ty - anim.currY, tz - anim.currZ) > 0.04;
        if (screwState.location === 'board') {
          anim.spinZ = THREE.MathUtils.damp(anim.spinZ, 0, 10, simDt);
        } else if (isMoving) {
          anim.spinZ -= 22 * simDt;
        }

        anim.currX = THREE.MathUtils.damp(anim.currX, tx, 16, simDt);
        anim.currY = THREE.MathUtils.damp(anim.currY, ty, 16, simDt);
        anim.currZ = THREE.MathUtils.damp(anim.currZ, tz, 16, simDt);

        let shakeOffsetX = 0;
        if (anim.shakeTimer > 0) {
          anim.shakeTimer = Math.max(0, anim.shakeTimer - dt);
          shakeOffsetX =
            Math.sin(elapsed * 75) * 0.14 * (anim.shakeTimer / 0.32);
        }

        const isIdleTarget =
          idleHandState.isIdle && idleHandState.targetScrewId === screwState.id;

        const isSelectedOrHovered =
          screwState.location === 'board' &&
          (hoveredScrewId === screwState.id ||
            currentBoard.highlightedScrewId === screwState.id ||
            isIdleTarget);

        const hoverLift = isSelectedOrHovered ? 0.12 : 0;
        anim.group.position.set(
          anim.currX + shakeOffsetX,
          anim.currY,
          anim.currZ + hoverLift
        );
        anim.group.rotation.set(0, 0, anim.spinZ);

        const currScale = THREE.MathUtils.damp(
          anim.group.scale.x,
          targetScale,
          10,
          simDt
        );
        anim.group.scale.setScalar(currScale);
        anim.group.visible = currScale > 0.05;

        // Dynamically animate Special Bolt Variants (Unknown '?', Rainbow Prismatic, Chaotic Color-Shifting)
        const boltHeadMesh = anim.group.getObjectByName('boltHead') as
          | THREE.Mesh
          | undefined;
        const crownCapMesh = anim.group.getObjectByName('boltCrownCap') as
          | THREE.Mesh
          | undefined;
        const slotHMesh = anim.group.getObjectByName('slotH');
        const slotVMesh = anim.group.getObjectByName('slotV');
        const specialBadgeMesh = anim.group.getObjectByName('specialBadge') as
          | THREE.Mesh
          | undefined;
        const specialAuraMesh = anim.group.getObjectByName(
          'specialAuraRing'
        ) as THREE.Mesh | undefined;

        const variant = screwState.specialVariant ?? 'normal';
        const onBoard = screwState.location === 'board';
        const isUnknownHidden =
          onBoard && variant === 'unknown' && !screwState.unknownRevealed;

        if (boltHeadMesh && crownCapMesh) {
          const headMat = boltHeadMesh.material as THREE.MeshPhysicalMaterial;
          const capMat = crownCapMesh.material as THREE.MeshPhysicalMaterial;

          if (isUnknownHidden) {
            headMat.color.setHex(0x0f172a);
            capMat.color.setHex(0x1e293b);
            headMat.emissive.setHex(0x581c87);
            headMat.emissiveIntensity =
              0.35 + 0.25 * Math.sin(elapsed * 4.5 + sIdx);
            if (slotHMesh) slotHMesh.visible = false;
            if (slotVMesh) slotVMesh.visible = false;
            if (specialBadgeMesh) {
              specialBadgeMesh.visible = true;
              const bMat = specialBadgeMesh.material as THREE.MeshBasicMaterial;
              const tex = getSpecialBoltBadgeTexture('unknown');
              if (bMat.map !== tex) {
                bMat.map = tex;
                bMat.needsUpdate = true;
              }
              specialBadgeMesh.rotation.z =
                Math.sin(elapsed * 3.2 + sIdx) * 0.14;
            }
            if (specialAuraMesh) {
              specialAuraMesh.visible = true;
              const aMat = specialAuraMesh.material as THREE.MeshBasicMaterial;
              aMat.color.setHex(0xa855f7);
              aMat.opacity = 0.65 + 0.3 * Math.sin(elapsed * 5 + sIdx);
            }
          } else if (onBoard && variant === 'rainbow') {
            const hue = (elapsed * 0.52 + sIdx * 0.17) % 1.0;
            headMat.color.setHSL(hue, 0.92, 0.54);
            capMat.color.setHSL((hue + 0.15) % 1.0, 0.96, 0.68);
            headMat.emissive.setHSL(hue, 0.85, 0.35);
            headMat.emissiveIntensity = 0.38;
            if (slotHMesh) slotHMesh.visible = false;
            if (slotVMesh) slotVMesh.visible = false;
            if (specialBadgeMesh) {
              specialBadgeMesh.visible = true;
              const bMat = specialBadgeMesh.material as THREE.MeshBasicMaterial;
              const tex = getSpecialBoltBadgeTexture('rainbow');
              if (bMat.map !== tex) {
                bMat.map = tex;
                bMat.needsUpdate = true;
              }
              specialBadgeMesh.rotation.z = elapsed * 2.2 + sIdx;
            }
            if (specialAuraMesh) {
              specialAuraMesh.visible = true;
              const aMat = specialAuraMesh.material as THREE.MeshBasicMaterial;
              aMat.color.setHSL((hue + 0.3) % 1.0, 0.95, 0.62);
              aMat.opacity = 0.85;
            }
          } else if (onBoard && variant === 'chaotic') {
            const cycle =
              screwState.chaosCycleColors &&
                screwState.chaosCycleColors.length > 0
                ? screwState.chaosCycleColors
                : [screwState.color];
            const phaseVal = (elapsed * 1.65 + sIdx * 0.41) % cycle.length;
            const idx0 = Math.floor(phaseVal) % cycle.length;
            const idx1 = (idx0 + 1) % cycle.length;
            const frac = phaseVal - Math.floor(phaseVal);
            const m0 = SCREW_COLOR_META[cycle[idx0]];
            const m1 = SCREW_COLOR_META[cycle[idx1]];
            _colA.set(m0.hex);
            _colB.set(m1.hex);
            headMat.color.copy(_colA).lerp(_colB, frac);

            _colA.set(m0.accentHex);
            _colB.set(m1.accentHex);
            capMat.color.copy(_colA).lerp(_colB, frac);
            headMat.emissive.copy(headMat.color);
            headMat.emissiveIntensity =
              0.28 + 0.18 * Math.sin(elapsed * 8 + sIdx);

            if (slotHMesh) slotHMesh.visible = false;
            if (slotVMesh) slotVMesh.visible = false;
            if (specialBadgeMesh) {
              specialBadgeMesh.visible = true;
              const bMat = specialBadgeMesh.material as THREE.MeshBasicMaterial;
              const tex = getSpecialBoltBadgeTexture('chaotic');
              if (bMat.map !== tex) {
                bMat.map = tex;
                bMat.needsUpdate = true;
              }
              specialBadgeMesh.rotation.z = -elapsed * 2.8 + sIdx;
            }
            if (specialAuraMesh) {
              specialAuraMesh.visible = true;
              const aMat = specialAuraMesh.material as THREE.MeshBasicMaterial;
              aMat.color.copy(capMat.color);
              aMat.opacity = 0.72 + 0.25 * Math.sin(elapsed * 7 + sIdx);
            }
          } else {
            const trueMeta = SCREW_COLOR_META[screwState.color];
            headMat.color.set(trueMeta.hex);
            capMat.color.set(trueMeta.accentHex);
            headMat.emissive.setHex(0x000000);
            headMat.emissiveIntensity = 0;
            if (slotHMesh) slotHMesh.visible = true;
            if (slotVMesh) slotVMesh.visible = true;
            if (specialBadgeMesh) specialBadgeMesh.visible = false;
            if (specialAuraMesh) specialAuraMesh.visible = false;
          }
        }

        const ring = anim.group.getObjectByName('statusRing') as
          | THREE.Mesh
          | undefined;
        if (ring) {
          const mat = ring.material as THREE.MeshBasicMaterial;
          if (screwState.location === 'board') {
            const blocked = isScrewBlocked(screwState, currentBoard.plates);
            if (currentBoard.hammerMode) {
              mat.color.setHex(isSelectedOrHovered ? 0xef4444 : 0xf59e0b);
              mat.opacity = isSelectedOrHovered ? 0.98 : 0.72;
            } else if (
              currentBoard.highlightedScrewId === screwState.id ||
              isIdleTarget
            ) {
              mat.color.setHex(0xfde047);
              mat.opacity = 0.85 + idleHandState.ringPulse * 0.15;
            } else if (hoveredScrewId === screwState.id) {
              mat.color.setHex(blocked ? 0xef4444 : 0x38bdf8);
              mat.opacity = 0.88;
            } else {
              mat.opacity = 0;
            }
          } else {
            mat.opacity = 0;
          }
        }
      }

      // Position & Animate 3D Articulated Idle Guide Hand over the correct bolt when idle!
      if (idleHandState.revealBlend > 0.02 && idleHandState.targetScrewId) {
        const targetAnim = screwAnims.get(idleHandState.targetScrewId);
        if (targetAnim) {
          idleGuideHand.root.visible = true;
          const handScale = easeOutBack(
            Math.min(1, idleHandState.revealBlend),
            1.3
          );
          idleGuideHand.root.scale.setScalar(Math.max(0.02, handScale));
          idleGuideHand.root.position.set(
            targetAnim.currX + screenShake.offsetX,
            targetAnim.currY + screenShake.offsetY,
            targetAnim.currZ + 0.22 + screenShake.offsetZ * 0.75
          );
          idleGuideHand.handPoseGroup.position.set(
            0.38,
            -0.52,
            idleHandState.bobOffsetZ
          );
          idleGuideHand.handPoseGroup.rotation.set(
            idleHandState.wristTiltX + 0.34,
            0,
            idleHandState.wristTiltZ + 0.28
          );

          const pulseScale = 1 + idleHandState.ringPulse * 0.18;
          idleGuideHand.beaconOuterRing.scale.setScalar(pulseScale);
          idleGuideHand.beaconOuterRing.rotation.z = elapsed * 1.4;
          idleGuideHand.beaconInnerRing.scale.setScalar(
            1 + (1 - idleHandState.ringPulse) * 0.14
          );
          idleGuideHand.tipPulseMesh.scale.setScalar(
            0.9 + idleHandState.tapCompression * 0.45
          );
        } else {
          idleGuideHand.root.visible = false;
        }
      } else {
        idleGuideHand.root.visible = false;
      }

      // Update 3D Machinist's Hammer (Hovers over targeted bolt in Hammer Mode or swings down on impact)
      if (hammerStrikeTimer > 0) {
        hammerStrikeTimer = Math.max(0, hammerStrikeTimer - dt);
        hammer3D.visible = true;
        hammer3D.scale.setScalar(1.0);
        const progress = 1 - hammerStrikeTimer / 0.34;
        const swingCurve =
          progress < 0.35
            ? THREE.MathUtils.lerp(-0.55, 0.72, progress / 0.35)
            : THREE.MathUtils.lerp(0.72, -0.35, (progress - 0.35) / 0.65);
        hammer3D.position.set(
          hammerStrikePos.x + 0.45,
          hammerStrikePos.y - 0.25,
          hammerStrikePos.z + (progress < 0.35 ? 0.25 : 0.55)
        );
        hammer3D.rotation.set(0.2, -0.15, swingCurve);
      } else if (currentBoard.hammerMode && phase === 'playing' && !isAnyModalOpen) {
        hammer3D.visible = true;
        const nextHammerScale = THREE.MathUtils.damp(
          hammer3D.scale.x,
          1.0,
          14,
          dt
        );
        hammer3D.scale.setScalar(nextHammerScale);
        const targetId =
          hoveredScrewId ||
          currentBoard.selectedScrewId ||
          currentBoard.highlightedScrewId;
        const targetScrew =
          currentBoard.screws.find(
            (s) => s.id === targetId && s.location === 'board'
          ) || currentBoard.screws.find((s) => s.location === 'board');
        const hx = (targetScrew ? targetScrew.x : 0) + 0.52;
        const hy = (targetScrew ? targetScrew.y : 0) - 0.22;
        const hz =
          (targetScrew ? targetScrew.layer * layerSpacing : 0.5) +
          0.75 +
          Math.sin(elapsed * 6) * 0.08;
        hammer3D.position.x = THREE.MathUtils.damp(
          hammer3D.position.x,
          hx,
          14,
          dt
        );
        hammer3D.position.y = THREE.MathUtils.damp(
          hammer3D.position.y,
          hy,
          14,
          dt
        );
        hammer3D.position.z = THREE.MathUtils.damp(
          hammer3D.position.z,
          hz,
          14,
          dt
        );
        hammer3D.rotation.set(
          0.22,
          -0.18,
          -0.42 + Math.sin(elapsed * 5.5) * 0.1
        );
      } else {
        const nextHammerScale = THREE.MathUtils.damp(
          hammer3D.scale.x,
          0.01,
          16,
          dt
        );
        hammer3D.scale.setScalar(nextHammerScale);
        hammer3D.visible = nextHammerScale > 0.04;
      }

      // Periodic celebratory 3D spark & debris fountains while viewing Victory Plinth
      if (phase === 'gameover' && currentBoard.outcome === 'victory') {
        victoryFireworkTimer -= dt;
        if (victoryFireworkTimer <= 0) {
          particleSystem.emitVictory();
          victoryFireworkTimer = 1.45;
        }
      }

      // Advance & sync 3D Metallic Sparks + Physical 3D Debris Shards
      particleSystem.update(dt);
      (window as unknown as Record<string, unknown>).__torqParticles =
        getParticle3DStats(particleSystem.pool);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('pointerup', handlePointerUp);
      particleSystem.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="three-canvas-mount"
      className="fixed inset-0 w-screen h-screen overflow-hidden z-0"
    />
  );
};
