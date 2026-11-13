import { DDAComplexityProfile } from './dda';
import {
  LevelBlueprint,
  PlateBlueprint,
  PlateMaterialType,
  ScrewBlueprint,
  ScrewColor,
} from './types';

export const ALL_SCREW_COLORS: ScrewColor[] = [
  'amber',
  'cobalt',
  'crimson',
  'emerald',
  'violet',
  'titanium',
  'magenta',
  'cyan',
  'lime',
  'copper',
];

const METAL_MATERIALS: PlateMaterialType[] = [
  'brushed-brass',
  'blued-steel',
  'anodized-slate',
];

const ACRYLIC_MATERIALS: PlateMaterialType[] = [
  'acrylic-cyan',
  'acrylic-amber',
  'acrylic-rose',
];

const PLATE_NAMES_BY_LAYER: string[][] = [
  ['North Stator Bar', 'South Stator Bar', 'Base Anchor Plate'],
  ['West Flank Bracket', 'East Flank Bracket', 'Ventral Gusset'],
  ['Upper Train Bridge', 'Lower Train Bridge', 'Mid Rotary Plate'],
  ['Port Stabilizer Wing', 'Starboard Stabilizer Wing', 'Escapement Bridge'],
  ['Tourbillon Cage', 'Reactor Manifold', 'Harmonic Bridge'],
  ['Sapphire Balance Cap', 'Crown Retainer Shield', 'Zenith Lock Plate'],
];

/**
 * 6 x 4 Precision CNC Workbench Lattice:
 * - Adjacent columns are separated by DX = 1.14 world units.
 * - Adjacent rows are separated by DY = 1.04 world units.
 * - Bolt outer washer radius is 0.36 (diameter 0.72).
 * - Plate padding around spanned cell centers is PAD = 0.44 (width/height = span + 0.88).
 * - Because every bolt in a level occupies a UNIQUE (col, row) lattice cell across ALL layers,
 *   no two bolts can ever overlap (min distance >= 1.04), and no plate edge can ever clip
 *   partially across an uncovered bolt (guaranteed >= 0.24 world-unit clearance)!
 */
export const LATTICE_COL_X = [-2.85, -1.71, -0.57, 0.57, 1.71, 2.85] as const;
export const LATTICE_ROW_Y = [-1.56, -0.52, 0.52, 1.56] as const;
export const LATTICE_DX = 1.14;
export const LATTICE_DY = 1.04;
export const LATTICE_PLATE_PAD = 0.44;

interface GridCell {
  c: number; // 0..5
  r: number; // 0..3
}

/**
 * Deterministic 32-bit seeded PRNG (Mulberry32) so procedural boards are reproducible and testable.
 */
export function createSeededRng(seed: number): () => number {
  let a = (seed ^ 0x6d2b79f5) >>> 0;
  return function () {
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

const SCREW_HEAD_RADIUS = 0.36;

function isPointCoveredByBlueprintPlate(
  sx: number,
  sy: number,
  plate: PlateBlueprint,
  margin = SCREW_HEAD_RADIUS * 0.55
): boolean {
  const dx = sx - plate.x;
  const dy = sy - plate.y;
  const halfW = plate.width * 0.5 + margin;
  const halfH = plate.height * 0.5 + margin;
  return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
}

/**
 * Builds a lattice-aligned CNC rectangular PlateBlueprint spanning the exact bounding box
 * of its assigned `screws`. Because `PAD = 0.44` and lattice spacing is `1.14 x 1.04`,
 * the plate cleanly encloses its spanned cells while leaving a >= 0.24 unit gap from all
 * bolts in adjacent cells outside the span.
 */
function buildLatticePlateForScrews(
  id: string,
  name: string,
  layer: number,
  screws: ScrewBlueprint[],
  materialType: PlateMaterialType
): PlateBlueprint {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const s of screws) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }

  const cx = Number(((minX + maxX) * 0.5).toFixed(2));
  const cy = Number(((minY + maxY) * 0.5).toFixed(2));
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const width = Number((spanX + LATTICE_PLATE_PAD * 2).toFixed(2));
  const height = Number((spanY + LATTICE_PLATE_PAD * 2).toFixed(2));

  return {
    id,
    name,
    layer,
    shape: 'rect',
    materialType,
    x: cx,
    y: cy,
    width,
    height,
    screwIds: screws.map((s) => s.id),
  };
}

/**
 * Selects `count` cells from `availableCells` in a zone, preferring cells that maximize
 * the bounding box span so the resulting plate bridges cleanly over interior cells.
 */
function pickSpreadCellsFromZone(
  zoneCells: GridCell[],
  count: number,
  rng: () => number
): GridCell[] {
  if (zoneCells.length <= count) {
    return [...zoneCells];
  }

  // Sort primarily by column then row (with slight seeded tie-break)
  const pool = [...zoneCells];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  pool.sort((a, b) => a.c - b.c || a.r - b.r);

  const chosen: GridCell[] = [];
  // Pick first (leftmost/bottommost) and last (rightmost/topmost) to maximize span
  chosen.push(pool[0]);
  if (count >= 2) {
    chosen.push(pool[pool.length - 1]);
  }
  const middlePool = pool.slice(1, pool.length - 1);
  // Shuffle middle pool
  for (let i = middlePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [middlePool[i], middlePool[j]] = [middlePool[j], middlePool[i]];
  }
  for (let i = 0; i < middlePool.length && chosen.length < count; i++) {
    chosen.push(middlePool[i]);
  }
  return chosen;
}

/**
 * Generates a procedural LevelBlueprint for any `depth` (0, 1, 2, 3, ...),
 * guaranteeing:
 *  1. ZERO Bolt-to-Bolt Overlaps across the entire board (every bolt occupies a unique
 *     cell on the 6x4 CNC lattice with distance >= 1.04 world units).
 *  2. ZERO Partial Plate-to-Bolt Edge Overlaps (every plate aligns to exact lattice cell
 *     bounds with >= 0.24 world-unit clearance from adjacent uncovered bolts).
 *  3. 100% Mathematical Solvability without boosters via Constructive Top-Down Simulation.
 */
export function generateEndlessBlueprint(
  depth: number,
  seed?: number,
  ddaProfile?: DDAComplexityProfile
): LevelBlueprint & { solutionOrder: string[] } {
  const safeDepth = Math.max(0, Math.floor(depth));

  // Hand-authored, mathematically unlosable FTUE Curriculum (Levels 1-4)
  // Applied whenever no explicit DDA override profile is forced (standard player progression).
  if (!ddaProfile && safeDepth === 0) {
    // L1: 6 bolts, 2 colours, 1 layer, 0 blocked bolts (unlosable immediate win)
    return {
      index: 0,
      name: 'Level 1',
      subtitle: 'Tap matching bolts to fill both Target Boxes.',
      difficulty: 'Apprentice',
      parTimeSec: 45,
      boxSequence: ['amber', 'cobalt'],
      screws: [
        { id: 's1', x: -1.71, y: 0.52, layer: 1, color: 'amber' },
        { id: 's2', x: -0.57, y: -0.52, layer: 1, color: 'amber' },
        { id: 's3', x: -1.71, y: -0.52, layer: 1, color: 'cobalt' },
        { id: 's4', x: 0.57, y: 0.52, layer: 1, color: 'cobalt' },
        { id: 's5', x: 1.71, y: 0.52, layer: 1, color: 'amber' },
        { id: 's6', x: 1.71, y: -0.52, layer: 1, color: 'cobalt' },
      ],
      plates: [
        {
          id: 'p1',
          name: 'Left Calibration Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'brushed-brass',
          x: -1.14,
          y: 0.0,
          width: 2.02,
          height: 1.92,
          screwIds: ['s1', 's2', 's3'],
        },
        {
          id: 'p2',
          name: 'Right Calibration Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'blued-steel',
          x: 1.14,
          y: 0.0,
          width: 2.02,
          height: 1.92,
          screwIds: ['s4', 's5', 's6'],
        },
      ],
      solutionOrder: ['s1', 's2', 's5', 's3', 's4', 's6'],
    };
  }

  if (!ddaProfile && safeDepth === 1) {
    // L2: 9 bolts, 3 colours, 1 layer, 3 plates (teaches multi-plate clearing & queue order)
    return {
      index: 1,
      name: 'Level 2',
      subtitle: 'Unbolt all 3 plates and clear the incoming color queue.',
      difficulty: 'Apprentice',
      parTimeSec: 65,
      boxSequence: ['amber', 'cobalt', 'crimson'],
      screws: [
        { id: 's1', x: -2.85, y: 1.56, layer: 1, color: 'amber' },
        { id: 's2', x: -1.71, y: 0.52, layer: 1, color: 'amber' },
        { id: 's3', x: -0.57, y: 1.56, layer: 1, color: 'cobalt' },
        { id: 's4', x: 0.57, y: 0.52, layer: 1, color: 'cobalt' },
        { id: 's5', x: 1.71, y: 1.56, layer: 1, color: 'amber' },
        { id: 's6', x: 2.85, y: 0.52, layer: 1, color: 'crimson' },
        { id: 's7', x: -1.71, y: -1.56, layer: 1, color: 'cobalt' },
        { id: 's8', x: -0.57, y: -1.56, layer: 1, color: 'crimson' },
        { id: 's9', x: 1.71, y: -1.56, layer: 1, color: 'crimson' },
      ],
      plates: [
        {
          id: 'p1',
          name: 'Upper Left Guard',
          layer: 1,
          shape: 'rect',
          materialType: 'brushed-brass',
          x: -1.71,
          y: 1.04,
          width: 3.16,
          height: 1.92,
          screwIds: ['s1', 's2', 's3'],
        },
        {
          id: 'p2',
          name: 'Upper Right Guard',
          layer: 1,
          shape: 'rect',
          materialType: 'blued-steel',
          x: 1.71,
          y: 1.04,
          width: 3.16,
          height: 1.92,
          screwIds: ['s4', 's5', 's6'],
        },
        {
          id: 'p3',
          name: 'Lower Span Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'acrylic-cyan',
          x: 0.0,
          y: -1.56,
          width: 4.3,
          height: 0.88,
          screwIds: ['s7', 's8', 's9'],
        },
      ],
      solutionOrder: ['s1', 's2', 's5', 's3', 's4', 's7', 's6', 's8', 's9'],
    };
  }

  if (!ddaProfile && safeDepth === 2) {
    // L3: 9 bolts, 3 colours, 2 layers with covered bolt s2 teaching "Clear the top plate first"
    return {
      index: 2,
      name: 'Level 3',
      subtitle: 'Clear the top acrylic bridge first to uncover blocked bolts.',
      difficulty: 'Apprentice',
      parTimeSec: 75,
      boxSequence: ['amber', 'cobalt', 'crimson'],
      screws: [
        { id: 's1', x: -2.85, y: 1.56, layer: 1, color: 'crimson' },
        { id: 's2', x: -0.57, y: 0.52, layer: 1, color: 'cobalt' },
        { id: 's3', x: 2.85, y: 1.56, layer: 1, color: 'crimson' },
        { id: 's4', x: -2.85, y: -1.56, layer: 1, color: 'cobalt' },
        { id: 's5', x: 0.57, y: -1.56, layer: 1, color: 'crimson' },
        { id: 's6', x: 2.85, y: -1.56, layer: 1, color: 'cobalt' },
        { id: 's7', x: -1.71, y: 0.52, layer: 2, color: 'amber' },
        { id: 's8', x: 0.57, y: -0.52, layer: 2, color: 'amber' },
        { id: 's9', x: 1.71, y: 0.52, layer: 2, color: 'amber' },
      ],
      plates: [
        {
          id: 'p1',
          name: 'Upper Left Guard',
          layer: 1,
          shape: 'rect',
          materialType: 'brushed-brass',
          x: -1.71,
          y: 1.04,
          width: 3.16,
          height: 1.92,
          screwIds: ['s1', 's2'],
        },
        {
          id: 'p2',
          name: 'Upper Right Guard',
          layer: 1,
          shape: 'rect',
          materialType: 'blued-steel',
          x: 1.14,
          y: 1.04,
          width: 4.3,
          height: 1.92,
          screwIds: ['s2', 's3'],
        },
        {
          id: 'p3',
          name: 'Lower Span Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'brushed-brass',
          x: 0.0,
          y: -1.56,
          width: 6.58,
          height: 0.88,
          screwIds: ['s4', 's5', 's6'],
        },
        {
          id: 'p4',
          name: 'Center Acrylic Bridge',
          layer: 2,
          shape: 'rect',
          materialType: 'acrylic-cyan',
          x: 0.0,
          y: 0.0,
          width: 4.3,
          height: 1.92,
          screwIds: ['s7', 's8', 's9'],
        },
      ],
      solutionOrder: ['s7', 's8', 's9', 's2', 's4', 's6', 's1', 's3', 's5'],
    };
  }

  if (!ddaProfile && safeDepth === 3) {
    // L4: 12 bolts, 4 colours, 2 layers forcing >= 1 bolt (s12 crimson) into the Spare Dock to release lower bolts
    return {
      index: 3,
      name: 'Level 4',
      subtitle: 'Park waiting bolts in the Spare Dock to uncover hidden bolts.',
      difficulty: 'Machinist',
      parTimeSec: 95,
      boxSequence: ['amber', 'cobalt', 'crimson', 'emerald'],
      screws: [
        { id: 's1', x: -2.85, y: 1.56, layer: 1, color: 'amber' },
        { id: 's2', x: -0.57, y: 0.52, layer: 1, color: 'amber' },
        { id: 's3', x: -0.57, y: 1.56, layer: 1, color: 'crimson' },
        { id: 's4', x: 0.57, y: 0.52, layer: 1, color: 'cobalt' },
        { id: 's5', x: 1.71, y: 1.56, layer: 1, color: 'cobalt' },
        { id: 's6', x: 2.85, y: 0.52, layer: 1, color: 'emerald' },
        { id: 's7', x: -1.71, y: -0.52, layer: 1, color: 'crimson' },
        { id: 's8', x: -0.57, y: -0.52, layer: 1, color: 'emerald' },
        { id: 's9', x: 2.85, y: -1.56, layer: 1, color: 'emerald' },
        { id: 's10', x: -1.71, y: 0.52, layer: 2, color: 'amber' },
        { id: 's11', x: 1.71, y: 0.52, layer: 2, color: 'cobalt' },
        { id: 's12', x: 0.57, y: -0.52, layer: 2, color: 'crimson' },
      ],
      plates: [
        {
          id: 'p1',
          name: 'Port Assembly Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'brushed-brass',
          x: -1.71,
          y: 1.04,
          width: 3.16,
          height: 1.92,
          screwIds: ['s1', 's2', 's3'],
        },
        {
          id: 'p2',
          name: 'Starboard Assembly Plate',
          layer: 1,
          shape: 'rect',
          materialType: 'blued-steel',
          x: 1.71,
          y: 1.04,
          width: 3.16,
          height: 1.92,
          screwIds: ['s4', 's5', 's6'],
        },
        {
          id: 'p3',
          name: 'Base Chassis Bar',
          layer: 1,
          shape: 'rect',
          materialType: 'anodized-slate',
          x: 0.0,
          y: -1.04,
          width: 6.58,
          height: 1.92,
          screwIds: ['s7', 's8', 's9'],
        },
        {
          id: 'p4',
          name: 'Top Amber Bridge',
          layer: 2,
          shape: 'rect',
          materialType: 'acrylic-amber',
          x: 0.0,
          y: 0.0,
          width: 4.3,
          height: 1.92,
          screwIds: ['s10', 's11', 's12'],
        },
      ],
      solutionOrder: ['s10', 's11', 's12', 's1', 's2', 's4', 's5', 's3', 's7', 's6', 's8', 's9'],
    };
  }

  const actualSeed =
    seed !== undefined ? seed : (safeDepth + 1) * 7919 + 104729;
  const rng = createSeededRng(actualSeed);

  // 1. Progressive & Real-Time DDA-Tuned Difficulty Parameters
  // Capped at 8 boxes (24 bolts) so every bolt has its own dedicated cell in the 6x4 (24-cell) lattice!
  const totalBoxes = ddaProfile
    ? Math.max(3, Math.min(8, ddaProfile.targetBoxes))
    : Math.min(8, Math.max(3, 1 + safeDepth));
  const totalScrews = totalBoxes * 3;

  const rawLayers = ddaProfile
    ? ddaProfile.targetLayers
    : safeDepth <= 3
      ? 2
      : safeDepth <= 5
        ? 3
        : safeDepth <= 7
          ? 4
          : 5;
  const numLayers = Math.max(
    2,
    Math.min(5, rawLayers, Math.floor(totalScrews / 3))
  );
  const numColors = ddaProfile
    ? Math.max(3, Math.min(ALL_SCREW_COLORS.length, ddaProfile.targetColors))
    : Math.min(ALL_SCREW_COLORS.length, Math.max(3, 2 + Math.ceil((safeDepth - 2) * 1.1)));

  // On Level 1 (depth 0), use the classic 3 colors; on higher levels (depth >= 1),
  // weave in the expanded exotic colors (magenta, cyan, lime, copper, violet, titanium, emerald)
  const activePalette: ScrewColor[] = (() => {
    if (safeDepth === 0) {
      return ALL_SCREW_COLORS.slice(0, numColors);
    }
    const basePool = [...ALL_SCREW_COLORS];
    // Rotate/prioritize new colors as depth increases so higher levels immediately feel fresh
    const highTierColors: ScrewColor[] = [
      'magenta',
      'cyan',
      'lime',
      'copper',
      'violet',
      'emerald',
      'titanium',
      'amber',
      'cobalt',
      'crimson',
    ];
    const picked: ScrewColor[] = [];
    const offset = (safeDepth - 1) % 4;
    for (let i = 0; i < highTierColors.length && picked.length < numColors; i++) {
      const candidate = highTierColors[(i + offset) % highTierColors.length];
      if (!picked.includes(candidate)) {
        picked.push(candidate);
      }
    }
    for (const c of basePool) {
      if (picked.length >= numColors) break;
      if (!picked.includes(c)) picked.push(c);
    }
    return picked;
  })();

  // Distribute `totalScrews` across `numLayers` (top layer gets 3 bolts, lower layers get 3..6 bolts)
  const boltsPerLayer = new Array(numLayers).fill(3);
  let remainingToAssign = totalScrews - numLayers * 3;
  let layerCursor = 0;
  while (remainingToAssign > 0) {
    const targetLayer = layerCursor % Math.max(1, numLayers - 1);
    if (boltsPerLayer[targetLayer] < 6) {
      boltsPerLayer[targetLayer] += 1;
      remainingToAssign -= 1;
    }
    layerCursor += 1;
    if (layerCursor > 100 && remainingToAssign > 0) {
      boltsPerLayer[numLayers - 1] += 1;
      remainingToAssign -= 1;
    }
  }

  // 2. Assign Unique (col, row) Lattice Cells & Disjoint Layer Zones from Top Layer (numLayers) down to Layer 1
  const usedCellKeys = new Set<string>();
  const cellKey = (c: number, r: number) => `${c},${r}`;
  const isCellFree = (c: number, r: number) => !usedCellKeys.has(cellKey(c, r));

  // Track cells covered by upper plates so lower layers preferentially place bolts underneath upper plates!
  const coveredByUpperPlate = new Set<string>();

  const idPrefix = `e${safeDepth}`;
  const screwsByLayer = new Map<number, ScrewBlueprint[]>();
  const platesByLayer = new Map<number, PlateBlueprint[]>();

  for (let layer = numLayers; layer >= 1; layer--) {
    const count = boltsPerLayer[layer - 1];
    const isTopLayer = layer === numLayers;
    const layerScrews: ScrewBlueprint[] = [];
    const layerPlates: PlateBlueprint[] = [];
    let sCounter = 1;

    const addScrewAtCell = (cell: GridCell): ScrewBlueprint => {
      usedCellKeys.add(cellKey(cell.c, cell.r));
      const sc: ScrewBlueprint = {
        id: `${idPrefix}_L${layer}_s${sCounter++}`,
        x: LATTICE_COL_X[cell.c],
        y: LATTICE_ROW_Y[cell.r],
        layer,
        color: 'amber', // Assigned constructively in step 4
      };
      layerScrews.push(sc);
      return sc;
    };

    const markPlateCoverage = (plateScrews: ScrewBlueprint[]) => {
      let minC = 5;
      let maxC = 0;
      let minR = 3;
      let maxR = 0;
      for (const s of plateScrews) {
        const cIdx = LATTICE_COL_X.indexOf(s.x as (typeof LATTICE_COL_X)[number]);
        const rIdx = LATTICE_ROW_Y.indexOf(s.y as (typeof LATTICE_ROW_Y)[number]);
        if (cIdx !== -1) {
          if (cIdx < minC) minC = cIdx;
          if (cIdx > maxC) maxC = cIdx;
        }
        if (rIdx !== -1) {
          if (rIdx < minR) minR = rIdx;
          if (rIdx > maxR) maxR = rIdx;
        }
      }
      for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
          coveredByUpperPlate.add(cellKey(c, r));
        }
      }
    };

    const getFreeCellsInRect = (
      cMin: number,
      cMax: number,
      rMin: number,
      rMax: number
    ): GridCell[] => {
      const res: GridCell[] = [];
      for (let c = cMin; c <= cMax; c++) {
        for (let r = rMin; r <= rMax; r++) {
          if (isCellFree(c, r)) {
            res.push({ c, r });
          }
        }
      }
      // On lower layers, prioritize cells that are covered by upper plates for rich interlocking
      if (layer < numLayers) {
        res.sort((a, b) => {
          const covA = coveredByUpperPlate.has(cellKey(a.c, a.r)) ? 1 : 0;
          const covB = coveredByUpperPlate.has(cellKey(b.c, b.r)) ? 1 : 0;
          return covB - covA;
        });
      }
      return res;
    };

    // Define disjoint rectangular zones on the 6x4 lattice for this layer:
    // Alternating Horizontal Row Splits vs Vertical Column Splits guarantees:
    //  - Zero same-layer plate overlap
    //  - Perpendicular cross-layer plate interlocking!
    let zoneDefs: { cMin: number; cMax: number; rMin: number; rMax: number }[] =
      [];

    if (isTopLayer && count <= 3) {
      // Single central bridge plate spanning the middle of the board
      zoneDefs = [{ cMin: 1, cMax: 4, rMin: 1, rMax: 2 }];
    } else if (layer % 2 === 1) {
      // Odd layer: North Row Zone (r = 2..3) & South Row Zone (r = 0..1)
      zoneDefs = [
        { cMin: 0, cMax: 5, rMin: 2, rMax: 3 },
        { cMin: 0, cMax: 5, rMin: 0, rMax: 1 },
      ];
    } else {
      // Even layer: West Column Zone (c = 0..2) & East Column Zone (c = 3..5)
      zoneDefs = [
        { cMin: 0, cMax: 2, rMin: 0, rMax: 3 },
        { cMin: 3, cMax: 5, rMin: 0, rMax: 3 },
      ];
    }

    // Allocate `count` bolts across `zoneDefs`
    const zonePools = zoneDefs.map((z) =>
      getFreeCellsInRect(z.cMin, z.cMax, z.rMin, z.rMax)
    );
    const totalInZones = zonePools.reduce((acc, p) => acc + p.length, 0);

    // Fallback if a zone ran low on cells: partition all remaining free cells by row or column
    if (totalInZones < count) {
      const allFree = getFreeCellsInRect(0, 5, 0, 3);
      allFree.sort((a, b) =>
        layer % 2 === 1 ? a.r - b.r || a.c - b.c : a.c - b.c || a.r - b.r
      );
      const half = Math.ceil(count / 2);
      zonePools.length = 0;
      zonePools.push(allFree.slice(0, half), allFree.slice(half));
    }

    const layerNames =
      PLATE_NAMES_BY_LAYER[(layer - 1) % PLATE_NAMES_BY_LAYER.length];
    const materialPool =
      layer >= numLayers - 1 ? ACRYLIC_MATERIALS : METAL_MATERIALS;

    if (zonePools.length === 1) {
      const picked = pickSpreadCellsFromZone(zonePools[0], count, rng);
      const pScrews = picked.map(addScrewAtCell);
      const mat = materialPool[Math.floor(rng() * materialPool.length)];
      const plate = buildLatticePlateForScrews(
        `${idPrefix}_L${layer}_p1`,
        layerNames[0],
        layer,
        pScrews,
        mat
      );
      layerPlates.push(plate);
      markPlateCoverage(pScrews);
    } else {
      // Distribute `count` across the 2 disjoint zones (at least 1..3 per zone, respecting pool size)
      let count0 = Math.min(
        zonePools[0].length,
        Math.max(count - zonePools[1].length, Math.ceil(count / 2))
      );
      let count1 = count - count0;
      if (count1 > zonePools[1].length) {
        count1 = zonePools[1].length;
        count0 = Math.min(zonePools[0].length, count - count1);
      }

      const counts = [count0, count1];
      for (let zIdx = 0; zIdx < 2; zIdx++) {
        const zCount = counts[zIdx];
        if (zCount <= 0) continue;
        const picked = pickSpreadCellsFromZone(zonePools[zIdx], zCount, rng);
        const pScrews = picked.map(addScrewAtCell);
        const mat =
          materialPool[(layer + zIdx + Math.floor(rng() * 2)) % materialPool.length];
        const plate = buildLatticePlateForScrews(
          `${idPrefix}_L${layer}_p${zIdx + 1}`,
          layerNames[zIdx % layerNames.length],
          layer,
          pScrews,
          mat
        );
        layerPlates.push(plate);
        markPlateCoverage(pScrews);
      }
    }

    screwsByLayer.set(layer, layerScrews);
    platesByLayer.set(layer, layerPlates);
  }

  // Assemble screws and plates in ascending layer order (Layer 1 .. numLayers)
  const screws: ScrewBlueprint[] = [];
  const plates: PlateBlueprint[] = [];
  for (let l = 1; l <= numLayers; l++) {
    screws.push(...(screwsByLayer.get(l) ?? []));
    plates.push(...(platesByLayer.get(l) ?? []));
  }

  // 3. Build Target Box Color Sequence (`boxSequence`)
  const boxSequence: ScrewColor[] = [];
  const colorBag = [...activePalette];
  for (let i = colorBag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [colorBag[i], colorBag[j]] = [colorBag[j], colorBag[i]];
  }
  for (let b = 0; b < totalBoxes; b++) {
    let pick = colorBag[b % colorBag.length];
    if (
      b > 0 &&
      pick === boxSequence[b - 1] &&
      activePalette.length > 1 &&
      rng() < 0.85
    ) {
      pick = colorBag[(b + 1) % colorBag.length];
    }
    boxSequence.push(pick);
  }

  // 4. Constructive Top-Down Playthrough Simulator to Assign Bolt Colors
  const remainingScrewIds = new Set<string>(screws.map((s) => s.id));
  const activePlateIds = new Set<string>(plates.map((p) => p.id));
  const plateRemainingCounts = new Map<string, number>();
  for (const p of plates) {
    plateRemainingCounts.set(p.id, p.screwIds.length);
  }

  const isScrewCurrentlyBlocked = (s: ScrewBlueprint): boolean => {
    for (const p of plates) {
      if (!activePlateIds.has(p.id)) continue;
      if (p.layer <= s.layer) continue;
      if (isPointCoveredByBlueprintPlate(s.x, s.y, p)) {
        return true;
      }
    }
    return false;
  };

  interface SimBox {
    color: ScrewColor;
    filled: number;
  }

  const upcomingQueue: ScrewColor[] = [...boxSequence];
  const simActiveBoxes: (SimBox | null)[] = [
    upcomingQueue.length > 0
      ? { color: upcomingQueue.shift()!, filled: 0 }
      : null,
    upcomingQueue.length > 0
      ? { color: upcomingQueue.shift()!, filled: 0 }
      : null,
  ];
  const simDock: ScrewColor[] = [];

  const maxConstructiveDock = ddaProfile
    ? Math.max(0, Math.min(4, ddaProfile.dockInterleaveLimit))
    : safeDepth === 0
      ? 0
      : safeDepth === 1
        ? 1
        : safeDepth <= 3
          ? 2
          : 3;
  const interleaveChance = ddaProfile
    ? Math.max(0, Math.min(0.72, ddaProfile.interleaveChance))
    : Math.min(0.58, safeDepth * 0.14);

  const sweepSimDock = () => {
    let swept = true;
    while (swept) {
      swept = false;
      for (let d = 0; d < simDock.length; d++) {
        const dColor = simDock[d];
        const matchingBoxIdx = simActiveBoxes.findIndex(
          (b) => b !== null && b.color === dColor && b.filled < 3
        );
        if (matchingBoxIdx !== -1) {
          simDock.splice(d, 1);
          const box = simActiveBoxes[matchingBoxIdx]!;
          box.filled += 1;
          if (box.filled >= 3) {
            simActiveBoxes[matchingBoxIdx] =
              upcomingQueue.length > 0
                ? { color: upcomingQueue.shift()!, filled: 0 }
                : null;
          }
          swept = true;
          break;
        }
      }
    }
  };

  const solutionOrder: string[] = [];

  while (remainingScrewIds.size > 0) {
    const unblocked = screws.filter(
      (s) => remainingScrewIds.has(s.id) && !isScrewCurrentlyBlocked(s)
    );

    const candidates =
      unblocked.length > 0
        ? unblocked
        : screws.filter((s) => remainingScrewIds.has(s.id));

    candidates.sort((a, b) => {
      if (b.layer !== a.layer) return b.layer - a.layer;
      const plateA = plates.find((p) => p.screwIds.includes(a.id));
      const plateB = plates.find((p) => p.screwIds.includes(b.id));
      const remA = plateA ? (plateRemainingCounts.get(plateA.id) ?? 3) : 3;
      const remB = plateB ? (plateRemainingCounts.get(plateB.id) ?? 3) : 3;
      return remA - remB;
    });

    const highestLayer = candidates[0].layer;
    const topLayerPool = candidates.filter((c) => c.layer === highestLayer);
    const chosen =
      safeDepth === 0
        ? topLayerPool[0]
        : topLayerPool[Math.floor(rng() * topLayerPool.length)];

    let assignedColor: ScrewColor | null = null;

    if (
      simDock.length < maxConstructiveDock &&
      upcomingQueue.length > 0 &&
      rng() < interleaveChance
    ) {
      const nextUpcomingColor = upcomingQueue[0];
      const alreadyInDockForNext = simDock.filter(
        (c) => c === nextUpcomingColor
      ).length;
      const isAlsoActive = simActiveBoxes.some(
        (b) => b !== null && b.color === nextUpcomingColor && b.filled < 3
      );
      if (!isAlsoActive && alreadyInDockForNext < 2) {
        assignedColor = nextUpcomingColor;
        simDock.push(assignedColor);
      }
    }

    if (!assignedColor) {
      const availableBoxIndices = [0, 1].filter(
        (idx) => simActiveBoxes[idx] !== null && simActiveBoxes[idx]!.filled < 3
      );
      const chosenBoxIdx =
        safeDepth === 0 || availableBoxIndices.length === 1
          ? availableBoxIndices[0]
          : availableBoxIndices[Math.floor(rng() * availableBoxIndices.length)];

      const targetBox = simActiveBoxes[chosenBoxIdx]!;
      assignedColor = targetBox.color;
      targetBox.filled += 1;

      if (targetBox.filled >= 3) {
        simActiveBoxes[chosenBoxIdx] =
          upcomingQueue.length > 0
            ? { color: upcomingQueue.shift()!, filled: 0 }
            : null;
        sweepSimDock();
      }
    }

    chosen.color = assignedColor;
    remainingScrewIds.delete(chosen.id);
    solutionOrder.push(chosen.id);

    for (const p of plates) {
      if (!activePlateIds.has(p.id)) continue;
      if (p.screwIds.includes(chosen.id)) {
        const nextCount = (plateRemainingCounts.get(p.id) ?? 1) - 1;
        plateRemainingCounts.set(p.id, nextCount);
        if (nextCount <= 0) {
          activePlateIds.delete(p.id);
        }
      }
    }
  }

  // 5. Higher-Level Special Bolt Modifiers (Chaotic, Rainbow Wildcard, & Unknown '?' Mystery Bolts unlock at Level 10 / depth >= 9 after FTUE)
  if (safeDepth >= 9) {
    const chaoticCount = Math.min(
      5,
      1 + Math.floor(safeDepth * 0.85)
    );
    const rainbowCount = Math.min(
      3,
      1 + Math.floor((safeDepth - 1) * 0.5)
    );
    const unknownCount = Math.min(
      4,
      1 + Math.floor(safeDepth * 0.65)
    );

    // Shuffle screws deterministically to assign special variants across layers
    const candidateIndices = screws.map((_, idx) => idx);
    for (let i = candidateIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateIndices[i], candidateIndices[j]] = [
        candidateIndices[j],
        candidateIndices[i],
      ];
    }

    let cursor = 0;

    // 5a. Assign Chaotic Bolts (continuously shift/cycle through 3..4 colors on the board)
    for (let c = 0; c < chaoticCount && cursor < candidateIndices.length; c++) {
      const s = screws[candidateIndices[cursor++]];
      s.specialVariant = 'chaotic';
      const cycle: ScrewColor[] = [s.color];
      for (const col of activePalette) {
        if (cycle.length >= 4) break;
        if (!cycle.includes(col)) {
          cycle.push(col);
        }
      }
      s.chaosCycleColors = cycle;
    }

    // 5b. Assign Rainbow Bolts (prismatic full-spectrum wildcard bolts)
    for (let r = 0; r < rainbowCount && cursor < candidateIndices.length; r++) {
      const s = screws[candidateIndices[cursor++]];
      s.specialVariant = 'rainbow';
    }

    // 5c. Assign Unknown '?' Mystery Bolts (shrouded until revealed as the level goes on or when extracted)
    for (let u = 0; u < unknownCount && cursor < candidateIndices.length; u++) {
      const s = screws[candidateIndices[cursor++]];
      s.specialVariant = 'unknown';
      const solIdx = solutionOrder.indexOf(s.id);
      s.unknownRevealAtMove =
        solIdx > 2 ? Math.max(2, solIdx - 1) : Math.max(2, Math.floor(screws.length * 0.35));
    }
  }

  const difficultyTier: LevelBlueprint['difficulty'] =
    safeDepth <= 1
      ? 'Apprentice'
      : safeDepth <= 3
        ? 'Machinist'
        : safeDepth <= 5
          ? 'Horologist'
          : 'Master Engineer';

  return {
    index: safeDepth,
    name: `Level ${safeDepth + 1}`,
    subtitle: 'Unbolt interlocking plates in sequence to clear the workbench.',
    difficulty: difficultyTier,
    parTimeSec: 45 + totalBoxes * 18,
    boxSequence,
    screws,
    plates,
    solutionOrder,
  };
}

export const LEVELS: LevelBlueprint[] = [
  // LEVEL 1: Calibration Bracket (9 screws on unique 6x4 lattice cells, 2 layers, 4 plates)
  {
    index: 0,
    name: '01. Calibration Bracket',
    subtitle: 'Clear top acrylic guards to release the brass core.',
    difficulty: 'Apprentice',
    parTimeSec: 65,
    boxSequence: ['amber', 'cobalt', 'crimson'],
    screws: [
      // Layer 1 (6 unique lattice cells)
      { id: 's1', x: -2.85, y: 1.56, layer: 1, color: 'crimson' },
      { id: 's2', x: -0.57, y: 0.52, layer: 1, color: 'cobalt' },
      { id: 's3', x: 2.85, y: 1.56, layer: 1, color: 'crimson' },
      { id: 's4', x: -2.85, y: -1.56, layer: 1, color: 'cobalt' },
      { id: 's5', x: 0.57, y: -1.56, layer: 1, color: 'crimson' },
      { id: 's6', x: 2.85, y: -1.56, layer: 1, color: 'cobalt' },
      // Layer 2 (3 unique lattice cells spanning c=1..4, r=1..2 so p4 cleanly covers s2 at (-0.57, 0.52)!)
      { id: 's7', x: -1.71, y: 0.52, layer: 2, color: 'amber' },
      { id: 's8', x: 0.57, y: -0.52, layer: 2, color: 'amber' },
      { id: 's9', x: 1.71, y: 0.52, layer: 2, color: 'amber' },
    ],
    plates: [
      {
        id: 'p1',
        name: 'Upper Left Guard',
        layer: 1,
        shape: 'rect',
        materialType: 'brushed-brass',
        x: -1.71,
        y: 1.04,
        width: 3.16,
        height: 1.92,
        screwIds: ['s1', 's2'],
      },
      {
        id: 'p2',
        name: 'Upper Right Guard',
        layer: 1,
        shape: 'rect',
        materialType: 'blued-steel',
        x: 1.14,
        y: 1.04,
        width: 4.3,
        height: 1.92,
        screwIds: ['s2', 's3'],
      },
      {
        id: 'p3',
        name: 'Lower Span Plate',
        layer: 1,
        shape: 'rect',
        materialType: 'brushed-brass',
        x: 0.0,
        y: -1.56,
        width: 6.58,
        height: 0.88,
        screwIds: ['s4', 's5', 's6'],
      },
      {
        id: 'p4',
        name: 'Center Acrylic Bridge',
        layer: 2,
        shape: 'rect',
        materialType: 'acrylic-cyan',
        x: 0.0,
        y: 0.0,
        width: 4.3,
        height: 1.92,
        screwIds: ['s7', 's8', 's9'],
      },
    ],
  },
];
