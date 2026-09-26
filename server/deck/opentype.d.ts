/**
 * The part of opentype.js the watermark uses. The package ships no types of
 * its own, and this is four calls - not worth a dependency to describe them.
 */
declare module "opentype.js" {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface Path {
    getBoundingBox(): BoundingBox;
    toPathData(decimalPlaces?: number): string;
  }

  export interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): Path;
  }

  const opentype: {
    parse(buffer: ArrayBuffer): Font;
  };
  export default opentype;
}
