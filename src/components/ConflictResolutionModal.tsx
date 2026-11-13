import React from 'react';
import { TorqSaveBlob } from '../game/cloudSave';

interface ConflictResolutionModalProps {
  cloudSave: TorqSaveBlob;
  localSave: TorqSaveBlob;
  onResolve: (choice: 'smart_merge' | 'keep_cloud' | 'keep_local') => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  cloudSave,
  localSave,
  onResolve,
}) => {
  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none opacity-0 select-none flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cloud Save Conflict Resolution"
      data-testid="cloud-conflict-dialog"
    >
      <div>
        <h2>PLAY GAMES: SAVE CONFLICT</h2>
        <div>
          <span>☁ CLOUD SAVE</span>
          <strong>Level {(cloudSave.levelIndex ?? 0) + 1}</strong>
          <strong>{(cloudSave.bestScore ?? 0).toLocaleString()}</strong>
          <span>📱 DEVICE SAVE</span>
          <strong>Level {(localSave.levelIndex ?? 0) + 1}</strong>
          <strong>{(localSave.bestScore ?? 0).toLocaleString()}</strong>
        </div>
        <button type="button" onClick={() => onResolve('smart_merge')}>
          SMART MERGE (RECOMMENDED)
        </button>
        <button type="button" onClick={() => onResolve('keep_cloud')}>
          KEEP CLOUD
        </button>
        <button type="button" onClick={() => onResolve('keep_local')}>
          KEEP DEVICE
        </button>
      </div>
    </div>
  );
};

