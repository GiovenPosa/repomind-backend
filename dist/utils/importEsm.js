"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importEsm = void 0;
// src/utils/importEsm.ts
function importEsm(specifier) {
    // Use Function() so TS doesn’t rewrite it; Node will do a true import()
    // eslint-disable-next-line no-new-func
    return (new Function('s', 'return import(s)'))(specifier);
}
exports.importEsm = importEsm;
