import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseMp3FrameCount } from '../src/mp3/parseMp3FrameCount';

const samplePath = path.join(__dirname, 'fixtures', 'sample (2).mp3');

// A valid MPEG-1 Layer III frame header: 128kbps, 44100Hz, stereo, no padding.
// Frame length = floor(144 * 128000 / 44100) = 418 bytes.
const FRAME_LENGTH = 418;
const FRAME_HEADER = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

function buildFrame(length = FRAME_LENGTH): Buffer {
  return Buffer.concat([FRAME_HEADER, Buffer.alloc(length - 4)]);
}

function buildId3v2Header(bodySize: number): Buffer {
  const sizeBytes = Buffer.from([
    (bodySize >> 21) & 0x7f,
    (bodySize >> 14) & 0x7f,
    (bodySize >> 7) & 0x7f,
    bodySize & 0x7f,
  ]);
  return Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.from([0x03, 0x00, 0x00]), sizeBytes]);
}

function buildXingFrame(): Buffer {
  const frame = buildFrame();
  Buffer.from('Xing', 'ascii').copy(frame, 4 + 32);
  return frame;
}

// Same header, but with the protection bit set to 0 (CRC present) instead
// of 1 — this shifts where side info, and therefore the Xing tag, starts.
const FRAME_HEADER_WITH_CRC = Buffer.from([0xff, 0xfa, 0x90, 0x00]);

function buildXingFrameWithCrc(): Buffer {
  const frame = Buffer.concat([FRAME_HEADER_WITH_CRC, Buffer.alloc(FRAME_LENGTH - 4)]);
  Buffer.from('Xing', 'ascii').copy(frame, 4 + 2 + 32); // header + CRC + side info
  return frame;
}

describe('parseMp3FrameCount', () => {
  it('matches the mediainfo ground-truth count for the real sample file', () => {
    const buffer = readFileSync(samplePath);
    expect(parseMp3FrameCount(buffer)).toBe(6089);
  });

  it('excludes a leading Xing/VBR header frame from the count', () => {
    const buffer = Buffer.concat([buildXingFrame(), buildFrame(), buildFrame()]);
    expect(parseMp3FrameCount(buffer)).toBe(2);
  });

  it('still finds the Xing tag when the frame has a CRC (offset shifts by 2 bytes)', () => {
    const buffer = Buffer.concat([buildXingFrameWithCrc(), buildFrame(), buildFrame()]);
    expect(parseMp3FrameCount(buffer)).toBe(2);
  });

  it('skips a leading ID3v2 tag before looking for frames', () => {
    const id3 = buildId3v2Header(20);
    const buffer = Buffer.concat([id3, Buffer.alloc(20), buildFrame(), buildFrame()]);
    expect(parseMp3FrameCount(buffer)).toBe(2);
  });

  it('stops gracefully on a truncated final frame instead of throwing', () => {
    const truncated = Buffer.concat([FRAME_HEADER, Buffer.alloc(10)]); // claims 418, only has 14
    const buffer = Buffer.concat([buildFrame(), buildFrame(), truncated]);
    expect(parseMp3FrameCount(buffer)).toBe(2);
  });

  it('throws when no valid sync word exists anywhere in the buffer', () => {
    const buffer = Buffer.alloc(100, 0x00);
    expect(() => parseMp3FrameCount(buffer)).toThrow();
  });
});
