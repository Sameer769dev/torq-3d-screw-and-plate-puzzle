import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { GameOverlayHUD } from './components/GameOverlayHUD';
import { FtueOverlays } from './components/FtueOverlays';
import { ScrewBoardCanvas } from './components/ScrewBoardCanvas';
import { adsManager } from './game/ads';
import { analyticsManager } from './game/analytics';
import {
  advanceFtueStep,
  FtueControlKey,
  FtueState,
  getFtueHintForLevel,
  getIdleThresholdForLevel,
  getNewToolUnlockAnnouncement,
  isControlUnlocked,
  NewToolAnnouncement,
  shouldStartInPlayingPhase,
} from './game/ftue';
import {
  activateAutoPlay,
  AUTO_PLAY_TARGET_BOLTS,
  AutoPlayState,
  completeAutoPlayLevel,
  createInitialAutoPlayState,
  fuelAutoPlayToFull,
  pickNextAutoPlayScrewId,
  recordBoltExtractedForAutoPlay,
} from './game/autoPlay';
import {
  computeDifficultyGaugeState,
  createInitialDDAState,
  DDAState,
  evaluateLiveDDA,
  recordBoardCompletionDDA,
} from './game/dda';
import { Gui3DAction, ModalOverlay3DState } from './game/gui3d';
import { hapticsEngine } from './game/haptics';
import {
  advanceEndlessBoard,
  createEndlessBoard,
  findBestHintScrew,
  getSpecialBoltStats,
  isScrewBlocked,
  MAX_POSSIBLE_DOCK_SLOTS,
  refillHammerCount,
  reviveBoardState,
  toggleHammerMode,
  unlockExtraDockSlot,
  unscrewAction,
} from './game/rules';
import {
  isValidSoundscapePackId,
  soundEngine,
  SOUNDSCAPE_PACK_ORDER,
  SoundscapePackId,
  SoundSettingsState,
} from './game/sound';
import {
  DayStreakState,
  doubleDailyStreakBonus,
  loadAndRecordDailyStreak,
} from './game/streak';
import { BoardState, GamePhase, RunSnapshot } from './game/types';
import { cloudSaveManager, TorqSaveBlob } from './game/cloudSave';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';

export default function TorqGame() {
  // Support ?autostart=1, ?depth=N, ?sound_settings=1, and ?sound_pack=industrial|cybernetic|clockwork
  const initialDepth = (): number => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('depth');
      if (raw !== null && raw.trim() !== '') {
        const d = Number(raw);
        if (Number.isFinite(d) && d >= 0) return Math.floor(d);
      }
    }
    const saved = cloudSaveManager.getState();
    return saved.levelIndex ?? 0;
  };

  const [ftueState, setFtueState] = useState<FtueState>(() =>
    cloudSaveManager.recordSessionStart()
  );
  const ftueStateRef = useRef<FtueState>(ftueState);
  ftueStateRef.current = ftueState;

  const [highestLevelIndex, setHighestLevelIndex] = useState<number>(
    () => cloudSaveManager.getState().highestLevelIndex ?? 0
  );
  const highestLevelRef = useRef<number>(highestLevelIndex);
  highestLevelRef.current = highestLevelIndex;

  const [sessionRecapOpen, setSessionRecapOpen] = useState<boolean>(false);
  const [newToolToast, setNewToolToast] = useState<NewToolAnnouncement | null>(
    null
  );
  const [recentBlockedAttempt, setRecentBlockedAttempt] =
    useState<boolean>(false);
  const blockedHintTimerRef = useRef<number | null>(null);
  const sessionRecapShownRef = useRef<boolean>(false);

  const initialPhase = (): GamePhase => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
      if (params.get('title') === '1') {
        return 'title';
      }
    }
    const saved = cloudSaveManager.getState();
    return shouldStartInPlayingPhase(
      cloudSaveManager.getFtueState(),
      saved.highestLevelIndex ?? 0
    )
      ? 'playing'
      : 'title';
  };

  const initialSoundSettingsOpen = (): boolean => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sound_settings') === '1') {
        return true;
      }
    }
    return false;
  };

  const [gamePhase, setGamePhase] = useState<GamePhase>(initialPhase);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState<boolean>(
    initialSoundSettingsOpen
  );
  const [soundState, setSoundState] = useState<SoundSettingsState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const packParam = params.get('sound_pack');
      if (isValidSoundscapePackId(packParam)) {
        return soundEngine.setPack(packParam, false);
      }
    }
    return soundEngine.getState();
  });

  const [ddaState, setDdaState] = useState<DDAState>(() =>
    createInitialDDAState(initialDepth())
  );
  const ddaStateRef = useRef<DDAState>(ddaState);
  ddaStateRef.current = ddaState;

  const [board, setBoard] = useState<BoardState>(() => {
    const saved = cloudSaveManager.getState();
    const d = initialDepth();
    const b = createEndlessBoard(d, {
      carryScore: saved.cumulativeScore,
      carryHammers: saved.hammersRemaining,
      carryExtraSlots: saved.extraSlotsRemaining,
      ddaProfile: d >= 4 ? ddaState.activeProfile : undefined,
    });
    if (saved.maxDockSlots > 5) {
      b.maxDockSlots = saved.maxDockSlots;
      b.dockScrewIds = new Array(saved.maxDockSlots).fill(null);
    }
    return b;
  });
  const [bestScore, setBestScore] = useState<number>(
    () => cloudSaveManager.getState().bestScore ?? 0
  );
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.muted);
  const [explodedPeek, setExplodedPeek] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'top' | 'angled' | 'side'>(
    'top'
  );
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);
  const [dayStreak, setDayStreak] = useState<DayStreakState>(() =>
    loadAndRecordDailyStreak()
  );
  const [autoPlay, setAutoPlay] = useState<AutoPlayState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoplay_ready') === '1') {
        return createInitialAutoPlayState(
          AUTO_PLAY_TARGET_BOLTS,
          AUTO_PLAY_TARGET_BOLTS
        );
      }
    }
    const savedCharge = cloudSaveManager.getState().autoPlayChargeBolts ?? 0;
    return createInitialAutoPlayState(savedCharge, AUTO_PLAY_TARGET_BOLTS);
  });
  const autoPlayRef = useRef<AutoPlayState>(autoPlay);
  autoPlayRef.current = autoPlay;

  const runCounterRef = useRef<number>(0);

  // Google Play Games Services Cloud Save & Conflict Resolution State
  const [conflictSave, setConflictSave] = useState<{
    cloud: TorqSaveBlob;
    local: TorqSaveBlob;
  } | null>(null);

  const [pgsStatus, setPgsStatus] = useState<{
    connected: boolean;
    name: string;
  }>({
    connected: cloudSaveManager.isCloudConnected(),
    name: cloudSaveManager.getPlayerName(),
  });

  // Initialize Cloud Save silently if previously linked & log FTUE launch telemetry
  useEffect(() => {
    analyticsManager.resetLaunchClock();
    const initFtue = cloudSaveManager.getFtueState();
    const initFlags = analyticsManager.getFlags();
    analyticsManager.logEvent('ftue_launch', {
      first_session: initFtue.sessionCount === 1,
      session_count: initFtue.sessionCount,
      ab_bucket: initFlags.abBucket,
    });
    analyticsManager.logEvent('level_start', {
      level_index: board.levelIndex,
      screw_count: board.screws.length,
      layer_count: board.screws.reduce((m, s) => Math.max(m, s.layer), 0),
      ftue_active: !initFtue.completed,
    });

    cloudSaveManager.setConflictHandler((cloud, local) => {
      setConflictSave({ cloud, local });
    });

    cloudSaveManager.initialize(false).then((saveState) => {
      setPgsStatus({
        connected: cloudSaveManager.isCloudConnected(),
        name: cloudSaveManager.getPlayerName(),
      });
      setFtueState(cloudSaveManager.getFtueState());
      setHighestLevelIndex((prev) =>
        Math.max(prev, saveState.highestLevelIndex ?? 0, saveState.levelIndex ?? 0)
      );

      if (saveState.sound) {
        soundEngine.setPack(saveState.sound.packId as SoundscapePackId, false);
        setSoundState(soundEngine.getState());
      }
      if (saveState.bestScore > 0) {
        setBestScore(saveState.bestScore);
      }
      // Rebuild or hydrate board if silent cloud restore advanced saved level/boosters
      if (
        saveState.levelIndex > 0 ||
        saveState.hammersRemaining !== 3 ||
        saveState.extraSlotsRemaining !== 1 ||
        saveState.maxDockSlots > 5
      ) {
        setBoard((prev) => {
          if (prev.levelIndex !== saveState.levelIndex) {
            const restoredBoard = createEndlessBoard(saveState.levelIndex, {
              carryScore: saveState.cumulativeScore,
              carryHammers: saveState.hammersRemaining,
              carryExtraSlots: saveState.extraSlotsRemaining,
              ddaProfile:
                saveState.levelIndex >= 4
                  ? ddaStateRef.current.activeProfile
                  : undefined,
            });
            if (saveState.maxDockSlots > 5) {
              restoredBoard.maxDockSlots = saveState.maxDockSlots;
              restoredBoard.dockScrewIds = new Array(saveState.maxDockSlots).fill(
                null
              );
            }
            return restoredBoard;
          }
          return {
            ...prev,
            hammersRemaining: saveState.hammersRemaining,
            extraSlotsRemaining: saveState.extraSlotsRemaining,
            maxDockSlots: Math.max(5, saveState.maxDockSlots),
            score: saveState.cumulativeScore,
            dockScrewIds: new Array(Math.max(5, saveState.maxDockSlots)).fill(
              null
            ),
          };
        });
      }
    });
  }, []);

  // Continuous auto-save: debounced write to local storage and Google Play Games cloud
  useEffect(() => {
    cloudSaveManager.recordProgress(board, dayStreak, soundState, autoPlay.chargeBolts);
  }, [board, dayStreak, soundState, autoPlay.chargeBolts]);

  // Sync gamePhase to document.body.dataset.state immediately
  useEffect(() => {
    document.body.dataset.state = gamePhase;
  }, [gamePhase]);

  // Keep highestLevelIndex, New Tool Toast & Native Ad Visibility synchronized with FTUE rules
  const activeModalOpen = Boolean(
    conflictSave || sessionRecapOpen || soundSettingsOpen
  );
  const effectiveHighestLevel = Math.max(highestLevelIndex, board.levelIndex);
  const nativeAdsUnlocked = isControlUnlocked(
    'nativeAds',
    effectiveHighestLevel,
    ftueState,
    {
      totalDaysPlayed: dayStreak.totalDaysPlayed,
      activeModalOpen,
      nativeAdsMinLevelIndex: analyticsManager.getFlags().t4NativeAdsMinLevelIndex,
    }
  );

  useEffect(() => {
    cloudSaveManager.setNativeAdsVisible(false);
  }, []);

  useEffect(() => {
    setHighestLevelIndex((prev) => Math.max(prev, board.levelIndex));
    if (gamePhase !== 'playing') return;

    const announcement = getNewToolUnlockAnnouncement(
      board.levelIndex,
      ftueStateRef.current
    );
    if (announcement) {
      analyticsManager.logEvent('booster_unlock_seen', {
        tool: announcement.key,
        level_index: board.levelIndex,
      });
      const updated = cloudSaveManager.updateFtue((prev) => ({
        ...prev,
        unlockedToolsSeen: {
          ...prev.unlockedToolsSeen,
          [announcement.key]: true,
        },
      }));
      setFtueState(updated);
      setNewToolToast(announcement);
      soundEngine.playUiConfirm();
      hapticsEngine.pulseButtonTap();
      const t = window.setTimeout(() => setNewToolToast(null), 3200);
      return () => clearTimeout(t);
    }
    setNewToolToast(null);
  }, [board.levelIndex, gamePhase]);

  // Capacitor Native Android Lifecycle, Status Bar, Ads & Back Button Integration
  useEffect(() => {
    // Initialize Google AdMob monetization engine & ensure bottom banner is hidden
    adsManager.initialize().then(() => {
      adsManager.hideBanner();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        analyticsManager.logEvent('session_end', {
          session_count: ftueStateRef.current.sessionCount,
          highest_level_index: Math.max(highestLevelRef.current, board.levelIndex),
          ftue_completed: ftueStateRef.current.completed,
          duration_ms: elapsedSec * 1000,
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (!Capacitor.isNativePlatform()) {
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    // Force strict landscape widescreen mode for mobile gameplay
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => { });

    // Configure status bar for dark industrial HUD aesthetic & hide for full immersion
    StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
    StatusBar.setBackgroundColor({ color: '#070A0F' }).catch(() => { });
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => { });
    StatusBar.hide().catch(() => { });

    // Dismiss native splash screen once React & Three.js are active
    SplashScreen.hide().catch(() => { });

    // Handle physical / gesture Android back button navigation
    const backListenerPromise = CapApp.addListener('backButton', () => {
      if (sessionRecapOpen) {
        setSessionRecapOpen(false);
      } else if (soundSettingsOpen) {
        setSoundSettingsOpen(false);
      } else if (gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'gameover') {
        setGamePhase('title');
      } else {
        CapApp.exitApp();
      }
    });

    const appStateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        analyticsManager.logEvent('session_end', {
          session_count: ftueStateRef.current.sessionCount,
          highest_level_index: Math.max(highestLevelRef.current, board.levelIndex),
          ftue_completed: ftueStateRef.current.completed,
          duration_ms: elapsedSec * 1000,
        });
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      backListenerPromise.then((h) => h.remove()).catch(() => { });
      appStateListenerPromise.then((h) => h.remove()).catch(() => { });
    };
  }, [soundSettingsOpen, gamePhase, sessionRecapOpen, board.levelIndex, elapsedSec]);

  const handleOpenSoundSettings = useCallback(() => {
    hapticsEngine.pulseButtonTap();
    setSoundSettingsOpen(true);
    setSoundState(soundEngine.getState());
  }, []);

  const handleCloseSoundSettings = useCallback(() => {
    hapticsEngine.pulseButtonTap();
    setSoundSettingsOpen(false);
    setSoundState(soundEngine.getState());
  }, []);

  const handleSelectSoundPack = useCallback((packId: SoundscapePackId) => {
    hapticsEngine.pulseButtonTap();
    const next = soundEngine.setPack(packId, true);
    setMuted(next.muted);
    setSoundState(next);
  }, []);

  const handleCycleSoundPack = useCallback(() => {
    hapticsEngine.pulseButtonTap();
    const next = soundEngine.cyclePack(true);
    setMuted(next.muted);
    setSoundState(next);
  }, []);

  const handleCycleVolume = useCallback(() => {
    hapticsEngine.pulseButtonTap();
    const next = soundEngine.cycleVolume(true);
    hapticsEngine.enabled = !next.muted;
    setMuted(next.muted);
    setSoundState(next);
  }, []);

  const handleTestSoundPack = useCallback(() => {
    hapticsEngine.pulseButtonTap();
    soundEngine.playPackPreview();
    setSoundState(soundEngine.getState());
  }, []);

  const handleToggleMute = useCallback(() => {
    const isNowMuted = soundEngine.toggleMute();
    hapticsEngine.enabled = !isNowMuted;
    setMuted(isNowMuted);
    setSoundState(soundEngine.getState());
  }, []);

  // Expose deterministic state & real-time DDA + Soundscape + Ads + FTUE inspection helpers
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__torqDDA = ddaState;
    (window as unknown as Record<string, unknown>).__torqAds = adsManager;
    (window as unknown as Record<string, unknown>).__torqFtue = ftueState;
    (window as unknown as Record<string, unknown>).__torqAnalytics = analyticsManager;
    (window as unknown as Record<string, unknown>).__torqSound = {
      openMenu: () => handleOpenSoundSettings(),
      closeMenu: () => handleCloseSoundSettings(),
      selectPack: (packId: SoundscapePackId) => handleSelectSoundPack(packId),
      setPack: (packId: SoundscapePackId) => handleSelectSoundPack(packId),
      cyclePack: () => handleCycleSoundPack(),
      cycleVolume: () => handleCycleVolume(),
      testPack: () => handleTestSoundPack(),
      getState: () => soundEngine.getState(),
      availablePacks: SOUNDSCAPE_PACK_ORDER,
    };
    (window as unknown as Record<string, unknown>).render_game_to_text = () => {
      const boltsLeft = board.screws.filter(
        (s) => s.location === 'board'
      ).length;
      const platesLeft = board.plates.filter(
        (p) => p.status !== 'cleared'
      ).length;
      const maxLayer = board.screws.reduce((m, s) => Math.max(m, s.layer), 0);
      const gauge = computeDifficultyGaugeState(
        board.levelIndex,
        board.screws.length,
        maxLayer,
        ddaState.difficultyMultiplier
      );
      const currentSnd = soundEngine.getState();
      return JSON.stringify({
        phase: gamePhase,
        soundSettingsOpen,
        soundSettings: {
          open: soundSettingsOpen,
          activePack: currentSnd.activePack,
          packName: currentSnd.packName,
          shortCode: currentSnd.shortCode,
          tagline: currentSnd.tagline,
          waveformTag: currentSnd.waveformTag,
          muted: currentSnd.muted,
          volumePercent: currentSnd.volumePercent,
          previewCount: currentSnd.previewCount,
          lastPlayedEvent: currentSnd.lastPlayedEvent,
          availablePacks: SOUNDSCAPE_PACK_ORDER,
        },
        levelIndex: board.levelIndex,
        levelNumber: board.levelIndex + 1,
        levelName: board.levelName,
        score: board.score,
        bestScore: Math.max(bestScore, board.score),
        boltsLeft,
        totalScrews: board.screws.length,
        platesLeft,
        totalPlates: board.plates.length,
        maxLayer,
        completedBoxes: board.completedBoxCount,
        totalBoxes: board.totalBoxes,
        dockUsed: board.dockScrewIds.filter(Boolean).length,
        maxDockSlots: board.maxDockSlots,
        hammersRemaining: board.hammersRemaining,
        hammerMode: board.hammerMode,
        extraSlotUsed: board.extraSlotUsed,
        nextSolverScrewId: findBestHintScrew(board),
        outcome: board.outcome,
        difficultyGauge: gauge,
        dayStreak: {
          currentStreak: dayStreak.currentStreak,
          bestStreak: dayStreak.bestStreak,
          lastPlayedDate: dayStreak.lastPlayedDate,
          totalDaysPlayed: dayStreak.totalDaysPlayed,
          status: dayStreak.status,
          rewardTier: dayStreak.rewardTier,
          rewardLabel: dayStreak.rewardLabel,
          rewardBonusPoints: dayStreak.rewardBonusPoints,
          cycleDayIndex: dayStreak.cycleDayIndex,
        },
        autoPlay: {
          chargeBolts: autoPlay.chargeBolts,
          targetBolts: autoPlay.targetBolts,
          fillRatio: autoPlay.fillRatio,
          percent: autoPlay.percent,
          isReady: autoPlay.isReady,
          autoPlaying: autoPlay.autoPlaying,
          totalActivations: autoPlay.totalActivations,
        },
        dda: {
          band: ddaState.activeProfile.band,
          skillRating: ddaState.skillRating,
          difficultyMultiplier: ddaState.difficultyMultiplier,
          rollingSolveSpeed: ddaState.rollingSolveSpeed,
          rollingComboFrequency: ddaState.rollingComboFrequency,
          lastSolveTimeSec: ddaState.lastSolveTimeSec,
          lastComboFrequency: ddaState.lastComboFrequency,
          boardsAnalyzed: ddaState.boardsAnalyzed,
          nextTargetBoxes: ddaState.activeProfile.targetBoxes,
          nextTargetLayers: ddaState.activeProfile.targetLayers,
          nextTargetColors: ddaState.activeProfile.targetColors,
          nextDockInterleaveLimit: ddaState.activeProfile.dockInterleaveLimit,
        },
        screenShake:
          (window as unknown as Record<string, unknown>).__torqScreenShake ??
          null,
        idleHand:
          (window as unknown as Record<string, unknown>).__torqIdleHand ?? null,
        specialBolts: getSpecialBoltStats(board),
        ftue: ftueState,
      });
    };
  }, [
    board,
    gamePhase,
    soundSettingsOpen,
    soundState,
    bestScore,
    ddaState,
    dayStreak,
    autoPlay,
    handleOpenSoundSettings,
    handleCloseSoundSettings,
    handleSelectSoundPack,
    handleCycleSoundPack,
    handleCycleVolume,
    handleTestSoundPack,
  ]);

  // Elapsed timer when in 'playing' state and Sound Settings Menu is closed
  useEffect(() => {
    if (gamePhase !== 'playing' || soundSettingsOpen) return;
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gamePhase, soundSettingsOpen]);

  const advanceFromWonBoard = useCallback(() => {
    setExplodedPeek(false);
    setRecentBlockedAttempt(false);
    setAutoPlay((prev) => completeAutoPlayLevel(prev));
    setBoard((prev) => {
      if (prev.outcome !== 'victory') return prev;
      const nextDepth = prev.levelIndex + 1;
      const nextB = advanceEndlessBoard(
        prev,
        undefined,
        nextDepth >= 4 ? ddaStateRef.current.activeProfile : undefined
      );
      analyticsManager.logEvent('level_start', {
        level_index: nextB.levelIndex,
        screw_count: nextB.screws.length,
        layer_count: nextB.screws.reduce((m, s) => Math.max(m, s.layer), 0),
        ftue_active: !ftueStateRef.current.completed,
      });
      if (
        prev.levelIndex === 8 &&
        ftueStateRef.current.sessionCount === 1 &&
        !sessionRecapShownRef.current
      ) {
        sessionRecapShownRef.current = true;
        setSessionRecapOpen(true);
      }
      return nextB;
    });
  }, []);

  // Seamless Endless Progression (100% Automatic Background Cloud Save, Zero Ad Interruptions)
  useEffect(() => {
    if (gamePhase !== 'playing' || board.outcome !== 'victory') {
      return;
    }

    const timer = window.setTimeout(() => {
      advanceFromWonBoard();
    }, 650);

    return () => clearTimeout(timer);
  }, [gamePhase, board.outcome, board.levelIndex, advanceFromWonBoard]);

  const startGame = useCallback((depth?: number) => {
    const saved = cloudSaveManager.getState();
    const targetDepth = depth ?? saved.levelIndex ?? 0;
    const runNumber = runCounterRef.current++;
    const seed =
      runNumber === 0
        ? undefined
        : (targetDepth + 1) * 7919 + 104729 + runNumber * 1337;
    const freshDDA = createInitialDDAState(targetDepth);
    ddaStateRef.current = freshDDA;
    setDdaState(freshDDA);

    const freshBoard = createEndlessBoard(targetDepth, {
      seed,
      carryScore: saved.cumulativeScore,
      carryHammers: saved.hammersRemaining,
      carryExtraSlots: saved.extraSlotsRemaining,
      ddaProfile: targetDepth >= 4 ? freshDDA.activeProfile : undefined,
    });
    if (saved.maxDockSlots > 5) {
      freshBoard.maxDockSlots = saved.maxDockSlots;
      freshBoard.dockScrewIds = new Array(saved.maxDockSlots).fill(null);
    }
    setBoard(freshBoard);
    setDayStreak(loadAndRecordDailyStreak());
    setElapsedSec(0);
    setExplodedPeek(false);
    setSoundSettingsOpen(false);
    setRunSnapshot(null);
    document.body.dataset.state = 'playing';
    setGamePhase('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const recordToolFirstUse = useCallback(
    (tool: FtueControlKey, levelIndex: number) => {
      if (ftueStateRef.current.firstUseRecorded[tool]) return;
      analyticsManager.logEvent('booster_first_use', {
        tool,
        level_index: levelIndex,
      });
      const next = cloudSaveManager.updateFtue((prev) => ({
        ...prev,
        firstUseRecorded: {
          ...prev.firstUseRecorded,
          [tool]: true,
        },
      }));
      setFtueState(next);
    },
    []
  );

  const handleUnscrewAttempt = useCallback(
    (screwId: string, isAutoPlayStep = false) => {
      if (gamePhase !== 'playing' || soundSettingsOpen || sessionRecapOpen) return;

      if (!isAutoPlayStep && analyticsManager.logFirstTapIfNeeded(board.levelIndex)) {
        const nextFtue = cloudSaveManager.updateFtue((prev) =>
          advanceFtueStep(prev, 'L1_Guided')
        );
        setFtueState(nextFtue);
        analyticsManager.logEvent('ftue_step', {
          step: nextFtue.step,
          level_index: board.levelIndex,
          elapsed_ms: elapsedSec * 1000,
        });
      }

      setBoard((prevBoard) => {
        const prevBoxes = prevBoard.completedBoxCount;
        const prevClearedPlates = prevBoard.plates.filter(
          (p) => p.status === 'cleared'
        ).length;

        const nextBoard = unscrewAction(
          prevBoard,
          screwId,
          false,
          isAutoPlayStep
        );

        // Trigger procedural audio from the active Soundscape Pack and Navigator.vibrate haptics
        if (nextBoard.lastActionFeedback?.type === 'blocked') {
          soundEngine.playBlocked();
          setSoundState(soundEngine.getState());
          hapticsEngine.pulseBlocked();
          setRecentBlockedAttempt(true);
          if (blockedHintTimerRef.current) {
            window.clearTimeout(blockedHintTimerRef.current);
          }
          blockedHintTimerRef.current = window.setTimeout(() => {
            setRecentBlockedAttempt(false);
          }, 3200);
        } else if (nextBoard.movesCount > prevBoard.movesCount) {
          setRecentBlockedAttempt(false);
          const remOnBoard = nextBoard.screws.filter(
            (s) => s.location === 'board'
          ).length;
          setAutoPlay((prevAp) =>
            recordBoltExtractedForAutoPlay(
              prevAp,
              1,
              remOnBoard,
              nextBoard.screws.length
            )
          );

          const usedHammer = nextBoard.lastActionFeedback?.type === 'hammer';
          const matched =
            nextBoard.lastActionFeedback?.type === 'matched' ||
            nextBoard.lastActionFeedback?.type === 'box-cleared';

          if (usedHammer) {
            soundEngine.playHammerStrike();
          } else {
            soundEngine.playUnscrew(matched, nextBoard.combo);
          }

          const droppedPlate = nextBoard.plates.find(
            (p, idx) =>
              p.status === 'cleared' && prevBoard.plates[idx]?.status !== 'cleared'
          );
          const newClearedPlates = nextBoard.plates.filter(
            (p) => p.status === 'cleared'
          ).length;
          if (droppedPlate || newClearedPlates > prevClearedPlates) {
            soundEngine.playPlateDrop(droppedPlate?.materialType);
          }
          if (nextBoard.completedBoxCount > prevBoxes) {
            soundEngine.playBoxComplete();
          }
          setSoundState(soundEngine.getState());

          // Real-time DDA Telemetry Update on every bolt unscrew
          const elapsedBoardSec = Math.max(
            0.25,
            (Date.now() - nextBoard.boardStartedAtMs) / 1000
          );
          const boltsCleared = nextBoard.screws.filter(
            (s) => s.location !== 'board'
          ).length;

          if (nextBoard.outcome === 'ongoing') {
            const liveDDA = evaluateLiveDDA(
              ddaStateRef.current,
              nextBoard.levelIndex,
              elapsedBoardSec,
              nextBoard.parTimeSec,
              nextBoard.comboMatchMoves,
              nextBoard.movesCount,
              nextBoard.maxCombo,
              boltsCleared,
              nextBoard.screws.length
            );
            ddaStateRef.current = liveDDA;
            setDdaState(liveDDA);

            if (usedHammer) {
              hapticsEngine.pulseHammerStrike();
            } else if (nextBoard.completedBoxCount > prevBoxes) {
              hapticsEngine.pulseBoxComplete();
            } else if (newClearedPlates > prevClearedPlates) {
              hapticsEngine.pulsePlateDrop();
            } else {
              hapticsEngine.pulseUnscrew(matched);
            }
          }
        }

        // Check if board was cleared (Seamless DDA-Tuned Endless Advance) or Dock Jammed (Defeat)
        if (nextBoard.outcome !== 'ongoing' && prevBoard.outcome === 'ongoing') {
          const solveTimeSec = Math.max(
            0.5,
            (Date.now() - nextBoard.boardStartedAtMs) / 1000
          );

          if (nextBoard.outcome === 'victory') {
            const updatedDDA = recordBoardCompletionDDA(ddaStateRef.current, {
              depth: nextBoard.levelIndex,
              solveTimeSec,
              parTimeSec: nextBoard.parTimeSec,
              totalMoves: nextBoard.movesCount,
              comboMatchMoves: nextBoard.comboMatchMoves,
              peakCombo: nextBoard.maxCombo,
              totalScrews: nextBoard.screws.length,
            });
            ddaStateRef.current = updatedDDA;
            setDdaState(updatedDDA);

            soundEngine.playVictory();
            setSoundState(soundEngine.getState());
            hapticsEngine.pulseLevelComplete();
            setBestScore((b) => Math.max(b, nextBoard.score));

            analyticsManager.logEvent('level_complete', {
              level_index: nextBoard.levelIndex,
              duration_ms: Math.round(solveTimeSec * 1000),
              moves_count: nextBoard.movesCount,
              peak_combo: nextBoard.maxCombo,
              boosters_used: nextBoard.extraSlotUsed ? 1 : 0,
            });

            const targetFtueStep =
              nextBoard.levelIndex === 0
                ? 'CoreLearned'
                : nextBoard.levelIndex === 1
                  ? 'LayersLearned'
                  : nextBoard.levelIndex === 2
                    ? 'SignInOffered'
                    : nextBoard.levelIndex === 3
                      ? 'DockLearned'
                      : nextBoard.levelIndex <= 5
                        ? 'SlotTaught'
                        : nextBoard.levelIndex === 6
                          ? 'HammerTaught'
                          : nextBoard.levelIndex === 7
                            ? 'PeekTaught'
                            : 'FTUEComplete';
            const nextFtue = cloudSaveManager.updateFtue((prev) =>
              advanceFtueStep(prev, targetFtueStep)
            );
            setFtueState(nextFtue);
            analyticsManager.logEvent('ftue_step', {
              step: nextFtue.step,
              level_index: nextBoard.levelIndex,
              elapsed_ms: Math.round(solveTimeSec * 1000),
            });
          } else if (nextBoard.outcome === 'defeat') {
            analyticsManager.logEvent('level_fail', {
              level_index: nextBoard.levelIndex,
              duration_ms: Math.round(solveTimeSec * 1000),
              reason: nextBoard.defeatReason ?? 'Dock Jammed',
            });
            const screwsCleared = nextBoard.screws.filter(
              (s) => s.location !== 'board'
            ).length;
            const platesCleared = nextBoard.plates.filter(
              (p) => p.status === 'cleared'
            ).length;

            const snapshot: RunSnapshot = {
              outcome: 'defeat',
              levelIndex: nextBoard.levelIndex,
              levelName: nextBoard.levelName,
              score: nextBoard.score,
              bestScore: Math.max(bestScore, nextBoard.score),
              elapsedSec,
              parTimeSec: nextBoard.parTimeSec,
              screwsCleared,
              totalScrews: nextBoard.screws.length,
              platesCleared,
              totalPlates: nextBoard.plates.length,
              maxCombo: nextBoard.maxCombo,
              movesCount: nextBoard.movesCount,
              defeatReason: nextBoard.defeatReason,
            };

            soundEngine.playDefeat();
            setSoundState(soundEngine.getState());
            hapticsEngine.pulseDefeat();
            setBestScore((b) => Math.max(b, nextBoard.score));
            setRunSnapshot(snapshot);
            document.body.dataset.state = 'gameover';
            setGamePhase('gameover');
          }
        }

        return nextBoard;
      });
    },
    [
      gamePhase,
      soundSettingsOpen,
      sessionRecapOpen,
      bestScore,
      elapsedSec,
      board.levelIndex,
    ]
  );

  const handleRefillHammerAd = useCallback(async () => {
    hapticsEngine.pulseButtonTap();
    setBoard((prev) => toggleHammerMode(refillHammerCount(prev, 1)));
    soundEngine.playToolActivate('hammer_arm');
    setSoundState(soundEngine.getState());
  }, []);

  const handleHammer = useCallback(async () => {
    if (gamePhase !== 'playing' || soundSettingsOpen) return;
    recordToolFirstUse('hammer', board.levelIndex);
    if (board.hammersRemaining <= 0) {
      await handleRefillHammerAd();
      return;
    }
    if (!board.hammerMode) {
      soundEngine.playToolActivate('hammer_arm');
    } else {
      soundEngine.playUiConfirm();
    }
    setSoundState(soundEngine.getState());
    setBoard((prev) => toggleHammerMode(prev));
  }, [gamePhase, soundSettingsOpen, board.hammersRemaining, board.hammerMode, board.levelIndex, handleRefillHammerAd, recordToolFirstUse]);

  const handleExtraSlot = useCallback(async () => {
    recordToolFirstUse('slot', board.levelIndex);
    if (board.maxDockSlots >= MAX_POSSIBLE_DOCK_SLOTS) {
      soundEngine.playBlocked();
      setSoundState(soundEngine.getState());
      setBoard((prev) => ({
        ...prev,
        lastActionFeedback: {
          type: 'blocked',
          message: 'MAX DOCK CAPACITY REACHED (8 SLOTS)!',
          timestamp: Date.now(),
        },
      }));
      return;
    }

    hapticsEngine.pulseButtonTap();
    setBoard((prev) => unlockExtraDockSlot(prev));
    soundEngine.playToolActivate('slot_expand');
    setSoundState(soundEngine.getState());
  }, [board.maxDockSlots, board.levelIndex, recordToolFirstUse]);

  const handleResolveConflict = useCallback(
    (choice: 'smart_merge' | 'keep_cloud' | 'keep_local') => {
      if (!conflictSave) return;
      const resolved = cloudSaveManager.applyConflictChoice(
        conflictSave.cloud,
        conflictSave.local,
        choice
      );
      setConflictSave(null);
      setFtueState(cloudSaveManager.getFtueState());
      setHighestLevelIndex((prev) =>
        Math.max(prev, resolved.highestLevelIndex ?? 0, resolved.levelIndex ?? 0)
      );
      setBoard((prev) => {
        if (prev.levelIndex !== resolved.levelIndex) {
          const rebuilt = createEndlessBoard(resolved.levelIndex, {
            carryScore: resolved.cumulativeScore,
            carryHammers: resolved.hammersRemaining,
            carryExtraSlots: resolved.extraSlotsRemaining,
            ddaProfile:
              resolved.levelIndex >= 4
                ? ddaStateRef.current.activeProfile
                : undefined,
          });
          if (resolved.maxDockSlots > 5) {
            rebuilt.maxDockSlots = resolved.maxDockSlots;
            rebuilt.dockScrewIds = new Array(resolved.maxDockSlots).fill(null);
          }
          return rebuilt;
        }
        return {
          ...prev,
          hammersRemaining: resolved.hammersRemaining,
          extraSlotsRemaining: resolved.extraSlotsRemaining,
          maxDockSlots: Math.max(5, resolved.maxDockSlots),
          score: resolved.cumulativeScore,
          dockScrewIds: new Array(Math.max(5, resolved.maxDockSlots)).fill(null),
        };
      });
      setBestScore(resolved.bestScore);
      soundEngine.playUiConfirm();
      setSoundState(soundEngine.getState());
    },
    [conflictSave]
  );

  const handleLinkPlayGames = useCallback(async () => {
    try {
      const res = await cloudSaveManager.linkPlayGamesAndSync();
      setPgsStatus({ connected: res.connected, name: res.playerName });
      const updatedSave = cloudSaveManager.getState();
      setFtueState(cloudSaveManager.getFtueState());
      setHighestLevelIndex((prev) =>
        Math.max(prev, updatedSave.highestLevelIndex ?? 0, updatedSave.levelIndex ?? 0)
      );
      if (updatedSave.bestScore > 0) {
        setBestScore((prev) => Math.max(prev, updatedSave.bestScore));
      }
      if (updatedSave.levelIndex > board.levelIndex) {
        const syncedBoard = createEndlessBoard(updatedSave.levelIndex, {
          carryScore: updatedSave.cumulativeScore,
          carryHammers: updatedSave.hammersRemaining,
          carryExtraSlots: updatedSave.extraSlotsRemaining,
          ddaProfile:
            updatedSave.levelIndex >= 4
              ? ddaStateRef.current.activeProfile
              : undefined,
        });
        setBoard(syncedBoard);
      }
      return res.connected;
    } catch {
      return false;
    }
  }, [board.levelIndex]);

  const handleReviveAd = useCallback(async () => {
    hapticsEngine.pulseLevelComplete();
    setBoard((prev) => reviveBoardState(prev));
    document.body.dataset.state = 'playing';
    setGamePhase('playing');
    soundEngine.playUiConfirm();
    setSoundState(soundEngine.getState());
  }, []);

  const handleFuelAutoPlayAd = useCallback(async () => {
    hapticsEngine.pulseBoxComplete();
    setAutoPlay((prev) => activateAutoPlay(fuelAutoPlayToFull(prev)));
    soundEngine.playToolActivate('auto_play');
    setSoundState(soundEngine.getState());
  }, []);

  const handleDoubleStreakAd = useCallback(async () => {
    hapticsEngine.pulseLevelComplete();
    setDayStreak((prev) => doubleDailyStreakBonus(prev));
    setBestScore((prev) => prev + dayStreak.rewardBonusPoints);
    soundEngine.playUiConfirm();
    setSoundState(soundEngine.getState());
  }, [dayStreak.rewardBonusPoints]);

  const handlePauseToggle = useCallback(() => {
    setSoundSettingsOpen(false);
    setGamePhase((prev) => {
      if (prev === 'playing') {
        document.body.dataset.state = 'paused';
        return 'paused';
      }
      if (prev === 'paused') {
        document.body.dataset.state = 'playing';
        return 'playing';
      }
      return prev;
    });
  }, []);

  const handleRestartLevel = useCallback(() => {
    startGame(board.levelIndex);
  }, [startGame, board.levelIndex]);

  const handleReturnTitle = useCallback(() => {
    setSoundSettingsOpen(false);
    setRunSnapshot(null);
    document.body.dataset.state = 'title';
    setGamePhase('title');
  }, []);

  const handleCycleCamera = useCallback(() => {
    recordToolFirstUse('cam', board.levelIndex);
    soundEngine.playToolActivate('cam');
    setSoundState(soundEngine.getState());
    setCameraPreset((prev) =>
      prev === 'top' ? 'angled' : prev === 'angled' ? 'side' : 'top'
    );
  }, [board.levelIndex, recordToolFirstUse]);

  const handleAutoPlay = useCallback(() => {
    if (gamePhase !== 'playing' || soundSettingsOpen) return;
    recordToolFirstUse('autoPlay', board.levelIndex);
    if (!autoPlay.isReady && !autoPlay.autoPlaying) {
      soundEngine.playBlocked();
      setSoundState(soundEngine.getState());
      hapticsEngine.pulseBlocked();
      setBoard((prev) => ({
        ...prev,
        lastActionFeedback: {
          type: 'blocked',
          message: `Auto-Play Reactor charging: ${autoPlay.percent}% (${autoPlay.chargeBolts}/${autoPlay.targetBolts} bolts)`,
          timestamp: Date.now(),
        },
      }));
      return;
    }
    setAutoPlay((prev) => {
      if (!prev.isReady || prev.autoPlaying) return prev;
      hapticsEngine.pulseBoxComplete();
      soundEngine.playToolActivate('auto_play');
      setSoundState(soundEngine.getState());
      return activateAutoPlay(prev);
    });
  }, [
    gamePhase,
    soundSettingsOpen,
    board.levelIndex,
    autoPlay.isReady,
    autoPlay.autoPlaying,
    autoPlay.percent,
    autoPlay.chargeBolts,
    autoPlay.targetBolts,
    recordToolFirstUse,
  ]);

  // Autonomous solver loop when 3D Radioactive Auto-Play is activated!
  useEffect(() => {
    if (
      gamePhase !== 'playing' ||
      soundSettingsOpen ||
      !autoPlay.autoPlaying ||
      board.outcome !== 'ongoing'
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextScrewId = pickNextAutoPlayScrewId(board);
      if (nextScrewId) {
        handleUnscrewAttempt(nextScrewId, true);
      } else {
        setAutoPlay((prev) => completeAutoPlayLevel(prev));
      }
    }, 135);

    return () => clearTimeout(timer);
  }, [
    gamePhase,
    soundSettingsOpen,
    autoPlay.autoPlaying,
    board,
    handleUnscrewAttempt,
  ]);

  // Unified Keyboard Input Hub (Edge-triggered actions + Focus-loss cleanup)
  const keysHeldRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keysHeldRef.current.has(e.code)) return;
      keysHeldRef.current.add(e.code);

      // When Sound Settings Menu is open, handle Soundscape Pack selection & closing
      if (soundSettingsOpen) {
        if (e.code === 'Digit1') {
          handleSelectSoundPack('industrial');
        } else if (e.code === 'Digit2') {
          handleSelectSoundPack('cybernetic');
        } else if (e.code === 'Digit3') {
          handleSelectSoundPack('clockwork');
        } else if (e.code === 'KeyV') {
          handleCycleSoundPack();
        } else if (e.code === 'KeyT') {
          handleTestSoundPack();
        } else if (e.code === 'KeyM') {
          handleToggleMute();
        } else if (
          e.code === 'Escape' ||
          e.code === 'Enter' ||
          e.code === 'Space' ||
          e.code === 'KeyO'
        ) {
          e.preventDefault();
          handleCloseSoundSettings();
        }
        return;
      }

      if (e.code === 'KeyO') {
        handleOpenSoundSettings();
        return;
      }
      if (e.code === 'KeyV') {
        handleCycleSoundPack();
        return;
      }

      if (gamePhase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame(board.levelIndex);
        }
        return;
      }

      if (gamePhase === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame(board.levelIndex);
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        handlePauseToggle();
        return;
      }

      if (gamePhase !== 'playing') return;

      if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyR') {
        handleRestartLevel();
      } else if (e.code === 'KeyH') {
        handleHammer();
      } else if (e.code === 'KeyB') {
        handleExtraSlot();
      } else if (e.code === 'KeyE') {
        setExplodedPeek((v) => !v);
      } else if (e.code === 'KeyC') {
        handleCycleCamera();
      } else if (e.code === 'KeyQ' || e.code === 'KeyF') {
        handleAutoPlay();
      } else if (e.code.startsWith('Digit')) {
        const digit = parseInt(e.code.replace('Digit', ''), 10);
        if (digit >= 1 && digit <= 9) {
          const candidates = board.screws.filter(
            (s) =>
              s.location === 'board' &&
              (board.hammerMode || !isScrewBlocked(s, board.plates))
          );
          const target = candidates[digit - 1];
          if (target) {
            handleUnscrewAttempt(target.id);
          }
        }
      } else if (
        e.code === 'ArrowRight' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowLeft' ||
        e.code === 'KeyA' ||
        e.code === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyS'
      ) {
        const candidates = board.screws.filter(
          (s) =>
            s.location === 'board' &&
            (board.hammerMode || !isScrewBlocked(s, board.plates))
        );
        if (candidates.length > 0) {
          const currIdx = candidates.findIndex(
            (s) => s.id === board.selectedScrewId
          );
          const delta =
            e.code === 'ArrowRight' ||
              e.code === 'KeyD' ||
              e.code === 'ArrowDown' ||
              e.code === 'KeyS'
              ? 1
              : -1;
          const nextIdx =
            ((currIdx + delta) % candidates.length + candidates.length) %
            candidates.length;
          setBoard((prev) => ({
            ...prev,
            selectedScrewId: candidates[nextIdx].id,
            highlightedScrewId: candidates[nextIdx].id,
          }));
        }
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const targetId =
          board.highlightedScrewId ||
          board.selectedScrewId ||
          board.screws.find(
            (s) =>
              s.location === 'board' &&
              (board.hammerMode || !isScrewBlocked(s, board.plates))
          )?.id;
        if (targetId) {
          handleUnscrewAttempt(targetId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearHeldKeys = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearHeldKeys);
    document.addEventListener('visibilitychange', clearHeldKeys);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeldKeys);
      document.removeEventListener('visibilitychange', clearHeldKeys);
    };
  }, [
    gamePhase,
    soundSettingsOpen,
    board,
    startGame,
    handlePauseToggle,
    handleToggleMute,
    handleOpenSoundSettings,
    handleCloseSoundSettings,
    handleSelectSoundPack,
    handleCycleSoundPack,
    handleTestSoundPack,
    handleRestartLevel,
    handleHammer,
    handleExtraSlot,
    handleCycleCamera,
    handleAutoPlay,
    handleUnscrewAttempt,
  ]);

  const handleGui3DAction = useCallback(
    (action: Gui3DAction) => {
      hapticsEngine.pulseButtonTap();
      switch (action.type) {
        case 'start_game':
          startGame(action.levelIdx ?? board.levelIndex);
          break;
        case 'hammer':
          handleHammer();
          break;
        case 'extra_slot':
          handleExtraSlot();
          break;
        case 'toggle_explode':
          recordToolFirstUse('peek', board.levelIndex);
          soundEngine.playToolActivate(explodedPeek ? 'peek_close' : 'peek_open');
          setSoundState(soundEngine.getState());
          setExplodedPeek((v) => !v);
          break;
        case 'cycle_camera':
          handleCycleCamera();
          break;
        case 'toggle_mute':
          handleToggleMute();
          break;
        case 'open_sound_settings':
          if (soundSettingsOpen) {
            handleCloseSoundSettings();
          } else {
            handleOpenSoundSettings();
          }
          break;
        case 'close_sound_settings':
          handleCloseSoundSettings();
          break;
        case 'select_sound_pack':
          handleSelectSoundPack(action.packId);
          break;
        case 'cycle_sound_pack':
          handleCycleSoundPack();
          break;
        case 'cycle_volume':
          handleCycleVolume();
          break;
        case 'test_sound_pack':
          handleTestSoundPack();
          break;
        case 'restart_level':
          handleRestartLevel();
          break;
        case 'pause_toggle':
          handlePauseToggle();
          break;
        case 'return_title':
          handleReturnTitle();
          break;
        case 'auto_play':
          handleAutoPlay();
          break;
        case 'revive_ad':
          handleReviveAd();
          break;
        case 'refill_hammer_ad':
          handleRefillHammerAd();
          break;
        case 'fuel_autoplay_ad':
          handleFuelAutoPlayAd();
          break;
        case 'double_streak_ad':
          handleDoubleStreakAd();
          break;
        case 'close_session_recap':
          setSessionRecapOpen(false);
          break;
        case 'resolve_conflict':
          handleResolveConflict(action.choice);
          break;
        case 'side_ad_click':
          hapticsEngine.pulseButtonTap();
          soundEngine.playUiConfirm();
          setSoundState(soundEngine.getState());
          // Trigger Google AdMob Test Ad on tap
          adsManager.showInterstitial(true);
          setBestScore((prev) => prev + 50);
          setBoard((prev) => ({
            ...prev,
            score: prev.score + 50,
            lastActionFeedback: {
              type: 'matched',
              message: `[Test Ad] GOOGLE ADMOB NATIVE: +50 PTS BONUS!`,
              timestamp: Date.now(),
            },
          }));
          break;
      }
    },
    [
      startGame,
      handleHammer,
      handleExtraSlot,
      handleReviveAd,
      handleRefillHammerAd,
      handleFuelAutoPlayAd,
      handleDoubleStreakAd,
      handleCycleCamera,
      handleToggleMute,
      soundSettingsOpen,
      handleOpenSoundSettings,
      handleCloseSoundSettings,
      handleSelectSoundPack,
      handleCycleSoundPack,
      handleCycleVolume,
      handleTestSoundPack,
      handleRestartLevel,
      handlePauseToggle,
      handleReturnTitle,
      handleAutoPlay,
      handleResolveConflict,
      recordToolFirstUse,
      board.levelIndex,
      explodedPeek,
    ]
  );

  const maxBoardLayer = board.screws.reduce(
    (m, s) => Math.max(m, s.layer),
    0
  );
  const difficultyGauge = computeDifficultyGaugeState(
    board.levelIndex,
    board.screws.length,
    maxBoardLayer,
    ddaState.difficultyMultiplier
  );

  const flags = analyticsManager.getFlags();
  const idleThresholdSec = getIdleThresholdForLevel(
    board.levelIndex,
    ftueState,
    flags.t3IdleHandDelayMs
  );
  const rawFtueHint = getFtueHintForLevel(
    board.levelIndex,
    ftueState,
    recentBlockedAttempt
  );
  const cleanObjectTitle = board.levelName
    .replace(/^Level\s+\d+\s*[:·-]?\s*/i, '')
    .trim()
    .toUpperCase();
  const ftueHint = recentBlockedAttempt
    ? rawFtueHint
    : rawFtueHint
      ? `OBJECT: ${cleanObjectTitle} · ${rawFtueHint}`
      : `OBJECT: ${cleanObjectTitle} — ${board.levelSubtitle}`;
  const hasBottomBoostersUnlocked =
    isControlUnlocked('slot', effectiveHighestLevel, ftueState) ||
    isControlUnlocked('hammer', effectiveHighestLevel, ftueState) ||
    isControlUnlocked('peek', effectiveHighestLevel, ftueState) ||
    isControlUnlocked('cam', effectiveHighestLevel, ftueState);

  const overlayModal: ModalOverlay3DState = conflictSave
    ? {
        kind: 'cloud_conflict',
        cloud: conflictSave.cloud,
        local: conflictSave.local,
      }
    : sessionRecapOpen
      ? {
          kind: 'session_recap',
          levelNumber: board.levelIndex + 1,
          score: board.score,
          maxCombo: board.maxCombo,
        }
      : { kind: 'none' };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__TORQ_CONTROLLER__ = {
        loadLevel: (levelIdx: number) => {
          const newB = createEndlessBoard(levelIdx, {
            carryScore: 4250 * (levelIdx + 1),
            carryHammers: 3,
            carryExtraSlots: 2,
          });
          setBoard(newB);
          setGamePhase('playing');
        },
        setCameraPreset,
        setExplodedPeek,
        triggerUnscrew: (screwId: string) => {
          handleUnscrewAttempt(screwId);
        },
        toggleHammer: () => setBoard((prev) => toggleHammerMode(prev)),
        addExtraSlot: () => setBoard((prev) => unlockExtraDockSlot(prev)),
        setAutoPlayReady: () => {
          setAutoPlay(
            createInitialAutoPlayState(
              AUTO_PLAY_TARGET_BOLTS,
              AUTO_PLAY_TARGET_BOLTS
            )
          );
        },
        board,
      };
    }
  }, [board, handleUnscrewAttempt]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070A0F] select-none">
      {/* Isolated Full-Viewport 3D Three.js Workbench & Diegetic 3D GUI Canvas */}
      <ScrewBoardCanvas
        board={board}
        gamePhase={gamePhase}
        bestScore={bestScore}
        muted={muted}
        soundSettingsOpen={soundSettingsOpen}
        soundState={soundState}
        explodedPeek={explodedPeek}
        cameraPreset={cameraPreset}
        runSnapshot={runSnapshot}
        difficultyGauge={difficultyGauge}
        dayStreak={dayStreak}
        autoPlay={autoPlay}
        ftueState={ftueState}
        highestLevelIndex={effectiveHighestLevel}
        activeModalOpen={activeModalOpen}
        overlayModal={overlayModal}
        hintText={ftueHint}
        newToolToast={newToolToast}
        hasBottomBoostersUnlocked={hasBottomBoostersUnlocked}
        cloudConnected={pgsStatus.connected}
        idleThresholdSec={idleThresholdSec}
        nativeAdsMinLevelIndex={flags.t4NativeAdsMinLevelIndex}
        onUnscrewAttempt={handleUnscrewAttempt}
        onGuiAction={handleGui3DAction}
      />

      {/* Transparent Semantic Accessibility Sync Layer */}
      <GameOverlayHUD
        board={board}
        gamePhase={gamePhase}
        bestScore={bestScore}
        elapsedSec={elapsedSec}
        muted={muted}
        soundSettingsOpen={soundSettingsOpen}
        soundState={soundState}
        explodedPeek={explodedPeek}
        dockCollapsed={dockCollapsed}
        cameraPreset={cameraPreset}
        runSnapshot={runSnapshot}
        difficultyGauge={difficultyGauge}
        dayStreak={dayStreak}
        autoPlay={autoPlay}
        ftueState={ftueState}
        highestLevelIndex={effectiveHighestLevel}
        onStartGame={startGame}
        onUnscrewAttempt={handleUnscrewAttempt}
        onHammer={handleHammer}
        onExtraSlot={handleExtraSlot}
        onToggleExplode={() => {
          recordToolFirstUse('peek', board.levelIndex);
          setExplodedPeek((v) => !v);
        }}
        onToggleDockCollapse={() => setDockCollapsed((v) => !v)}
        onCycleCamera={handleCycleCamera}
        onToggleMute={handleToggleMute}
        onOpenSoundSettings={handleOpenSoundSettings}
        onCloseSoundSettings={handleCloseSoundSettings}
        onSelectSoundPack={handleSelectSoundPack}
        onCycleSoundPack={handleCycleSoundPack}
        onCycleVolume={handleCycleVolume}
        onTestSoundPack={handleTestSoundPack}
        onPauseToggle={handlePauseToggle}
        onRestartLevel={handleRestartLevel}
        onReturnTitle={handleReturnTitle}
        onAutoPlay={handleAutoPlay}
        onLinkPlayGames={handleLinkPlayGames}
      />

      <FtueOverlays
        gamePhase={gamePhase}
        hintText={ftueHint}
        newToolToast={newToolToast}
        sessionRecapOpen={sessionRecapOpen}
        levelNumber={board.levelIndex + 1}
        score={board.score}
        maxCombo={board.maxCombo}
        onCloseSessionRecap={() => setSessionRecapOpen(false)}
        hasBottomBoostersUnlocked={hasBottomBoostersUnlocked}
      />

      {conflictSave && (
        <ConflictResolutionModal
          cloudSave={conflictSave.cloud}
          localSave={conflictSave.local}
          onResolve={handleResolveConflict}
        />
      )}
    </main>
  );
}
