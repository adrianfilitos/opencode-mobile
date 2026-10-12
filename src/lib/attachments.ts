import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Attachment } from '@/lib/api';

export type Picked = Attachment & { kind: 'image' | 'file' };

/** El servidor admite ~5 MB de base64 por imagen (20 MB decodificados en total). */
const MAX_B64 = 4_500_000;

async function shrink(uri: string, width: number, compress: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width, height: null });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  return out.base64 ?? '';
}

/** Foto → JPEG pequeño en base64, como data: URL que el servidor sabe leer. */
export async function fromImageUri(uri: string, name = 'foto'): Promise<Picked> {
  let base64 = await shrink(uri, 1600, 0.7);
  if (base64.length > MAX_B64) base64 = await shrink(uri, 1100, 0.5);
  if (base64.length > MAX_B64) base64 = await shrink(uri, 800, 0.4);
  return {
    kind: 'image',
    uri: `data:image/jpeg;base64,${base64}`,
    name: name.replace(/\.[^.]+$/, '') + '.jpg',
  };
}

export async function pickImages(): Promise<Picked[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Sin permiso para acceder a tus fotos.');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: 4,
  });
  if (res.canceled) return [];
  return Promise.all(res.assets.map((a, i) => fromImageUri(a.uri, a.fileName ?? `foto-${i + 1}`)));
}

export async function takePhoto(): Promise<Picked[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Sin permiso para usar la cámara.');
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (res.canceled) return [];
  return Promise.all(res.assets.map((a) => fromImageUri(a.uri, a.fileName ?? 'foto')));
}

const MIME: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  js: 'text/javascript',
  ts: 'text/plain',
  tsx: 'text/plain',
  cs: 'text/plain',
  py: 'text/plain',
  go: 'text/plain',
  java: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  xml: 'text/xml',
  yml: 'text/plain',
  yaml: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
};

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'text/plain';
}

export async function pickFiles(): Promise<Picked[]> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
  if (res.canceled) return [];
  const out: Picked[] = [];
  for (const a of res.assets) {
    if ((a.size ?? 0) > 20 * 1024 * 1024) {
      throw new Error(`«${a.name}» es demasiado grande (máximo 20 MB).`);
    }
    const base64 = await new File(a.uri).base64();
    const mime = a.mimeType || mimeFromName(a.name);
    out.push({ kind: 'file', uri: `data:${mime};base64,${base64}`, name: a.name });
  }
  return out;
}
