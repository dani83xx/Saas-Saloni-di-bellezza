declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  interface Expectation {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeNull(): void;
    not: Expectation;
    rejects: { toThrow(expected: RegExp): Promise<void> };
  }
  export function expect(value: unknown): Expectation;
}
