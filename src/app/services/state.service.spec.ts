import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StateService } from './state.service';

describe('StateService', () => {
  let created: string[];
  let revoked: string[];
  let nativeCreate: typeof URL.createObjectURL;
  let nativeRevoke: typeof URL.revokeObjectURL;

  beforeEach(() => {
    created = [];
    revoked = [];
    nativeCreate = URL.createObjectURL;
    nativeRevoke = URL.revokeObjectURL;

    URL.createObjectURL = () => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };
  });

  afterEach(() => {
    URL.createObjectURL = nativeCreate;
    URL.revokeObjectURL = nativeRevoke;
  });

  const blob = () => new Blob(['pixels']);

  const expectEveryCreatedUrlRevokedOnce = () => {
    expect([...revoked].sort()).toEqual([...created].sort());
    expect(new Set(revoked).size).toBe(revoked.length);
  };

  it('revokes both black and white urls when the black and white state is reset', () => {
    const state = new StateService();

    state.setBwImage(blob());
    state.setCurrentBwImage(blob());
    state.setCurrentBwImage(blob());
    state.resetBwState();

    expect(created.length).toBe(3);
    expectEveryCreatedUrlRevokedOnce();
    expect(state.originalBwImageUrl).toBeNull();
    expect(state.currentBwImageUrl).toBeNull();
  });

  it('revokes the previous black and white pair when a new source image is converted', () => {
    const state = new StateService();

    state.setBwImage(blob());
    state.setCurrentBwImage(blob());
    const replaced = [...created];
    state.setBwImage(blob());

    expect([...revoked].sort()).toEqual([...replaced].sort());
    expect(revoked).not.toContain(state.originalBwImageUrl);
  });

  it('revokes the denoised url but keeps the original when restoring', () => {
    const state = new StateService();

    state.setBwImage(blob());
    const original = state.originalBwImageUrl;
    state.setCurrentBwImage(blob());
    const denoised = state.currentBwImageUrl;

    state.restoreOriginalBwImage();

    expect(revoked).toEqual([denoised]);
    expect(state.currentBwImageUrl).toBe(original);
    expect(state.currentBwImage).toBe(state.originalBwImage);
  });

  it('does not revoke the shared original url twice when restoring before a reset', () => {
    const state = new StateService();

    state.setBwImage(blob());
    state.setCurrentBwImage(blob());
    state.restoreOriginalBwImage();
    state.resetBwState();

    expectEveryCreatedUrlRevokedOnce();
  });

  it('revokes the source image url on cleanup', () => {
    const state = new StateService();
    state.originalImageUrl = URL.createObjectURL(blob());

    state.setBwImage(blob());
    state.cleanupObjectUrls();

    expectEveryCreatedUrlRevokedOnce();
    expect(state.originalImageUrl).toBeNull();
  });

  it('revokes every url and clears the crop state on reset', () => {
    const state = new StateService();
    state.originalImageUrl = URL.createObjectURL(blob());
    state.originalImage = new File(['pixels'], 'photo.png');
    state.cropSelection = { x: 1, y: 2, width: 3, height: 4 };
    state.rotation = 42;

    state.setBwImage(blob());
    state.setCurrentBwImage(blob());
    state.reset();

    expectEveryCreatedUrlRevokedOnce();
    expect(state.originalImage).toBeNull();
    expect(state.originalImageUrl).toBeNull();
    expect(state.cropSelection).toBeNull();
    expect(state.rotation).toBe(0);
  });

  it('ignores urls that are not object urls', () => {
    const state = new StateService();
    state.originalImageUrl = 'https://example.test/photo.png';

    state.cleanupObjectUrls();

    expect(revoked).toEqual([]);
  });
});
