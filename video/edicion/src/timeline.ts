// Dos montajes sobre la misma grabación: el original (1:1, con tu voz) y el narrado (tramos acelerados, voz Sulafat).
import {buildTimeline, toOut as toOutCore} from './timeline-core.mjs';
import narracion from '../narracion-demo.json';
import durations from './narr-manifest.json';
import {SRC_DURATION} from './cues';

export type Piece = {srcFrom: number; srcTo: number; outFrom: number; playDur: number; hold: number};
export type Line = {id: string; text: string; start: number; dur: number};
export type Timeline = {pieces: Piece[]; lines: Line[]; duration: number; narrated: boolean};

export const ORIGINAL: Timeline = {
  pieces: [{srcFrom: 0, srcTo: SRC_DURATION, outFrom: 0, playDur: SRC_DURATION, hold: 0}],
  lines: [],
  duration: SRC_DURATION,
  narrated: false,
};

export const NARRADO: Timeline = {...buildTimeline(narracion, durations), narrated: true};

export const toOut = (tl: Timeline, s: number): number => toOutCore(tl, s);
