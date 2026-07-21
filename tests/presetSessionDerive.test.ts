import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSessionProxyFromTools } from '../src/types/proxy-settings.ts';
import { deriveSessionGeolocationFromTools } from '../src/types/geolocation-settings.ts';

test('deriveSessionProxyFromTools picks majority mode', () => {
  const session = deriveSessionProxyFromTools({
    a: { toolId: 'a', mode: 'direct' },
    b: { toolId: 'b', mode: 'system' },
    c: { toolId: 'c', mode: 'system' },
  });
  assert.equal(session.mode, 'system');
});

test('deriveSessionProxyFromTools keeps profile id', () => {
  const session = deriveSessionProxyFromTools({
    a: { toolId: 'a', mode: 'profile', profileId: 'p1' },
    b: { toolId: 'b', mode: 'profile', profileId: 'p1' },
  });
  assert.equal(session.mode, 'profile');
  assert.equal(session.profileId, 'p1');
});

test('deriveSessionGeolocationFromTools defaults empty to system', () => {
  const session = deriveSessionGeolocationFromTools({});
  assert.equal(session.mode, 'system');
});
