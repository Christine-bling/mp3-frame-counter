# MP3 Frame Counter

## Execution

Start the server:

```bash
npm install
npm run dev
```

In a second terminal, count the frames in the test sample:

```bash
curl -F "file=@test/fixtures/sample (2).mp3" http://localhost:3000/file-upload
```

Expect `{"frameCount":6089}`.

## Validation

Cross-check that number against `mediainfo`:

```bash
mediainfo --Full "test/fixtures/sample (2).mp3"
```

Look for `Frame count` under the `Audio` section — it should match the value the endpoint returned.

## Unit test

```bash
npm test
```

## High-level walk-through

An MP3 file is a sequence of independent chunks (frames) glued end to end. Each frame is a compressed audio and has its own 4-byte header describing itself including bitrate index, sample rate index, padding bit which can be used to compute the length of the frame. We will scan and process chunks one by one, in order to count number of frames.

### Structure of a while file
if (bytes 0-2 == "ID3"):
    ID3v2 tag present - 10-byte header ("ID3" + 2-byte version + 1-byte flag + 4-bytes size) + 'size' bytes of tag content
    first frame starts at byte (10 + size)
else:
    first frame starts at byte 0

### Structure of a frame header
Byte 0          Byte 1              Byte 2              Byte 3
11111111        111 VV LL P         BBBB SS D X         MM EE C O YY
sync (8 bits)   │   │  │  │         │    │  │ │         │  │  │ │  │
                │   │  │  └protect  │    │  │ └private  │  │  │ │  └emphasis
                │   │  └layer       │    │  └padding    │  │  │ └original
                │   └version        │    └sample rate   │  │  └copyright
                └sync (3 more bits) └bitrate            │  └mode ext.
                                                        └channel mode

### Structure of a frame after header
if (protection bit == 0): 2-bytes CRC

if (channelMode == Mono): sideInfoSize = 17
else: sideInfoSize = 32

if (first frame AND bytes spell "Xing/Info/VBRI"): VBR metadata, not audio
else: real compressed audio


### Key terminology
1. Bitrate = how many compressed data represents one second of sound (128 kbps = 128,000 bits/second). The header sets aside 4 bits for bitrates, 16 possible values in a fixed list.
2. Sample rate = how many raw audio measurements per second the original recording used. The header sets aside 2 bits for it, 4 possible values.
3. Every frame encodes exactly 1152 audio samples

### Computation walk-through
frame duration (seconds) = 1152 samples / sample rate
bits in this frame = bitrate (bits/sec) * frame duration (sec) = bitrate * 1152 / sample rate
bytes in this frame = bitrate * (1152 / 8) / sample rate = bitrate * 144 / sample rate



