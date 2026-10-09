import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPresetMeta,
  deletePresetInRegistry,
  ensureRegistryDefaults,
  renamePresetInRegistry,
} from '../src/utils/presetRegistryCore.ts';

test('ensureRegistryDefaults inserts default when empty', () => {
  const r = ensureRegistryDefaults({ version: '1.0.0', presets: [] });
  assert.equal(r.presets[0].id, 'default');
  assert.equal(r.presets[0].name, '默认');
});

test('ensureRegistryDefaults keeps existing default', () => {
  const r = ensureRegistryDefaults({
    version: '1.0.0',
    presets: [{ id: 'default', name: '默认', createdAt: 1 }],
  });
  assert.equal(r.presets.length, 1);
});

test('createPresetMeta rejects empty name', () => {
  assert.throws(() => createPresetMeta('  '), /名称不能为空/);
});

test('createPresetMeta generates preset- uuid id', () => {
  const meta = createPresetMeta('工作');
  assert.match(meta.id, /^preset-/);
  assert.equal(meta.name, '工作');
});

test('deletePresetInRegistry rejects default', () => {
  const registry = ensureRegistryDefaults(null);
  assert.throws(() => deletePresetInRegistry(registry, 'default'), /不可删除/);
});

test('renamePresetInRegistry updates name', () => {
  const registry = ensureRegistryDefaults(null);
  const next = renamePresetInRegistry(registry, 'default', '主账号');
  assert.equal(next.presets[0].name, '主账号');
});
