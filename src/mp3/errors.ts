export class InvalidMp3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMp3Error';
  }
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}
