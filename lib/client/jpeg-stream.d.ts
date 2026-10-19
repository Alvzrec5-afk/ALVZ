/** Encodeur JPEG en continu (bande par bande) : pour des images plus grandes que ce qu'une toile accepte. */
export type JpegStream = {
  begin(width: number, height: number): void;
  /** Lignes RGBA de `srcWidth` pixels de large, à la suite des précédentes (complétées à droite si besoin). */
  addRows(data: Uint8ClampedArray, srcWidth: number, rows: number): void;
  finish(): Blob;
};
export function createJpegStream(quality: number): JpegStream;
