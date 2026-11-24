import type { Document, ProjectFileV1 } from '@pef/shared';
import { ProjectFileV1Schema } from '@pef/shared';

/** Serialize a Document to a portable .pef JSON string. */
export function toProjectFile(doc: Document): string {
  const file: ProjectFileV1 = { formatVersion: 1, document: doc };
  return JSON.stringify(file);
}

/** Parse a .pef JSON string and validate. Throws on schema failure. */
export function fromProjectFile(json: string): Document {
  const raw: unknown = JSON.parse(json);
  const parsed = ProjectFileV1Schema.parse(raw);
  const doc = parsed.document;
  if (doc.width > 8192 || doc.height > 8192 || doc.width * doc.height > 16_000_000) throw new Error('This project exceeds the 16 megapixel editing limit.');
  if (new Set(doc.layerOrder).size !== doc.layerOrder.length || doc.layerOrder.some((id) => !doc.layers[id] || doc.layers[id]!.id !== id)) throw new Error('The project has an invalid layer order.');
  for (const layer of Object.values(doc.layers)) {
    if (layer.transform.scale.x === 0 || layer.transform.scale.y === 0) throw new Error('A layer has an invalid scale.');
    if (layer.type === 'image' && (!doc.bitmaps[layer.bitmapId] || layer.sourceWidth * layer.sourceHeight > 16_000_000)) throw new Error('A project image is missing or too large.');
  }
  return doc;
}

export function isProjectFile(json: string): boolean {
  try {
    const raw: unknown = JSON.parse(json);
    return ProjectFileV1Schema.safeParse(raw).success;
  } catch {
    return false;
  }
}
