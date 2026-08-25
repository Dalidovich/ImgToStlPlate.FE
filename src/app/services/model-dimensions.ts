import { CropSelection } from './convert.service';

export const MIN_MODEL_DIMENSION_MM = 1;
export const MAX_MODEL_DIMENSION_MM = 500;
export const MIN_THICKNESS_MM = 0.1;
export const MAX_THICKNESS_MM = 50;

const DEFAULT_MM_PER_PIXEL = 0.1;

export interface ModelDimensions {
  width: number;
  height: number;
}

export function isVerticalOrientation(orientation: string): boolean {
  return orientation === 'vertical';
}

export function defaultModelDimensions(
  crop: CropSelection,
  orientation: string
): ModelDimensions {
  const vertical = isVerticalOrientation(orientation);
  const plateWidthPx = vertical ? crop.height : crop.width;
  const plateHeightPx = vertical ? crop.width : crop.height;
  return scalePreservingAspect(plateWidthPx, plateHeightPx);
}

export function swapDimensions(dimensions: ModelDimensions): ModelDimensions {
  return { width: dimensions.height, height: dimensions.width };
}

export function dimensionError(label: string, value: number | null | undefined): string | null {
  return rangeError(label, value, MIN_MODEL_DIMENSION_MM, MAX_MODEL_DIMENSION_MM);
}

export function thicknessError(value: number | null | undefined): string | null {
  return rangeError('Thickness', value, MIN_THICKNESS_MM, MAX_THICKNESS_MM);
}

function scalePreservingAspect(widthPx: number, heightPx: number): ModelDimensions {
  const width = Math.max(1, widthPx);
  const height = Math.max(1, heightPx);
  const smallest = Math.min(width, height);
  const largest = Math.max(width, height);

  let scale = DEFAULT_MM_PER_PIXEL;
  if (smallest * scale < MIN_MODEL_DIMENSION_MM) {
    scale = MIN_MODEL_DIMENSION_MM / smallest;
  }
  if (largest * scale > MAX_MODEL_DIMENSION_MM) {
    scale = MAX_MODEL_DIMENSION_MM / largest;
  }

  return {
    width: clampDimension(roundMm(width * scale)),
    height: clampDimension(roundMm(height * scale)),
  };
}

function clampDimension(value: number): number {
  return Math.min(MAX_MODEL_DIMENSION_MM, Math.max(MIN_MODEL_DIMENSION_MM, value));
}

function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

function rangeError(
  label: string,
  value: number | null | undefined,
  min: number,
  max: number
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `${label} must be a number.`;
  }
  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max} mm.`;
  }
  return null;
}
