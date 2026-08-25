import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { ConvertService } from '../../services/convert.service';
import { StateService } from '../../services/state.service';
import {
  MAX_MODEL_DIMENSION_MM,
  MAX_THICKNESS_MM,
  MIN_MODEL_DIMENSION_MM,
  MIN_THICKNESS_MM,
  dimensionError,
  thicknessError,
} from '../../services/model-dimensions';
import { problemDetail } from '../../services/problem-details';

@Component({
  selector: 'app-step2-bw',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step2-bw.component.html',
  styleUrl: './step2-bw.component.scss',
})
export class Step2BwComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private image = new Image();
  private animFrameId = 0;

  modelWidth = 30;
  modelHeight = 60;
  modelThickness = 2;
  orientation = 'vertical';
  fillSpace = false;
  invert = false;

  intensity = 0;
  processing = false;
  rendering = false;
  errorMessage: string | null = null;

  readonly minDimension = MIN_MODEL_DIMENSION_MM;
  readonly maxDimension = MAX_MODEL_DIMENSION_MM;
  readonly minThickness = MIN_THICKNESS_MM;
  readonly maxThickness = MAX_THICKNESS_MM;

  zoom = 1;
  panX = 0;
  panY = 0;
  minZoom = 0.1;
  maxZoom = 5;

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  imageLoaded = false;
  imageWidth = 0;
  imageHeight = 0;

  private intensity$ = new Subject<number>();
  private destroy$ = new Subject<void>();

  constructor(
    readonly router: Router,
    private convertService: ConvertService,
    public state: StateService,
    private cdr: ChangeDetectorRef
  ) {}

  get widthError(): string | null {
    return dimensionError('Width', this.modelWidth);
  }

  get heightError(): string | null {
    return dimensionError('Height', this.modelHeight);
  }

  get thicknessError(): string | null {
    return thicknessError(this.modelThickness);
  }

  get hasInvalidDimensions(): boolean {
    return this.widthError !== null || this.heightError !== null || this.thicknessError !== null;
  }

  ngOnInit(): void {
    if (!this.state.originalImage || !this.state.cropSelection) {
      this.router.navigate(['/step1']);
      return;
    }

    this.modelWidth = this.state.modelWidth;
    this.modelHeight = this.state.modelHeight;
    this.modelThickness = this.state.modelThickness;
    this.orientation = this.state.orientation;
    this.fillSpace = this.state.fillSpace;
    this.invert = this.state.invert;

    if (!this.state.originalBwImage) {
      this.imageLoaded = false;
      this.convertService
        .toBw(
          this.state.originalImage,
          this.state.cropSelection,
          this.orientation,
          this.fillSpace,
          this.invert,
          this.state.rotation
        )
        .subscribe({
          next: (blob) => {
            this.state.setBwImage(blob);
            this.loadCurrentImage();
          },
          error: (err) => {
            this.imageLoaded = true;
            this.showError(err, 'Failed to convert the image to black & white.');
          },
        });
    }

    this.intensity$
      .pipe(
        debounceTime(300),
        switchMap((val) => {
          if (val === 0 || !this.state.originalBwImage) {
            this.state.setCurrentBwImage(this.state.originalBwImage!);
            this.processing = false;
            return [];
          }
          this.processing = true;
          return this.convertService.denoise(this.state.originalBwImage!, val);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (blob) => {
          if (blob instanceof Blob) {
            this.state.setCurrentBwImage(blob);
            this.loadCurrentImage();
          }
          this.processing = false;
        },
        error: (err) => {
          this.processing = false;
          this.showError(err, 'Failed to denoise the image.');
        },
      });
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.resizeCanvas();
    if (this.state.originalBwImage && this.state.currentBwImageUrl) {
      this.loadCurrentImage();
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.destroy$.next();
    this.destroy$.complete();
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

  private loadCurrentImage(): void {
    if (!this.state.currentBwImageUrl) return;
    this.image.onload = () => {
      this.imageWidth = this.image.naturalWidth;
      this.imageHeight = this.image.naturalHeight;
      this.imageLoaded = true;
      this.fitImageToCanvas();
    };
    this.image.onerror = () => {
      this.imageLoaded = true;
    };
    this.image.src = this.state.currentBwImageUrl;
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
    if (event.button === 0) {
      const canvas = this.canvasRef.nativeElement;
      const rect = canvas.getBoundingClientRect();
      this.isPanning = true;
      this.panStartX = event.clientX - rect.left;
      this.panStartY = event.clientY - rect.top;
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.panX += x - this.panStartX;
    this.panY += y - this.panStartY;
    this.panStartX = x;
    this.panStartY = y;
    this.render();
  }

  onCanvasMouseUp(): void {
    this.isPanning = false;
  }

  onBack(): void {
    this.state.cleanupObjectUrls();
    this.state.originalBwImage = null;
    this.state.currentBwImage = null;
    this.router.navigate(['/step1']);
  }

  onOrientationChange(): void {
    this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const previousWidth = this.modelWidth;
    this.modelWidth = this.modelHeight;
    this.modelHeight = previousWidth;
    this.applyOptions();
  }

  onFillSpaceChange(): void {
    this.applyOptions();
  }

  onInvertChange(): void {
    this.applyOptions();
  }

  private applyOptions(): void {
    if (!this.state.originalImage || !this.state.cropSelection) return;
    this.errorMessage = null;
    this.intensity = 0;
    this.intensity$.next(0);
    this.processing = false;
    this.imageLoaded = false;
    this.convertService
      .toBw(
        this.state.originalImage,
        this.state.cropSelection,
        this.orientation,
        this.fillSpace,
        this.invert,
        this.state.rotation
      )
      .subscribe({
        next: (blob) => {
          this.state.setBwImage(blob);
          this.loadCurrentImage();
        },
        error: (err) => {
          this.imageLoaded = true;
          this.showError(err, 'Failed to apply the selected options.');
        },
      });
  }

  onIntensityChange(): void {
    this.intensity$.next(this.intensity);
  }

  onRender(): void {
    if (!this.state.currentBwImage || this.hasInvalidDimensions) return;
    this.errorMessage = null;
    this.state.modelWidth = this.modelWidth;
    this.state.modelHeight = this.modelHeight;
    this.state.modelThickness = this.modelThickness;
    this.state.orientation = this.orientation;
    this.state.fillSpace = this.fillSpace;
    this.state.invert = this.invert;
    this.rendering = true;
    this.convertService.toStl(this.state.currentBwImage, this.modelThickness, this.modelWidth, this.modelHeight, this.orientation).subscribe({
      next: (blob) => {
        this.state.stlBlob = blob;
        this.rendering = false;
        this.router.navigate(['/step3']);
      },
      error: (err) => {
        this.rendering = false;
        this.showError(err, 'Failed to generate the STL model.');
      },
    });
  }

  private showError(error: unknown, fallback: string): void {
    problemDetail(error, fallback).then((message) => {
      this.errorMessage = message;
      this.cdr.markForCheck();
    });
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
  }
}
