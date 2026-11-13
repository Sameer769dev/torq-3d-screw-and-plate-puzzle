import React from 'react';
import { AutoPlayState } from '../game/autoPlay';
import { DifficultyGaugeState } from '../game/dda';
import {
  SOUNDSCAPE_PACK_ORDER,
  SOUNDSCAPE_PACKS,
  SoundscapePackId,
  SoundSettingsState,
} from '../game/sound';
import { DayStreakState } from '../game/streak';
import { FtueState, isControlUnlocked } from '../game/ftue';
import { BoardState, GamePhase, RunSnapshot } from '../game/types';

interface Props {
  board: BoardState;
  gamePhase: GamePhase;
  bestScore: number;
  elapsedSec: number;
  muted: boolean;
  soundSettingsOpen: boolean;
  soundState: SoundSettingsState;
  explodedPeek: boolean;
  dockCollapsed: boolean;
  cameraPreset: 'top' | 'angled' | 'side';
  runSnapshot: RunSnapshot | null;
  difficultyGauge: DifficultyGaugeState;
  dayStreak: DayStreakState;
  autoPlay: AutoPlayState;
  ftueState: FtueState;
  highestLevelIndex: number;
  onStartGame: (depth?: number) => void;
  onUnscrewAttempt: (screwId: string) => void;
  onHammer: () => void;
  onExtraSlot: () => void;
  onToggleExplode: () => void;
  onToggleDockCollapse: () => void;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onOpenSoundSettings: () => void;
  onCloseSoundSettings: () => void;
  onSelectSoundPack: (packId: SoundscapePackId) => void;
  onCycleSoundPack: () => void;
  onCycleVolume: () => void;
  onTestSoundPack: () => void;
  onPauseToggle: () => void;
  onRestartLevel: () => void;
  onReturnTitle: () => void;
  onAutoPlay: () => void;
  onLinkPlayGames: () => void;
}

/**
 * Transparent Semantic Accessibility Proxy Layer (`opacity-0`) synchronized with the 3D Diegetic Workbench GUI.
 * Visually, 100% of the UI & GUI is rendered as physical 3D objects inside the Three.js scene (`gui3d.ts`),
 * while these semantic `<button>` and status nodes remain available for keyboard navigation, screen readers,
 * and accessibility tree snapshots.
 */
export const GameOverlayHUD: React.FC<Props> = ({
  board,
  gamePhase,
  bestScore,
  muted,
  soundSettingsOpen,
  soundState,
  runSnapshot,
  difficultyGauge,
  dayStreak,
  autoPlay,
  ftueState,
  highestLevelIndex,
  onStartGame,
  onHammer,
  onExtraSlot,
  onToggleExplode,
  onCycleCamera,
  onToggleMute,
  onOpenSoundSettings,
  onCloseSoundSettings,
  onSelectSoundPack,
  onCycleSoundPack,
  onCycleVolume,
  onTestSoundPack,
  onPauseToggle,
  onRestartLevel,
  onReturnTitle,
  onAutoPlay,
  onLinkPlayGames,
}) => {
  const effectiveHighest = Math.max(highestLevelIndex, board.levelIndex);
  const gateOpts = { totalDaysPlayed: dayStreak.totalDaysPlayed };
  const streakUnlocked = isControlUnlocked('streakCard', effectiveHighest, ftueState, gateOpts);
  const slotUnlocked = isControlUnlocked('slot', effectiveHighest, ftueState, gateOpts);
  const hammerUnlocked = isControlUnlocked('hammer', effectiveHighest, ftueState, gateOpts);
  const peekUnlocked = isControlUnlocked('peek', effectiveHighest, ftueState, gateOpts);
  const camUnlocked = isControlUnlocked('cam', effectiveHighest, ftueState, gateOpts);
  const autoPlayUnlocked = isControlUnlocked('autoPlay', effectiveHighest, ftueState, gateOpts);
  const soundUnlocked = isControlUnlocked('soundPack', effectiveHighest, ftueState, gateOpts);
  const muteUnlocked = isControlUnlocked('mute', effectiveHighest, ftueState, gateOpts);
  const remainingBoardScrews = board.screws.filter(
    (s) => s.location === 'board'
  );
  const usedDockCount = board.dockScrewIds.filter(Boolean).length;
  const effectiveBest = Math.max(
    Math.round(bestScore),
    Math.round(board.score)
  );

  const levelNumStr = String(board.levelIndex + 1).padStart(2, '0');

  const soundSettingsModalNode = soundSettingsOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sound Settings"
      data-testid="sound-settings-dialog"
      className="pointer-events-none flex flex-col items-center gap-2"
    >
      <h2>SOUNDSCAPE SETTINGS</h2>
      <span data-testid="sound-settings-active-pack">
        ACTIVE PACK: {soundState.packName} ({soundState.shortCode})
      </span>
      <span data-testid="sound-settings-volume">
        VOLUME {soundState.volumePercent}% · {muted ? 'MUTED' : 'ON'}
      </span>
      <div role="group" aria-label="Mechanical Soundscape Packs">
        {SOUNDSCAPE_PACK_ORDER.map((packId) => {
          const meta = SOUNDSCAPE_PACKS[packId];
          const isSelected = soundState.activePack === packId;
          return (
            <button
              key={packId}
              type="button"
              data-testid={`sound-pack-btn-${packId}`}
              aria-label={`${meta.name} Soundscape Pack`}
              aria-pressed={isSelected}
              onClick={() => onSelectSoundPack(packId)}
            >
              {meta.name} · {meta.tagline}
            </button>
          );
        })}
      </div>
      <div>
        <button
          type="button"
          data-testid="sound-settings-test-btn"
          aria-label="Test Soundscape Pack"
          onClick={onTestSoundPack}
        >
          TEST SOUND
        </button>
        <button
          type="button"
          data-testid="sound-settings-cycle-pack-btn"
          aria-label="Cycle Soundscape Pack"
          onClick={onCycleSoundPack}
        >
          NEXT PACK
        </button>
        <button
          type="button"
          data-testid="sound-settings-volume-btn"
          aria-label={`Volume ${soundState.volumePercent}%`}
          onClick={onCycleVolume}
        >
          VOL {soundState.volumePercent}%
        </button>
        <button
          type="button"
          data-testid="sound-settings-mute-btn"
          aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          onClick={onToggleMute}
        >
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>
        <button
          type="button"
          data-testid="sound-settings-close-btn"
          aria-label="Close Sound Settings"
          onClick={onCloseSoundSettings}
        >
          DONE
        </button>
      </div>
    </div>
  ) : null;

  if (gamePhase === 'title') {
    return (
      <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 opacity-0">
        <div className="my-auto mx-auto w-64 flex flex-col items-center gap-2 pointer-events-none">
          <h1>TORQ</h1>
          <span data-testid="title-level-counter">LEVEL {levelNumStr}</span>
          <span data-testid="title-sound-pack">
            SOUNDSCAPE: {soundState.packName} ({soundState.shortCode})
          </span>
          {streakUnlocked && (
            <div
              data-testid="title-day-streak"
              role="status"
              aria-label={`Day Streak: ${dayStreak.currentStreak} Day Streak, Reward ${dayStreak.rewardLabel}`}
            >
              <span data-testid="day-streak-count">
                {dayStreak.currentStreak} DAY STREAK
              </span>
              <span data-testid="day-streak-reward">
                {dayStreak.rewardLabel}
              </span>
            </div>
          )}
          {!soundSettingsOpen && (
            <>
              <button
                type="button"
                data-start="true"
                onClick={() => onStartGame(board.levelIndex)}
              >
                PLAY · LEVEL {levelNumStr}
              </button>
              <button
                type="button"
                data-testid="title-sound-settings-btn"
                aria-label={`Sound Settings (${soundState.packName})`}
                onClick={onOpenSoundSettings}
              >
                SOUND SETTINGS · {soundState.shortCode}
              </button>
            </>
          )}
          {soundSettingsModalNode}
        </div>
      </div>
    );
  }

  return (
    <div
      data-ftue-step={ftueState.step}
      data-ftue-completed={String(ftueState.completed)}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 opacity-0"
    >
      <div className="flex items-center justify-between">
        <div>
          <span data-testid="hud-level">{board.levelIndex + 1}</span>
          <span data-testid="hud-score">{Math.round(board.score)}</span>
          <span data-testid="hud-best">{effectiveBest}</span>
          <span data-testid="hud-bolts-left">
            {remainingBoardScrews.length}
          </span>
          <span data-testid="hud-sound-pack">
            {soundState.packName} ({soundState.shortCode})
          </span>
          <span
            role="meter"
            aria-label="Difficulty Gauge"
            aria-valuenow={difficultyGauge.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="hud-difficulty-gauge"
          >
            DIFF {difficultyGauge.percent}% · {difficultyGauge.tierLabel}
          </span>
        </div>
        <div>
          {soundUnlocked && (
            <button
              type="button"
              data-testid="hud-sound-settings-btn"
              aria-label={`Sound Settings (${soundState.packName})`}
              aria-expanded={soundSettingsOpen}
              onClick={
                soundSettingsOpen ? onCloseSoundSettings : onOpenSoundSettings
              }
            >
              SOUND · {soundState.shortCode}
            </button>
          )}
          {muteUnlocked && (
            <button
              type="button"
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              onClick={onToggleMute}
            />
          )}
          <button
            type="button"
            aria-label="Pause Game"
            onClick={onPauseToggle}
          />
        </div>
      </div>

      {soundSettingsModalNode}

      <div>
        <span
          data-testid="hud-dock-usage"
          aria-label={`Spare Dock ${usedDockCount} of ${board.maxDockSlots}`}
        />
        {hammerUnlocked && (
          <button
            type="button"
            aria-label="Hammer"
            aria-pressed={board.hammerMode}
            onClick={onHammer}
          >
            {board.hammersRemaining > 0 ? `HAMMER ${board.hammersRemaining}` : 'HAMMER 🎬'}
          </button>
        )}
        {slotUnlocked && (
          <button
            type="button"
            disabled={board.maxDockSlots >= 8}
            aria-label="Extra Slot"
            onClick={onExtraSlot}
          >
            {board.maxDockSlots >= 8
              ? 'MAX DOCK'
              : (board.extraSlotsRemaining ?? 0) > 0
                ? `+1 SLOT (${board.extraSlotsRemaining})`
                : '+1 SLOT 🎬'}
          </button>
        )}
        {peekUnlocked && (
          <button
            type="button"
            aria-label="Explode Layers"
            onClick={onToggleExplode}
          >
            PEEK
          </button>
        )}
        {camUnlocked && (
          <button
            type="button"
            aria-label="Cycle Camera"
            onClick={onCycleCamera}
          >
            CAM
          </button>
        )}
        {autoPlayUnlocked && (
          <button
            type="button"
            data-testid="hud-autoplay-btn"
            disabled={!autoPlay.isReady && !autoPlay.autoPlaying}
            aria-label={
              autoPlay.autoPlaying
                ? 'Auto-Play Active'
                : autoPlay.isReady
                  ? 'Activate Radioactive Auto-Play Level'
                  : `Radioactive Auto-Play Liquid ${autoPlay.percent}% (${autoPlay.chargeBolts}/${autoPlay.targetBolts} Bolts)`
            }
            onClick={onAutoPlay}
          >
            {autoPlay.autoPlaying
              ? 'AUTO-PLAYING'
              : autoPlay.isReady
                ? 'AUTO-PLAY READY'
                : `AUTO-PLAY ${autoPlay.chargeBolts}/${autoPlay.targetBolts}`}
          </button>
        )}
      </div>

      {gamePhase === 'paused' && !soundSettingsOpen && (
        <div role="dialog" aria-modal="true" aria-label="Paused">
          <button type="button" onClick={onPauseToggle}>
            RESUME
          </button>
          <button type="button" onClick={onToggleMute}>
            {muted ? 'UNMUTE' : 'MUTE'}
          </button>
          <button type="button" onClick={onOpenSoundSettings}>
            SOUND SETTINGS ({soundState.shortCode})
          </button>
          <button type="button" onClick={onRestartLevel}>
            RETRY LEVEL {levelNumStr}
          </button>
          <button type="button" onClick={onLinkPlayGames}>
            CLOUD SAVE
          </button>
          <button type="button" onClick={onReturnTitle}>
            HOME
          </button>
        </div>
      )}

      {gamePhase === 'gameover' && runSnapshot && !soundSettingsOpen && (
        <div role="dialog" aria-modal="true" aria-label="Dock Full">
          <span>{Math.round(runSnapshot.score)}</span>
          <span>{Math.round(Math.max(bestScore, runSnapshot.score))}</span>
          <button
            type="button"
            data-start="true"
            onClick={() => onStartGame(board.levelIndex)}
          >
            RETRY · LEVEL {levelNumStr}
          </button>
          <button type="button" onClick={onOpenSoundSettings}>
            SOUND SETTINGS ({soundState.shortCode})
          </button>
          <button type="button" onClick={onReturnTitle}>
            HOME
          </button>
        </div>
      )}
    </div>
  );
};
