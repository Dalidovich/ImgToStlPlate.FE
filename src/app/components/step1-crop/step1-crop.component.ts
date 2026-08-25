import { Component, OnDestroy, ElementRef, ViewChild, AfterViewInit, HostListener, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CropSelection } from '../../services/convert.service';
import { StateService } from '../../services/state.service';
import { defaultModelDimensions } from '../../services/model-dimensions';

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
  private resizeObserver?: ResizeObserver;

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
  isDragging = false;

  constructor(
    readonly router: Router,
    public state: StateService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;

    const container = this.canvasRef.nativeElement.parentElement!;
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      if (this.imageLoaded) {
        this.fitImageToCanvas();
      }
    });
    this.resizeObserver.observe(container);

    this.resizeCanvas();
    if (this.state.originalImageUrl) {
      this.loadImageFromUrl(this.state.originalImageUrl);
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.resizeObserver?.disconnect();
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
    this.state.resetBwState();
    this.state.originalImage = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.state.originalImageUrl = reader.result as string;
      this.loadImageFromUrl(this.state.originalImageUrl);
    };
    reader.readAsDataURL(file);

    this.cancelSelection();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    this.state.resetBwState();
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
      this.zone.run(() => {
        this.imageWidth = this.image.naturalWidth;
        this.imageHeight = this.image.naturalHeight;
        this.imageLoaded = true;
        this.cdr.markForCheck();
        this.resizeCanvas();
        this.fitImageToCanvas();
      });
    };
    this.image.src = url;
  }

  private rotatedImageMetrics(): {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  } {
    const a = (this.state.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(a));
    const sin = Math.abs(Math.sin(a));
    const width = this.imageWidth * cos + this.imageHeight * sin;
    const height = this.imageWidth * sin + this.imageHeight * cos;
    return {
      width,
      height,
      offsetX: (width - this.imageWidth) / 2,
      offsetY: (height - this.imageHeight) / 2,
    };
  }

  private screenToImage(point: { x: number; y: number }): { x: number; y: number } {
    const { offsetX, offsetY } = this.rotatedImageMetrics();
    return {
      x: (point.x - this.panX) / this.zoom + offsetX,
      y: (point.y - this.panY) / this.zoom + offsetY,
    };
  }

  private imageToScreen(point: { x: number; y: number }): { x: number; y: number } {
    const { offsetX, offsetY } = this.rotatedImageMetrics();
    return {
      x: this.panX + (point.x - offsetX) * this.zoom,
      y: this.panY + (point.y - offsetY) * this.zoom,
    };
  }

  private imageBoundsOnScreen(): Rect {
    const { width, height } = this.rotatedImageMetrics();
    const topLeft = this.imageToScreen({ x: 0, y: 0 });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: width * this.zoom,
      height: height * this.zoom,
    };
  }

  fitImageToCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const padding = 40;
    const { width, height, offsetX, offsetY } = this.rotatedImageMetrics();
    const scaleX = (canvas.width - padding * 2) / width;
    const scaleY = (canvas.height - padding * 2) / height;
    this.zoom = Math.min(scaleX, scaleY, 1);
    this.panX = canvas.width / 2 - (this.zoom * width) / 2 + this.zoom * offsetX;
    this.panY = canvas.height / 2 - (this.zoom * height) / 2 + this.zoom * offsetY;
    this.render();
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (event.ctrlKey) {
      const delta = event.deltaY > 0 ? -2 : 2;
      this.state.rotation += delta;
      this.cancelSelection();
      this.fitImageToCanvas();
      return;
    }

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
    const bounds = this.imageBoundsOnScreen();
    const imgRight = bounds.x + bounds.width;
    const imgBottom = bounds.y + bounds.height;
    const left = Math.min(Math.max(bounds.x, x), imgRight);
    const top = Math.min(Math.max(bounds.y, y), imgBottom);
    const right = Math.min(imgRight, Math.max(bounds.x, x + w));
    const bottom = Math.min(imgBottom, Math.max(bounds.y, y + h));
    return {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
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

  resetRotation(): void {
    this.state.rotation = 0;
    this.cancelSelection();
    this.fitImageToCanvas();
  }

  unloadImage(): void {
    this.imageLoaded = false;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.state.reset();
    this.cancelSelection();
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
  }

  onOkClick(): void {
    if (!this.selectionRect || !this.state.originalImage) return;

    const tl = this.screenToImage({ x: this.selectionRect.x, y: this.selectionRect.y });
    const br = this.screenToImage({
      x: this.selectionRect.x + this.selectionRect.width,
      y: this.selectionRect.y + this.selectionRect.height,
    });

    this.state.cropSelection = {
      x: Math.round(Math.min(tl.x, br.x)),
      y: Math.round(Math.min(tl.y, br.y)),
      width: Math.round(Math.abs(br.x - tl.x)),
      height: Math.round(Math.abs(br.y - tl.y)),
    };

    const dimensions = defaultModelDimensions(this.state.cropSelection, this.state.orientation);
    this.state.modelWidth = dimensions.width;
    this.state.modelHeight = dimensions.height;

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

    const { offsetX, offsetY } = this.rotatedImageMetrics();
    const origin = this.imageToScreen({ x: 0, y: 0 });

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(offsetX, offsetY);
    if (this.state.rotation !== 0) {
      ctx.translate(this.imageWidth / 2, this.imageHeight / 2);
      ctx.rotate((this.state.rotation * Math.PI) / 180);
      ctx.translate(-this.imageWidth / 2, -this.imageHeight / 2);
    }
    ctx.drawImage(this.image, 0, 0, this.imageWidth, this.imageHeight);
    ctx.restore();

    if (this.selectionRect) {
      const s = this.selectionRect;

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(s.x, s.y, s.width, s.height);
      ctx.setLineDash([]);

      const tl = this.screenToImage({ x: s.x, y: s.y });
      const br = this.screenToImage({ x: s.x + s.width, y: s.y + s.height });
      const label = `${Math.round(br.x - tl.x)} × ${Math.round(br.y - tl.y)}`;
      ctx.fillStyle = '#00ff88';
      ctx.font = '12px monospace';
      ctx.fillText(label, s.x + 4, s.y - 4);
    }
  }
}
