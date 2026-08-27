import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AISTUDIO_DEFAULT_MODEL,
  buildAiStudioImageUrl,
  extractImagesFromAiStudioText,
  shouldCaptureAiStudioRequest,
} from '../electron/aistudioImageParse.ts';

describe('buildAiStudioImageUrl', () => {
  it('uses the default free Gemini Flash Image chat model', () => {
    assert.equal(AISTUDIO_DEFAULT_MODEL, 'gemini-2.5-flash-image');
    assert.equal(
      buildAiStudioImageUrl(),
      `https://aistudio.google.com/prompts/new_chat?model=${encodeURIComponent(AISTUDIO_DEFAULT_MODEL)}`
    );
  });

  it('routes imagen models to the dedicated new_image page', () => {
    assert.equal(
      buildAiStudioImageUrl('imagen-4.0-ultra-generate-001'),
      'https://aistudio.google.com/prompts/new_image?model=imagen-4.0-ultra-generate-001'
    );
  });

  it('routes other gemini image models to new_chat', () => {
    assert.equal(
      buildAiStudioImageUrl('gemini-3.1-flash-image'),
      'https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-flash-image'
    );
  });
});

describe('shouldCaptureAiStudioRequest', () => {
  it('captures Imagen / generateContent style endpoints', () => {
    assert.equal(
      shouldCaptureAiStudioRequest(
        'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict'
      ),
      true
    );
    assert.equal(
      shouldCaptureAiStudioRequest(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
      ),
      true
    );
    assert.equal(
      shouldCaptureAiStudioRequest('https://aisandbox-pa.googleapis.com/v1:runImageFx'),
      true
    );
  });

  it('ignores unrelated Google traffic', () => {
    assert.equal(shouldCaptureAiStudioRequest('https://fonts.googleapis.com/css'), false);
    assert.equal(shouldCaptureAiStudioRequest('https://www.gstatic.com/images/logo.png'), false);
    assert.equal(shouldCaptureAiStudioRequest('https://example.com/generate'), false);
    assert.equal(
      shouldCaptureAiStudioRequest(
        'https://console.cloud.google.com/_/OnboardingPlatformStandaloneUi/authcheck?model=imagen-4.0-generate-001&project=nearhub-9b471'
      ),
      false
    );
    assert.equal(
      shouldCaptureAiStudioRequest('https://aistudio.google.com/prompts/new_image?model=imagen-4.0-generate-001'),
      false
    );
  });
});

describe('extractImagesFromAiStudioText', () => {
  it('extracts googleusercontent image URLs', () => {
    const text = JSON.stringify({
      url: 'https://lh3.googleusercontent.com/a/generated-image=s0',
    });
    const images = extractImagesFromAiStudioText(text);
    assert.equal(images.length, 1);
    assert.equal(images[0]?.url, 'https://lh3.googleusercontent.com/a/generated-image=s0');
  });

  it('extracts bytesBase64Encoded payloads', () => {
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(80, 1)]).toString(
      'base64'
    );
    const text = JSON.stringify({ predictions: [{ bytesBase64Encoded: pngBase64 }] });
    const images = extractImagesFromAiStudioText(text);
    assert.ok(images.some((image) => image.base64 === pngBase64 && image.mimeType === 'image/png'));
  });

  it('extracts data URL images', () => {
    const text = 'prefix data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg== suffix';
    const images = extractImagesFromAiStudioText(text);
    assert.equal(images[0]?.mimeType, 'image/png');
    assert.ok(images[0]?.base64?.startsWith('iVBORw0KGgo'));
  });
});
