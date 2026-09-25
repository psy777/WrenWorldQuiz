declare module "an-array-of-english-words" {
  const words: string[];
  export default words;
}

declare module "node:sqlite" {
  type Params = Array<string | number | bigint | null | Uint8Array>;
  export class DatabaseSync {
    constructor(path: string, options?: unknown);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run(...params: Params): { changes: number | bigint; lastInsertRowid: number | bigint };
      get(...params: Params): unknown;
      all(...params: Params): unknown[];
    };
  }
}
