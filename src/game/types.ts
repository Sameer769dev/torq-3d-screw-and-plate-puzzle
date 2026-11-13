export type ScrewColor =
  | 'crimson'
  | 'cobalt'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'titanium'
  | 'magenta'
  | 'cyan'
  | 'lime'
  | 'copper';

export type ScrewSpecialVariant = 'normal' | 'chaotic' | 'rainbow' | 'unknown';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type PlateShape = 'rect' | 'l-bracket' | 'disc' | 'triangle' | 'hex' | 'arch';

export type PlateMaterialType = 'acrylic-cyan' | 'acrylic-amber' | 'brushed-brass' | 'blued-steel' | 'acrylic-rose' | 'anodized-slate';

export interface ScrewColorMeta {
  id: ScrewColor;
  name: string;
  shortLabel: string;
  hex: string;
  accentHex: string;
  emissiveHex: string;
  symbol: 'cross' | 'hex' | 'star' | 'slot' | 'tri' | 'square';
}

export const SCREW_COLOR_META: Record<ScrewColor, ScrewColorMeta> = {
  crimson: {
    id: 'crimson',
    name: 'Crimson Bolt',
    shortLabel: 'CRM',
    hex: '#EF4444',
    accentHex: '#FCA5A5',
    emissiveHex: '#7F1D1D',
    symbol: 'cross',
  },
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt Bolt',
    shortLabel: 'COB',
    hex: '#3B82F6',
    accentHex: '#93C5FD',
    emissiveHex: '#1E3A8A',
    symbol: 'hex',
  },
  amber: {
    id: 'amber',
    name: 'Amber Brass',
    shortLabel: 'AMB',
    hex: '#F59E0B',
    accentHex: '#FDE68A',
    emissiveHex: '#78350F',
    symbol: 'star',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Torque',
    shortLabel: 'EMR',
    hex: '#10B981',
    accentHex: '#6EE7B7',
    emissiveHex: '#064E3B',
    symbol: 'slot',
  },
  violet: {
    id: 'violet',
    name: 'Violet Alloy',
    shortLabel: 'VLT',
    hex: '#A855F7',
    accentHex: '#D8B4FE',
    emissiveHex: '#4C1D95',
    symbol: 'tri',
  },
  titanium: {
    id: 'titanium',
    name: 'Titanium Pearl',
    shortLabel: 'TIT',
    hex: '#E2E8F0',
    accentHex: '#FFFFFF',
    emissiveHex: '#334155',
    symbol: 'square',
  },
  magenta: {
    id: 'magenta',
    name: 'Hyper Magenta',
    shortLabel: 'MAG',
    hex: '#EC4899',
    accentHex: '#F9A8D4',
    emissiveHex: '#831843',
    symbol: 'star',
  },
  cyan: {
    id: 'cyan',
    name: 'Cryo Cyan',
    shortLabel: 'CYN',
    hex: '#06B6D4',
    accentHex: '#67E8F9',
    emissiveHex: '#164E63',
    symbol: 'hex',
  },
  lime: {
    id: 'lime',
    name: 'Volt Lime',
    shortLabel: 'LIM',
    hex: '#84CC16',
    accentHex: '#BEF264',
    emissiveHex: '#365314',
    symbol: 'tri',
  },
  copper: {
    id: 'copper',
    name: 'Molten Copper',
    shortLabel: 'COP',
    hex: '#F97316',
    accentHex: '#FDBA74',
    emissiveHex: '#7C2D12',
    symbol: 'cross',
  },
};

export interface ScrewBlueprint {
  id: string;
  x: number; // Board coordinates (-4.5 to +4.5)
  y: number; // Board coordinates (-3.5 to +3.5)
  layer: number; // Highest layer index is on top; a plate at layer L blocks screws at layer < L if overlapping
  color: ScrewColor;
  specialVariant?: ScrewSpecialVariant;
  chaosCycleColors?: ScrewColor[];
  unknownRevealAtMove?: number;
}

export interface PlateBlueprint {
  id: string;
  name: string;
  layer: number;
  shape: PlateShape;
  materialType: PlateMaterialType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Initial Z rotation in radians
  screwIds: string[]; // Screws that pin this plate
}

export interface LevelBlueprint {
  index: number;
  name: string;
  subtitle: string;
  difficulty: 'Apprentice' | 'Machinist' | 'Horologist' | 'Master Engineer';
  parTimeSec: number;
  screws: ScrewBlueprint[];
  plates: PlateBlueprint[];
  boxSequence: ScrewColor[]; // Each entry is a TargetBox requiring 3 screws of that color
  solutionOrder?: string[];
}

export type ScrewLocation = 'board' | 'box' | 'dock';

export interface ScrewState {
  id: string;
  x: number;
  y: number;
  layer: number;
  color: ScrewColor;
  location: ScrewLocation;
  specialVariant?: ScrewSpecialVariant;
  chaosCycleColors?: ScrewColor[];
  unknownRevealed?: boolean;
  unknownRevealAtMove?: number;
  spawnedMidLevel?: boolean;
  targetBoxId?: string;
  targetBoxSlot?: number;
  dockSlotIndex?: number;
  extractedAtMove?: number;
}

export type PlateStatus = 'pinned' | 'dangling' | 'cleared';

export interface PlateState {
  id: string;
  name: string;
  layer: number;
  shape: PlateShape;
  materialType: PlateMaterialType;
  x: number;
  y: number;
  width: number;
  height: number;
  baseRotation: number;
  currentRotation: number; // Includes gravity swing when dangling on 1 screw
  pivotX: number;
  pivotY: number;
  screwIds: string[]; // Remaining attached screw IDs
  initialScrewIds: string[];
  status: PlateStatus;
}

export interface TargetBoxState {
  id: string;
  color: ScrewColor;
  screwIds: string[]; // Up to 3
  completed: boolean;
  slotIndex: number; // 0 or 1 (active box slots)
}

export interface BoardState {
  levelIndex: number;
  levelName: string;
  levelSubtitle: string;
  difficulty: string;
  parTimeSec: number;
  screws: ScrewState[];
  plates: PlateState[];
  activeBoxes: TargetBoxState[];
  upcomingBoxColors: ScrewColor[];
  completedBoxCount: number;
  totalBoxes: number;
  dockScrewIds: (string | null)[];
  maxDockSlots: number;
  score: number;
  combo: number;
  maxCombo: number;
  movesCount: number;
  comboMatchMoves: number;
  boardStartedAtMs: number;
  hammersRemaining: number;
  hammerMode: boolean;
  extraSlotUsed: boolean;
  extraSlotsRemaining: number;
  extraSlotsUnlockedCount?: number;
  revivesUsed?: number;
  highlightedScrewId: string | null;
  selectedScrewId: string | null;
  solutionOrder?: string[];
  lastActionFeedback: {
    type: 'matched' | 'docked' | 'blocked' | 'box-cleared' | 'plate-dropped' | 'hammer' | 'extra-slot';
    message: string;
    screwId?: string;
    blockingPlateId?: string;
    platesClearedCount?: number;
    clearedPlateIds?: string[];
    boxesClearedCount?: number;
    levelWon?: boolean;
    timestamp: number;
  } | null;
  outcome: 'ongoing' | 'victory' | 'defeat';
  defeatReason?: string;
}

export interface RunSnapshot {
  outcome: 'victory' | 'defeat';
  levelIndex: number;
  levelName: string;
  score: number;
  bestScore: number;
  elapsedSec: number;
  parTimeSec: number;
  screwsCleared: number;
  totalScrews: number;
  platesCleared: number;
  totalPlates: number;
  maxCombo: number;
  movesCount: number;
  defeatReason?: string;
}
