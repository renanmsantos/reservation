declare module "pg" {
  export interface ClientConfig {
    connectionString?: string;
    ssl?: {
      rejectUnauthorized?: boolean;
    };
  }

  export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query<T = unknown>(queryText: string, values?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
