import { Code128BarcodeAdapter } from '@infrastructure/barcode/code128-barcode.adapter';

describe('code 128 preview', () => {
  it('returns an SVG and a PNG for the numeric code', () => {
    const preview = new Code128BarcodeAdapter().preview('00000001');
    const png = Buffer.from(preview.pngBase64, 'base64');

    expect(preview.svg).toContain('>00000001</text>');
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
