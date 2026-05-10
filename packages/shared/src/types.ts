import type { BlendMode } from './blend-modes.js';

export type LayerId = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Transform {
  /** position of layer origin in document space, in pixels */
  position: Vec2;
  /** scale factor on each axis */
  scale: Vec2;
  /** rotation in radians */
  rotation: number;
  /** anchor in [0,1] of the layer's local bounding box */
  anchor: Vec2;
}

export interface LayerCommon {
  id: LayerId;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  blendMode: BlendMode;
  transform: Transform;
  /** parent group id, or null for top-level layer */
  parentId: LayerId | null;
  /** soft mask, raster, optional */
  maskBitmapId: string | null;
}

export interface ImageLayer extends LayerCommon {
  type: 'image';
  /** id into the asset registry */
  bitmapId: string;
  /** intrinsic pixel size of the source bitmap */
  sourceWidth: number;
  sourceHeight: number;
}

export interface TextLayer extends LayerCommon {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number; // 100..900
  fontStyle: 'normal' | 'italic';
  fontSizePx: number;
  /** character tracking in em (1em = fontSizePx) */
  letterSpacingEm: number;
  /** line height as multiplier of fontSizePx */
  lineHeight: number;
  align: 'left' | 'center' | 'right' | 'justify';
  /** RGBA color, components in [0,1] */
  color: [number, number, number, number];
  /** Optional Google Fonts URL the family was loaded from */
  webFontUrl: string | null;
}

export interface ShapeLayer extends LayerCommon {
  type: 'shape';
  shape: 'rectangle' | 'ellipse' | 'polygon';
  width: number;
  height: number;
  fill: [number, number, number, number];
  stroke: [number, number, number, number];
  strokeWidth: number;
  cornerRadius: number;
  /** for polygon: number of sides */
  sides: number;
}

export interface GroupLayer extends LayerCommon {
  type: 'group';
  /** child layer ids in render order (bottom first) */
  children: LayerId[];
}

export type Layer = ImageLayer | TextLayer | ShapeLayer | GroupLayer;

export type LayerType = Layer['type'];

export interface Document {
  id: string;
  name: string;
  width: number;
  height: number;
  /** layers ordered bottom-to-top */
  layerOrder: LayerId[];
  layers: Record<LayerId, Layer>;
  /** raster bitmap registry — base64 data URLs keyed by id */
  bitmaps: Record<string, string>;
  background: [number, number, number, number];
  meta: {
    createdAt: string;
    modifiedAt: string;
    appVersion: string;
  };
}

export interface SelectionPath {
  type: 'lasso' | 'polygon' | 'rectangle';
  /** points in document space */
  points: Vec2[];
  /** if true, the path is closed and forms a region */
  closed: boolean;
}

export interface MagicWandSelection {
  type: 'magic-wand';
  /** seed pixel in document space */
  seed: Vec2;
  /** color similarity tolerance, 0..255 in LAB Euclidean distance */
  tolerance: number;
  /** if true, sample is contiguous */
  contiguous: boolean;
}

export type Selection = SelectionPath | MagicWandSelection;

export interface FontMatch {
  family: string;
  /** confidence in [0,1] */
  score: number;
  /** weight as a CSS weight 100..900 if known */
  weight?: number;
  style?: 'normal' | 'italic';
  /** licensing/source */
  source: 'whatthefont' | 'fontspring' | 'google-fonts-similarity';
  /** Google Fonts URL if available */
  googleFontsUrl?: string;
  /** preview image URL */
  sampleUrl?: string;
  /** suggested fallback families (CSS stack) */
  fallbacks: string[];
}

export interface FontMatchResult {
  matches: FontMatch[];
  /** measured metrics from the source crop */
  metrics: {
    estimatedWeight: number; // 100..900
    estimatedItalic: boolean;
    estimatedSizePx: number;
    estimatedTrackingEm: number;
    medianGlyphAspect: number;
    /** OCR'd text used for the match */
    sampleText: string;
  };
  provider: FontMatch['source'];
  /** identification time in ms */
  durationMs: number;
}

export interface ProjectFileV1 {
  formatVersion: 1;
  document: Document;
}
