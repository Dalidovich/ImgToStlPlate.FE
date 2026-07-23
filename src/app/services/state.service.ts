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
    this.revokeUrl(this.originalBwImageUrl);
    this.originalBwImageUrl = null;
    this.revokeUrl(this.currentBwImageUrl);
    this.currentBwImageUrl = null;
  }

  setBwImage(blob: Blob): void {
    this.revokeUrl(this.originalBwImageUrl);
    this.originalBwImage = blob;
    this.originalBwImageUrl = URL.createObjectURL(blob);
    this.currentBwImage = blob;
    this.currentBwImageUrl = this.originalBwImageUrl;
  }

  setCurrentBwImage(blob: Blob): void {
    if (this.currentBwImageUrl && this.currentBwImageUrl !== this.originalBwImageUrl) {
      this.revokeUrl(this.currentBwImageUrl);
    }
    this.currentBwImage = blob;
    this.currentBwImageUrl = URL.createObjectURL(blob);
  }

  private revokeUrl(url: string | null): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
