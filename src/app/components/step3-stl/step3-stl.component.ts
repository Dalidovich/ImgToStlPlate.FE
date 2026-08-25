import {
  Component,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StateService } from '../../services/state.service';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-step3-stl',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step3-stl.component.html',
  styleUrl: './step3-stl.component.scss',
})
export class Step3StlComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewer') viewerRef!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animFrameId = 0;

  private mesh!: THREE.Mesh;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.MeshPhongMaterial;
  private initTimeoutId = 0;
  private destroyed = false;
  invertColors = false;

  constructor(
    readonly router: Router,
    private ngZone: NgZone,
    public state: StateService
  ) {}

  ngAfterViewInit(): void {
    if (!this.state.stlBlob) {
      this.router.navigate(['/step2']);
      return;
    }
    this.initTimeoutId = window.setTimeout(() => this.initViewer());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.initTimeoutId);
    cancelAnimationFrame(this.animFrameId);
    this.controls?.dispose();
    this.renderer?.domElement.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onWindowBlur);
    if (this.mesh) {
      this.scene?.remove(this.mesh);
    }
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.forceContextLoss();
      this.renderer.dispose();
    }
  }

  private initViewer(): void {
    if (this.destroyed || !this.viewerRef) return;
    const container = this.viewerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    this.scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-50, -50, -50);
    this.scene.add(backLight);

    this.loadStl();
    this.ngZone.runOutsideAngular(() => this.animate());

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
  }

  private loadStl(): void {
    if (!this.state.stlBlob) return;
    const loader = new STLLoader();
    const url = URL.createObjectURL(this.state.stlBlob);

    loader.load(url, (geometry) => {
      URL.revokeObjectURL(url);
      if (this.destroyed) {
        geometry.dispose();
        return;
      }
      geometry.computeBoundingBox();

      this.geometry = geometry;
      this.applyVertexColors(this.invertColors);

      this.material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        specular: 0x222222,
        shininess: 20,
        flatShading: true,
      });

      this.mesh = new THREE.Mesh(geometry, this.material);
      this.scene.add(this.mesh);

      const box = new THREE.Box3().setFromObject(this.mesh);
      const center = box.getCenter(new THREE.Vector3());
      this.mesh.position.sub(center);

      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      let cameraZ = maxDim / (2 * Math.tan(fov / 2));
      cameraZ *= 1.5;
      this.camera.position.set(0, 0, cameraZ);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    });
  }

  private applyVertexColors(invert: boolean): void {
    if (!this.geometry) return;

    const positions = this.geometry.getAttribute('position');
    const count = positions.count;
    const colors = new Float32Array(count * 3);

    const box = this.geometry.boundingBox!;
    const maxZ = box.max.z;
    const epsilon = (maxZ - box.min.z) * 0.01;

    const black = invert ? 1.0 : 0.0;
    const white = invert ? 0.0 : 1.0;

    for (let i = 0; i < count; i++) {
      const z = positions.getZ(i);
      const c = z >= maxZ - epsilon ? black : white;
      colors[i * 3] = c;
      colors[i * 3 + 1] = c;
      colors[i * 3 + 2] = c;
    }

    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  toggleInvert(): void {
    this.invertColors = !this.invertColors;
    this.applyVertexColors(this.invertColors);
  }

  resetViewRotation(): void {
    if (this.mesh) {
      this.mesh.rotation.z = 0;
    }
  }

  get isViewRotated(): boolean {
    return this.mesh ? Math.abs(this.mesh.rotation.z) > 0.001 : false;
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey) return;
    event.preventDefault();

    if (this.mesh) {
      this.mesh.rotation.z += event.deltaY * 0.002;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Control') {
      this.controls.enableZoom = true;
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Control') {
      this.controls.enableZoom = false;
    }
  };

  private onWindowBlur = (): void => {
    if (this.controls) {
      this.controls.enableZoom = true;
    }
  };

  private onResize = (): void => {
    if (!this.viewerRef) return;
    const container = this.viewerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  downloadStl(): void {
    if (!this.state.stlBlob) return;
    const url = URL.createObjectURL(this.state.stlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.stl';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }
}
