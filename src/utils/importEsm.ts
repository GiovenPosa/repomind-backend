// src/utils/importEsm.ts
export function importEsm<T = any>(specifier: string): Promise<T> {
  // Use Function() so TS doesn’t rewrite it; Node will do a true import()
  // eslint-disable-next-line no-new-func
  return (new Function('s', 'return import(s)'))(specifier) as Promise<T>;
}