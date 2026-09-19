// MPEG-1 Layer III bitrate table (kbps), indexed by the 4-bit bitrate index.
const BITRATE_KBPS: readonly number[] = [
  -1, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1,
];

// MPEG-1 sample rate table (Hz), indexed by the 2-bit sample rate index.
const SAMPLE_RATE_HZ: readonly number[] = [44100, 48000, 32000, -1];

const ID3V2_MAGIC = Buffer.from('ID3', 'ascii');
const VBR_HEADER_TAGS = new Set(['Xing', 'Info', 'VBRI']);

function skipId3v2(buffer: Buffer): number {
  // ID3V2 must start with a 10-byte header
  // ("ID3" + 2-byte version + 1-byte flag + 4-bytes size)
  if (buffer.length < 10 || !buffer.subarray(0, 3).equals(ID3V2_MAGIC)) {
    return 0;
  }
  // For each byte, keep only the low 7 bits
  const size =
    ((buffer.readUInt8(6) & 0x7f) << 21) |
    ((buffer.readUInt8(7) & 0x7f) << 14) |
    ((buffer.readUInt8(8) & 0x7f) << 7) |
    (buffer.readUInt8(9) & 0x7f);
  return 10 + size;
}

function isSync(buffer: Buffer, pos: number): boolean {
  // Check if first 11 bits are all 1
  return buffer.readUInt8(pos) === 0xff && (buffer.readUInt8(pos + 1) & 0xe0) === 0xe0;
}

interface FrameHeader {
  isMpeg1LayerIII: boolean;
  frameLength: number;
  channelMode: number;
  hasCrc: boolean;
}

function decodeHeader(buffer: Buffer, pos: number): FrameHeader | null {
  const b1 = buffer.readUInt8(pos + 1);
  const b2 = buffer.readUInt8(pos + 2);
  const b3 = buffer.readUInt8(pos + 3);

  const version = (b1 >> 3) & 0x03; // 0=MPEG2.5, 1=reserved, 2=MPEG2, 3=MPEG1
  const layer = (b1 >> 1) & 0x03; // 0=reserved, 1=Layer III, 2=Layer II, 3=Layer I
  const protectionBit = b1 & 0x01; // 0 = 16-bit CRC follows the header, 1 = no CRC
  const bitrateIndex = (b2 >> 4) & 0x0f;
  const sampleRateIndex = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;
  const channelMode = (b3 >> 6) & 0x03; // 0=Stereo, 1=Joint Stereo, 2=Dual, 3=Mono

  if (version === 1 || layer === 0) {
    return null;
  }

  const bitrateKbps = BITRATE_KBPS[bitrateIndex] ?? -1;
  const sampleRateHz = SAMPLE_RATE_HZ[sampleRateIndex] ?? -1;

  if (bitrateKbps <= 0 || sampleRateHz < 0) {
    return null;
  }

  const frameLength = Math.floor((144 * bitrateKbps * 1000) / sampleRateHz) + padding;
  const isMpeg1LayerIII = version === 3 && layer === 1;

  return { isMpeg1LayerIII, frameLength, channelMode, hasCrc: protectionBit === 0 };
}

// A VBR file's first "frame" is often not audio at all - we will not count them as a frame.
function isVbrHeaderFrame(buffer: Buffer, pos: number, frame: FrameHeader): boolean {
  const crcSize = frame.hasCrc ? 2 : 0;
  const sideInfoSize = frame.channelMode === 3 ? 17 : 32;
  const tagOffset = pos + 4 + crcSize + sideInfoSize;

  if (tagOffset + 4 > pos + frame.frameLength || tagOffset + 4 > buffer.length) {
    return false;
  }

  return VBR_HEADER_TAGS.has(buffer.subarray(tagOffset, tagOffset + 4).toString('ascii'));
}

export function parseMp3FrameCount(buffer: Buffer): number {
  let pos = skipId3v2(buffer);
  let count = 0;

  while (pos + 4 <= buffer.length) {
    // Search for starting point of a frame
    if (!isSync(buffer, pos)) {
      pos += 1;
      continue;
    }

    const header = decodeHeader(buffer, pos);
    // Skip if header is invalid
    if (!header) {
      pos += 1;
      continue;
    }

    // Skip if format is not supported
    if (!header.isMpeg1LayerIII) {
      if (count === 0) {
        throw new Error('Unsupported format: not MPEG-1 Layer III');
      }
      break;
    }

    // Gracefully break if there is not enough remaining bytes for the current frame
    if (pos + header.frameLength > buffer.length) {
      break;
    }

    if (count === 0 && isVbrHeaderFrame(buffer, pos, header)) {
      pos += header.frameLength;
      continue;
    }

    count += 1;
    pos += header.frameLength;
  }

  if (count === 0) {
    throw new Error('No valid MP3 frames found');
  }

  return count;
}
