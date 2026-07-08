import {store} from './store';

jest.mock('./store');

describe('store', () => {
  beforeEach(() => {
    store.clear();
  });

  it('should return a store', () => {
    // @ts-expect-error store is a mock
    expect(store.isMock).toBeTruthy();
  });

  it('should set and get a value', () => {
    store.set('key', 'value');
    expect(store.get('key')).toBe('value');
  });

  it('should clear values', () => {
    store.set('key', 'value');
    store.clear();
    expect(store.get('key')).toBeUndefined();
  });

  it('should delete key', () => {
    store.set('key', 'value');
    expect(store.get('key')).toBe('value');
    // @ts-expect-error - mock store doesn't match expected keys
    store.delete('key');
    expect(store.get('key')).toBeUndefined();
  });
});