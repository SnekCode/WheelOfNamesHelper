import {store} from './store';

jest.mock('./store');

describe('store', () => {

  afterAll(() => {
    store.clear();
  });

  beforeAll(() => {
    store.clear();
  });

  it('should return a store', () => {
    // @ts-expect-error store is a mock
    expect(store.isMock).toBeTruthy();
  });

    it('should set and get a value', () => {
        store.set('key', 'value');
        expect(store.get('key')).toBe('value');
    })

    it("should set, well see if it persists in next test", () => {
        store.set('newkey', 'long live the value');
    })

    it("should get the value set in the previous test", () => {
        expect(store.get('newkey')).toBe('long live the value');
    })

    it("should clear", () => {
        store.clear();
        expect(store.get('key')).toBeUndefined();
    })

    it("should delete key", () => {
        store.set('key', 'value');
        expect(store.get('key')).toBe('value');
        // @ts-expect-error - mock store doens't match expected keys
        store.delete('key');
        expect(store.get('key')).toBeUndefined();
    })
});