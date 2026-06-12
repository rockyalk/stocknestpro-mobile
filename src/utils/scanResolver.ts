export type RawScanResult = {
  kind: 'raw';
  rawCode: string;
};

export type SnpQrScanResult = {
  kind: 'snp';
  rawCode: string;
  resolved: any;
};

export type ScanResolverResult = RawScanResult | SnpQrScanResult;

export type ScanCodeExecutor = (input: { code: string }) => Promise<any>;

export const normalizeScanCode = (code: string) => String(code || '').trim();

export const isSnpQrCode = (code: string) =>
  normalizeScanCode(code).toLowerCase().startsWith('snp://');

export const resolveScanInput = async (
  code: string,
  scanCode: ScanCodeExecutor,
): Promise<ScanResolverResult> => {
  const rawCode = normalizeScanCode(code);

  if (!isSnpQrCode(rawCode)) {
    return { kind: 'raw', rawCode };
  }

  const resolved = await scanCode({ code: rawCode });

  return {
    kind: 'snp',
    rawCode,
    resolved,
  };
};
