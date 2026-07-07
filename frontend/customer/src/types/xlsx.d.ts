declare module 'xlsx' {
  export interface WorkSheet {}
  export interface WorkBook {}

  export const utils: {
    json_to_sheet(data: Record<string, unknown>[]): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name?: string): void;
  };

  export function writeFile(workbook: WorkBook, filename: string): void;
}
