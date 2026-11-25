import type { NSFWJS, PredictionType } from 'nsfwjs/core';
import { getMediaProxyUrl } from '../services/forumService';
import { isGifImage } from './utils';

export type NsfwClassName = 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';

export interface NsfwCheckResult {
  safe: boolean;
  reason?: string;
  topClass: NsfwClassName;
  topProbability: number;
  framesChecked: number;
  predictions: PredictionType[];
}

export interface NsfwProgress {
  stage: 'loading-model' | 'downloading' | 'analyzing';
  currentFrame?: number;
  totalFrames?: number;
}

const THRESHOLDS = {
  porn: 0.6,
  hentai: 0.6,
  sexy: 0.85,
  combinedExplicit: 0.7,
} as const;

const MAX_GIF_FRAMES_TO_CHECK = 8;

const LABELS_RU: Record<NsfwClassName, string> = {
  Porn: 'порнография',
  Hentai: 'хентай / 18+ арт',
  Sexy: 'откровенный контент',
  Drawing: 'рисунок',
  Neutral: 'нейтрально',
};

let modelPromise: Promise<NSFWJS> | null = null;

async function loadNsfwModel(): Promise<NSFWJS> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, core, mobilenet] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('nsfwjs/core'),
        import('nsfwjs/models/mobilenet_v2'),
      ]);
      await tf.ready();
      return await core.load('MobileNetV2', {
        modelDefinitions: [mobilenet.MobileNetV2Model],
      });
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

function evaluatePredictions(
  predictions: PredictionType[],
  frameInfo?: { frameNumber: number; totalFrames: number },
): NsfwCheckResult {
  const scores: Record<NsfwClassName, number> = {
    Drawing: 0,
    Hentai: 0,
    Neutral: 0,
    Porn: 0,
    Sexy: 0,
  };
  for (const p of predictions) {
    if (p.className in scores) {
      scores[p.className as NsfwClassName] = p.probability;
    }
  }

  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0] ?? { className: 'Neutral' as NsfwClassName, probability: 1 };
  const frameSuffix =
    frameInfo && frameInfo.totalFrames > 1
      ? ` (кадр ${frameInfo.frameNumber}/${frameInfo.totalFrames})`
      : '';

  if (scores.Porn >= THRESHOLDS.porn) {
    return {
      safe: false,
      reason: `Обнаружен NSFW-контент: ${LABELS_RU.Porn} (${Math.round(scores.Porn * 100)}%)${frameSuffix}`,
      topClass: 'Porn',
      topProbability: scores.Porn,
      framesChecked: frameInfo?.frameNumber ?? 1,
      predictions,
    };
  }

  if (scores.Hentai >= THRESHOLDS.hentai) {
    return {
      safe: false,
      reason: `Обнаружен NSFW-контент: ${LABELS_RU.Hentai} (${Math.round(scores.Hentai * 100)}%)${frameSuffix}`,
      topClass: 'Hentai',
      topProbability: scores.Hentai,
      framesChecked: frameInfo?.frameNumber ?? 1,
      predictions,
    };
  }

  const explicitSum = scores.Porn + scores.Hentai;
  if (explicitSum >= THRESHOLDS.combinedExplicit) {
    const dominant: NsfwClassName = scores.Porn >= scores.Hentai ? 'Porn' : 'Hentai';
    return {
      safe: false,
      reason: `Обнаружен NSFW-контент (${Math.round(explicitSum * 100)}%)${frameSuffix}`,
      topClass: dominant,
      topProbability: explicitSum,
      framesChecked: frameInfo?.frameNumber ?? 1,
      predictions,
    };
  }

  if (scores.Sexy >= THRESHOLDS.sexy) {
    return {
      safe: false,
      reason: `Обнаружен NSFW-контент: ${LABELS_RU.Sexy} (${Math.round(scores.Sexy * 100)}%)${frameSuffix}`,
      topClass: 'Sexy',
      topProbability: scores.Sexy,
      framesChecked: frameInfo?.frameNumber ?? 1,
      predictions,
    };
  }

  return {
    safe: true,
    topClass: top.className as NsfwClassName,
    topProbability: top.probability,
    framesChecked: frameInfo?.frameNumber ?? 1,
    predictions,
  };
}

function hasGifSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  // "GIF87a" or "GIF89a"
  return (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

function selectSampleIndices(total: number, maxSamples: number): Set<number> {
  const indices = new Set<number>();
  if (total <= maxSamples) {
    for (let i = 0; i < total; i++) indices.add(i);
    return indices;
  }
  for (let s = 0; s < maxSamples; s++) {
    const idx = Math.round((s * (total - 1)) / (maxSamples - 1));
    indices.add(idx);
  }
  return indices;
}

async function classifyBlobAsStaticImage(model: NSFWJS, blob: Blob): Promise<NsfwCheckResult> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось декодировать изображение для проверки NSFW'));
      el.src = objectUrl;
    });
    const predictions = await model.classify(img);
    return evaluatePredictions(predictions);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function classifyGifBuffer(
  model: NSFWJS,
  buffer: ArrayBuffer,
  onProgress?: (progress: NsfwProgress) => void,
): Promise<NsfwCheckResult> {
  const { parseGIF, decompressFrames } = await import('gifuct-js');
  const parsed = parseGIF(buffer);
  const frames = decompressFrames(parsed, true);

  if (!frames.length) {
    throw new Error('GIF не содержит кадров');
  }

  const width = Math.max(1, parsed.lsd.width || frames[0].dims.width);
  const height = Math.max(1, parsed.lsd.height || frames[0].dims.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D недоступен для проверки GIF');
  }

  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d');
  if (!patchCtx) {
    throw new Error('Canvas 2D недоступен для проверки GIF');
  }

  const sampleIndices = selectSampleIndices(frames.length, MAX_GIF_FRAMES_TO_CHECK);
  const totalSamples = sampleIndices.size;
  let checkedCount = 0;
  let lastResult: NsfwCheckResult | null = null;
  let prevImageData: ImageData | null = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { dims, patch, disposalType } = frame;

    if (disposalType === 3) {
      prevImageData = ctx.getImageData(0, 0, width, height);
    }

    if (dims.width > 0 && dims.height > 0 && patch.length === dims.width * dims.height * 4) {
      patchCanvas.width = dims.width;
      patchCanvas.height = dims.height;
      const frameImageData = new ImageData(new Uint8ClampedArray(patch), dims.width, dims.height);
      patchCtx.putImageData(frameImageData, 0, 0);
      ctx.drawImage(patchCanvas, dims.left, dims.top);
    }

    if (sampleIndices.has(i)) {
      checkedCount += 1;
      onProgress?.({
        stage: 'analyzing',
        currentFrame: checkedCount,
        totalFrames: totalSamples,
      });

      const predictions = await model.classify(canvas);
      const res = evaluatePredictions(predictions, {
        frameNumber: checkedCount,
        totalFrames: totalSamples,
      });
      lastResult = res;
      if (!res.safe) {
        return res;
      }
    }

    if (disposalType === 2) {
      ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
    } else if (disposalType === 3 && prevImageData) {
      ctx.putImageData(prevImageData, 0, 0);
    }
  }

  return (
    lastResult ?? {
      safe: true,
      topClass: 'Neutral',
      topProbability: 1,
      framesChecked: checkedCount,
      predictions: [],
    }
  );
}

export async function checkMediaBlob(
  blob: Blob,
  filename?: string,
  onProgress?: (progress: NsfwProgress) => void,
): Promise<NsfwCheckResult> {
  onProgress?.({ stage: 'loading-model' });
  const model = await loadNsfwModel();

  const buffer = await blob.arrayBuffer();
  const isGif =
    blob.type === 'image/gif' ||
    isGifImage(undefined, filename) ||
    hasGifSignature(new Uint8Array(buffer, 0, Math.min(6, buffer.byteLength)));

  if (isGif) {
    try {
      onProgress?.({ stage: 'analyzing', currentFrame: 1, totalFrames: 1 });
      return await classifyGifBuffer(model, buffer, onProgress);
    } catch {
      // Fallback to classifying the rendered first frame if the GIF structure is unusual.
      onProgress?.({ stage: 'analyzing', currentFrame: 1, totalFrames: 1 });
      return await classifyBlobAsStaticImage(model, blob);
    }
  }

  onProgress?.({ stage: 'analyzing', currentFrame: 1, totalFrames: 1 });
  return await classifyBlobAsStaticImage(model, blob);
}

export async function checkMediaFile(
  file: File,
  onProgress?: (progress: NsfwProgress) => void,
): Promise<NsfwCheckResult> {
  return await checkMediaBlob(file, file.name, onProgress);
}

export async function checkMediaUrl(
  url: string,
  onProgress?: (progress: NsfwProgress) => void,
): Promise<NsfwCheckResult> {
  const trimmed = url.trim();
  onProgress?.({ stage: 'downloading' });

  let blob: Blob | null = null;
  try {
    const direct = await fetch(trimmed, { mode: 'cors', credentials: 'omit' });
    if (direct.ok) {
      blob = await direct.blob();
    }
  } catch {
    // Expected when the remote host does not send CORS headers.
  }

  if (!blob) {
    const proxied = await fetch(getMediaProxyUrl(trimmed), { credentials: 'include' });
    if (!proxied.ok) {
      throw new Error('Не удалось загрузить медиа по ссылке для проверки NSFW.');
    }
    blob = await proxied.blob();
  }

  return await checkMediaBlob(blob, trimmed, onProgress);
}

export function extractInlineGifUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)<>"]+\.gif(?:\?[^\s)<>"]*)?/gi);
  if (!matches) return [];
  return Array.from(new Set(matches));
}
