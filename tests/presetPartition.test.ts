import test from 'node:test';
import assert from 'node:assert/strict';
import { getPresetPartition, DEFAULT_PRESET_ID } from '../src/utils/toolPartition.ts';

test('getPresetPartition uses persist:preset- prefix', () => {
  assert.equal(getPresetPartition('default'), 'persist:preset-default');
  assert.equal(getPresetPartition('preset-abc'), 'persist:preset-preset-abc');
});

test('DEFAULT_PRESET_ID is default', () => {
  assert.equal(DEFAULT_PRESET_ID, 'default');
});

test('getPresetPartition rejects empty id', () => {
  assert.throws(() => getPresetPartition(''), /presetId is required/);
  assert.throws(() => getPresetPartition('   '), /presetId is required/);
});
