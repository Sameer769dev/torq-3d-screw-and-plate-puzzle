import React from 'react';
import { NewToolAnnouncement } from '../game/ftue';

interface FtueOverlaysProps {
  gamePhase: string;
  hintText: string | null;
  newToolToast: NewToolAnnouncement | null;
  sessionRecapOpen: boolean;
  levelNumber: number;
  score: number;
  maxCombo: number;
  onCloseSessionRecap: () => void;
  hasBottomBoostersUnlocked: boolean;
}

export const FtueOverlays: React.FC<FtueOverlaysProps> = ({
  gamePhase,
  hintText,
  newToolToast,
  sessionRecapOpen,
  levelNumber,
  score,
  maxCombo,
  onCloseSessionRecap,
  hasBottomBoostersUnlocked,
}) => {
  return (
    <>
      {/* Semantic / Accessibility DOM Proxy (visual rendering is 100% 3D in ScrewBoardCanvas via gui3d.ts) */}
      {gamePhase === 'playing' &&
        hintText &&
        !sessionRecapOpen && (
          <div
            data-testid="ftue-hint-pill"
            role="status"
            className={`fixed left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-0 select-none ${
              hasBottomBoostersUnlocked ? 'bottom-16' : 'bottom-3'
            }`}
          >
            <p>{hintText}</p>
          </div>
        )}

      {gamePhase === 'playing' && newToolToast && (
        <div
          data-testid="ftue-new-tool-toast"
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-0 select-none"
        >
          <span>{newToolToast.badge}</span>
          <span>{newToolToast.title}</span>
          <span>{newToolToast.subtitle}</span>
        </div>
      )}

      {sessionRecapOpen && (
        <div
          className="fixed inset-0 z-10 pointer-events-none opacity-0 select-none flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Session 1 Summary and Day 2 Reward"
          data-testid="session-1-recap-dialog"
        >
          <div>
            <span>SESSION 1 COMPLETE</span>
            <h2>Workbench Mastered</h2>
            <span>LEVEL {levelNumber}</span>
            <strong>{Math.round(score).toLocaleString()}</strong>
            <strong>{maxCombo}x</strong>
            <button
              type="button"
              data-testid="session-recap-continue-btn"
              onClick={onCloseSessionRecap}
            >
              Keep Playing Level {levelNumber}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

