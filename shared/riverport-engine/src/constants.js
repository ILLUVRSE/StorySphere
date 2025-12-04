"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHYSICS = exports.FIELD = exports.INNINGS = exports.GAME_HEIGHT = exports.GAME_WIDTH = void 0;
// Constants
exports.GAME_WIDTH = 800;
exports.GAME_HEIGHT = 600;
exports.INNINGS = 3;
// Field Dimensions
exports.FIELD = {
    homePlate: { x: 400, y: 500 },
    firstBase: { x: 600, y: 350 },
    secondBase: { x: 400, y: 200 },
    thirdBase: { x: 200, y: 350 },
    mound: { x: 400, y: 350 }
};
exports.PHYSICS = {
    gravity: 0.25,
    groundDrag: 0.9,
    airDrag: 0.99
};
