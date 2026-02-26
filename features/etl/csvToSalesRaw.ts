import type { Json } from '@/types/database';

type CsvRow = Record<string, string>;

export const csvToSalesRawRows = (tenantId: string, sourceFile: string, rows: CsvRow[]) => {
  return rows.map((row) => ({
    tenant_id: tenantId,
    source_file: sourceFile,
    row_data: row as Json
  }));
};
