import { describe, expect, it } from 'vitest';
import { Step1CropComponent } from './step1-crop.component';
import { StateService } from '../../services/state.service';

type Point = { x: number; y: number };

interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

function createComponent(viewport: Viewport): Step1CropComponent {
  const state = new StateService();
  state.rotation = viewport.rotation;

  const component = new Step1CropComponent(
    null as unknown as never,
    state,
    null as unknown as never,
    null as unknown as never
  );

  component.imageWidth = 640;
  component.imageHeight = 480;
  component.zoom = viewport.zoom;
  component.panX = viewport.panX;
  component.panY = viewport.panY;

  return component;
}

function screenToImage(component: Step1CropComponent, point: Point): Point {
  return component['screenToImage'](point);
}

function imageToScreen(component: Step1CropComponent, point: Point): Point {
  return component['imageToScreen'](point);
}

const viewports: Viewport[] = [
  { zoom: 1, panX: 0, panY: 0, rotation: 0 },
  { zoom: 0.25, panX: 137, panY: -84, rotation: 0 },
  { zoom: 3.5, panX: -420, panY: 66.5, rotation: 15 },
  { zoom: 1, panX: 12, panY: 12, rotation: 90 },
  { zoom: 2, panX: -7.25, panY: 310, rotation: -37.5 },
  { zoom: 0.8, panX: 0, panY: 0, rotation: 180 },
];

const points: Point[] = [
  { x: 0, y: 0 },
  { x: 640, y: 480 },
  { x: -125.5, y: 42 },
  { x: 1024, y: -768 },
];

describe('Step1CropComponent viewport math', () => {
  for (const viewport of viewports) {
    const label = `zoom ${viewport.zoom}, pan (${viewport.panX}, ${viewport.panY}), rotation ${viewport.rotation}`;

    it(`maps screen to image and back at ${label}`, () => {
      const component = createComponent(viewport);

      for (const point of points) {
        const roundTrip = imageToScreen(component, screenToImage(component, point));

        expect(roundTrip.x).toBeCloseTo(point.x, 9);
        expect(roundTrip.y).toBeCloseTo(point.y, 9);
      }
    });

    it(`maps image to screen and back at ${label}`, () => {
      const component = createComponent(viewport);

      for (const point of points) {
        const roundTrip = screenToImage(component, imageToScreen(component, point));

        expect(roundTrip.x).toBeCloseTo(point.x, 9);
        expect(roundTrip.y).toBeCloseTo(point.y, 9);
      }
    });
  }

  it('scales screen distances by the zoom factor only', () => {
    const component = createComponent({ zoom: 2.5, panX: 40, panY: -18, rotation: 22 });

    const from = screenToImage(component, { x: 100, y: 200 });
    const to = screenToImage(component, { x: 350, y: 700 });

    expect(to.x - from.x).toBeCloseTo(250 / 2.5, 9);
    expect(to.y - from.y).toBeCloseTo(500 / 2.5, 9);
  });

  it('places the rotated image origin at the same screen point for both directions', () => {
    const component = createComponent({ zoom: 1.75, panX: 33, panY: 77, rotation: 45 });

    const origin = imageToScreen(component, { x: 0, y: 0 });

    expect(screenToImage(component, origin).x).toBeCloseTo(0, 9);
    expect(screenToImage(component, origin).y).toBeCloseTo(0, 9);
    expect(origin.x).not.toBe(component.panX);
  });
});
