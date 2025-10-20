"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.logger = void 0;
const logger = (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
};
exports.logger = logger;
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
};
exports.errorHandler = errorHandler;
exports.default = {
    logger: exports.logger,
    errorHandler: exports.errorHandler,
};
