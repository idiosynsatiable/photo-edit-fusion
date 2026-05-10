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
  return parsed.document;
}

export function isProjectFile(json: string): boolean {
  try {
    const raw: unknown = JSON.parse(json);
    return ProjectFileV1Schema.safeParse(raw).success;
  } catch {
    return false;
  }
}
