import { Injectable } from '@angular/core';
import { CropSelection } from './convert.service';

@Injectable({ providedIn: 'root' })
export class StateService {
  originalImage: File | null = null;
  originalImageUrl: string | null = null;
  cropSelection: CropSelection | null = null;
  rotation = 0;
  modelWidth = 30;
  modelHeight = 60;
  modelThickness = 2;
  orientation = 'vertical';
  fillSpace = false;
  invert = false;

  originalBwImage: Blob | null = null;
  originalBwImageUrl: string | null = null;
  currentBwImage: Blob | null = null;
  currentBwImageUrl: string | null = null;

  stlBlob: Blob | null = null;

  cleanupObjectUrls(): void {
    this.revokeBwUrls();
    this.revokeUrl(this.originalImageUrl);
    this.originalImageUrl = null;
  }

  resetBwState(): void {
    this.revokeBwUrls();
    this.originalBwImage = null;
    this.currentBwImage = null;
    this.stlBlob = null;
  }

  reset(): void {
    this.resetBwState();
    this.revokeUrl(this.originalImageUrl);
    this.originalImageUrl = null;
    this.originalImage = null;
    this.cropSelection = null;
    this.rotation = 0;
  }

  setBwImage(blob: Blob): void {
    this.revokeBwUrls();
    this.originalBwImage = blob;
    this.originalBwImageUrl = URL.createObjectURL(blob);
    this.currentBwImage = blob;
    this.currentBwImageUrl = this.originalBwImageUrl;
  }

  setCurrentBwImage(blob: Blob): void {
    if (this.currentBwImageUrl !== this.originalBwImageUrl) {
      this.revokeUrl(this.currentBwImageUrl);
    }
    this.currentBwImage = blob;
    this.currentBwImageUrl = URL.createObjectURL(blob);
  }

  restoreOriginalBwImage(): void {
    if (this.currentBwImageUrl !== this.originalBwImageUrl) {
      this.revokeUrl(this.currentBwImageUrl);
    }
    this.currentBwImage = this.originalBwImage;
    this.currentBwImageUrl = this.originalBwImageUrl;
  }

  private revokeBwUrls(): void {
    if (this.currentBwImageUrl !== this.originalBwImageUrl) {
      this.revokeUrl(this.currentBwImageUrl);
    }
    this.revokeUrl(this.originalBwImageUrl);
    this.originalBwImageUrl = null;
    this.currentBwImageUrl = null;
  }

  private revokeUrl(url: string | null): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
