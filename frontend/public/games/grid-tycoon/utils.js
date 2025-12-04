// utils.js

// Mulberry32 seeded RNG
export function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Simple UUID generator
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Clamp value between min and max
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Linear interpolation
export function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

// Parse query params for seed/config
export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: params.get('seed') || new Date().toISOString().split('T')[0], // Default to daily seed
    mode: params.get('mode') || 'normal'
  };
}
