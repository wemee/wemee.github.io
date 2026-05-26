declare module 'utif' {
  export interface UTIFIFD {
    width: number;
    height: number;
    [key: string]: unknown;
  }
  const UTIF: {
    decode: (buf: ArrayBuffer) => UTIFIFD[];
    decodeImage: (buf: ArrayBuffer, ifd: UTIFIFD) => void;
    toRGBA8: (ifd: UTIFIFD) => Uint8Array;
  };
  export default UTIF;
}
