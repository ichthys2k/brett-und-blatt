import { parseCrest, serializeCrest } from '@brett-und-blatt/engine';

/** Das Wappen, wie es an einen Raum geht: nur eine gültige Beschreibung und nur, wenn die Person es zeigen will. */
export function crestForRoom(text: string | null): string | undefined {
  const spec = text ? parseCrest(text) : null;
  return spec && spec.inRoom ? serializeCrest(spec) : undefined;
}
