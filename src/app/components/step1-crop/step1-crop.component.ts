import { Component, OnDestroy, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CropSelection } from '../../services/convert.service';
import { StateService } from '../../services/state.service';

type CropMode = 'none' | 'crop' | 'genericSize';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-step1-crop',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step1-crop.component.html',
  styleUrl: './step1-crop.component.scss',
})
export class Step1CropComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private image = new Image();
  private animFrameId = 0;

  zoom = 1;
  panX = 0;
  panY = 0;
  minZoom = 0.1;
  maxZoom = 5;

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  mode: CropMode = 'none';

  selectionStart: { x: number; y: number } | null = null;
  selectionRect: Rect | null = null;
  showOk = false;

  imageLoaded = false;
  imageWidth = 0;
  imageHeight = 0;

  constructor(
    readonly router: Router,
    public state: StateService
  ) {}

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.resizeCanvas();
    if (this.state.originalImageUrl) {
      this.loadImageFromUrl(this.state.originalImageUrl);
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement!;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    this.render();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.state.originalImage = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.state.originalImageUrl = reader.result as string;
      this.loadImageFromUrl(this.state.originalImageUrl);
    };
    reader.readAsDataURL(file);

    this.cancelSelection();
  }

  private loadImageFromUrl(url: string): void {
    this.image.onload = () => {
      this.imageWidth = this.image.naturalWidth;
      this.imageHeight = this.image.naturalHeight;
      this.imageLoaded = true;
      // Defer to next frame so canvas DOM has updated dimensions
      requestAnimationFrame(() => {
        this.resizeCanvas();
        this.fitImageToCanvas();
      });
    };
    this.image.src = url;
  }

  fitImageToCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const padding = 40;
    const availW = canvas.width - padding * 2;
    const availH = canvas.height - padding * 2;
    const scaleX = availW / this.imageWidth;
    const scaleY = availH / this.imageHeight;
    this.zoom = Math.min(scaleX, scaleY, 1);
    this.panX = (canvas.width - this.imageWidth * this.zoom) / 2;
    this.panY = (canvas.height - this.imageHeight * this.zoom) / 2;
    this.render();
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = this.zoom;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

    this.panX = mouseX - ((mouseX - this.panX) * this.zoom) / oldZoom;
    this.panY = mouseY - ((mouseY - this.panY) * this.zoom) / oldZoom;
    this.render();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (event.button === 2) {
      event.preventDefault();
      this.cancelSelection();
      return;
    }

    if (event.button === 1) {
      this.startPan(x, y);
      return;
    }

    if (event.button === 0) {
      if (this.mode === 'none') {
        if (!this.showOk) {
          this.startPan(x, y);
        }
        return;
      }

      if (this.mode === 'crop' || this.mode === 'genericSize') {
        if (!this.selectionStart) {
          this.selectionStart = { x, y };
          this.selectionRect = { x, y, width: 0, height: 0 };
        } else {
          this.fixSelection(x, y);
        }
        this.render();
      }
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isPanning) {
      this.panX += x - this.panStartX;
      this.panY += y - this.panStartY;
      this.panStartX = x;
      this.panStartY = y;
      this.render();
      return;
    }

    if ((this.mode === 'crop' || this.mode === 'genericSize') && this.selectionStart) {
      this.selectionRect = this.clampRect(
        Math.min(this.selectionStart.x, x),
        Math.min(this.selectionStart.y, y),
        Math.abs(x - this.selectionStart.x),
        Math.abs(y - this.selectionStart.y)
      );
      this.render();
    }
  }

  onCanvasMouseUp(event: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
    }
  }

  onCanvasContextMenu(event: Event): void {
    event.preventDefault();
  }

  private startPan(x: number, y: number): void {
    this.isPanning = true;
    this.panStartX = x;
    this.panStartY = y;
  }

  private fixSelection(x: number, y: number): void {
    if (!this.selectionStart) return;
    const sx = this.selectionStart.x;
    const sy = this.selectionStart.y;
    const rawX = Math.min(sx, x);
    const rawY = Math.min(sy, y);
    const rawW = Math.abs(x - sx);
    const rawH = Math.abs(y - sy);
    this.selectionRect = this.clampRect(rawX, rawY, rawW, rawH);
    this.selectionStart = null;
    if (this.selectionRect && this.selectionRect.width > 2 && this.selectionRect.height > 2) {
      this.showOk = true;
    }
  }

  private clampRect(x: number, y: number, w: number, h: number): Rect {
    const canvas = this.canvasRef.nativeElement;
    const imgLeft = this.panX;
    const imgTop = this.panY;
    const imgRight = this.panX + this.imageWidth * this.zoom;
    const imgBottom = this.panY + this.imageHeight * this.zoom;
    x = Math.max(imgLeft, x);
    y = Math.max(imgTop, y);
    w = Math.min(w, imgRight - x);
    h = Math.min(h, imgBottom - y);
    return { x, y, width: Math.max(0, w), height: Math.max(0, h) };
  }

  setMode(newMode: CropMode): void {
    if (newMode === this.mode) return;
    if (this.mode !== 'none' && !this.showOk) {
      return;
    }
    this.cancelSelection();
    this.mode = newMode;
  }

  cancelSelection(): void {
    this.selectionStart = null;
    this.selectionRect = null;
    this.showOk = false;
    this.mode = 'none';
    this.render();
  }

  onOkClick(): void {
    if (!this.selectionRect || !this.state.originalImage) return;

    const canvasX = (this.selectionRect.x - this.panX) / this.zoom;
    const canvasY = (this.selectionRect.y - this.panY) / this.zoom;
    const canvasW = this.selectionRect.width / this.zoom;
    const canvasH = this.selectionRect.height / this.zoom;

    this.state.cropSelection = {
      x: Math.round(canvasX),
      y: Math.round(canvasY),
      width: Math.round(canvasW),
      height: Math.round(canvasH),
    };

    this.router.navigate(['/step2']);
  }

  private render(): void {
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => this.drawFrame());
  }

  private drawFrame(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.imageLoaded) return;

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.drawImage(this.image, 0, 0, this.imageWidth, this.imageHeight);
    ctx.restore();

    if (this.selectionRect) {
      const s = this.selectionRect;

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(s.x, s.y, s.width, s.height);
      ctx.setLineDash([]);

      const label = `${Math.round(s.width / this.zoom)} × ${Math.round(s.height / this.zoom)}`;
      ctx.fillStyle = '#00ff88';
      ctx.font = '12px monospace';
      ctx.fillText(label, s.x + 4, s.y - 4);
    }
  }
}
