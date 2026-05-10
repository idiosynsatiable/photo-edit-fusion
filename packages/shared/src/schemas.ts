import { z } from 'zod';
import { BLEND_MODES } from './blend-modes.js';

const Vec2Schema = z.object({ x: z.number(), y: z.number() });

const TransformSchema = z.object({
  position: Vec2Schema,
  scale: Vec2Schema,
  rotation: z.number(),
  anchor: Vec2Schema,
});

const RGBASchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);

const LayerCommonSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  blendMode: z.enum(BLEND_MODES),
  transform: TransformSchema,
  parentId: z.string().nullable(),
  maskBitmapId: z.string().nullable(),
});

const ImageLayerSchema = LayerCommonSchema.extend({
  type: z.literal('image'),
  bitmapId: z.string().min(1),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
});

const TextLayerSchema = LayerCommonSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string().min(1),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(['normal', 'italic']),
  fontSizePx: z.number().positive(),
  letterSpacingEm: z.number(),
  lineHeight: z.number().positive(),
  align: z.enum(['left', 'center', 'right', 'justify']),
  color: RGBASchema,
  webFontUrl: z.string().url().nullable(),
});

const ShapeLayerSchema = LayerCommonSchema.extend({
  type: z.literal('shape'),
  shape: z.enum(['rectangle', 'ellipse', 'polygon']),
  width: z.number().positive(),
  height: z.number().positive(),
  fill: RGBASchema,
  stroke: RGBASchema,
  strokeWidth: z.number().min(0),
  cornerRadius: z.number().min(0),
  sides: z.number().int().min(3).max(64),
});

const GroupLayerSchema = LayerCommonSchema.extend({
  type: z.literal('group'),
  children: z.array(z.string()),
});

export const LayerSchema = z.discriminatedUnion('type', [
  ImageLayerSchema,
  TextLayerSchema,
  ShapeLayerSchema,
  GroupLayerSchema,
]);

export const DocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  layerOrder: z.array(z.string()),
  layers: z.record(z.string(), LayerSchema),
  bitmaps: z.record(z.string(), z.string()),
  background: RGBASchema,
  meta: z.object({
    createdAt: z.string(),
    modifiedAt: z.string(),
    appVersion: z.string(),
  }),
});

export const ProjectFileV1Schema = z.object({
  formatVersion: z.literal(1),
  document: DocumentSchema,
});

export const FontIdentifyRequestSchema = z.object({
  /** base64-encoded PNG data of the cropped text region */
  imageBase64: z.string().min(20),
  /** optional hints */
  hints: z
    .object({
      preferProvider: z.enum(['whatthefont', 'fontspring', 'auto']).optional(),
      maxResults: z.number().int().min(1).max(50).optional(),
    })
    .optional(),
});

export type FontIdentifyRequest = z.infer<typeof FontIdentifyRequestSchema>;

export const AiCutRequestSchema = z.object({
  imageBase64: z.string().min(20),
  /** preferred provider */
  preferProvider: z.enum(['local-onnx', 'remove-bg', 'auto']).optional(),
});

export type AiCutRequest = z.infer<typeof AiCutRequestSchema>;
