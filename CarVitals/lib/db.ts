// lib/db.ts
// Turso (LibSQL) 邊緣雲端資料庫單例連線模組
// 遵循 AegisSystem 架構規範
import { createClient, type Client } from '@libsql/client';

let clientInstance: Client | null = null;

export function getDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('未在環境變數中設定 TURSO_DATABASE_URL');
  }

  if (!clientInstance) {
    clientInstance = createClient({
      url,
      authToken: authToken || undefined,
    });
  }

  return clientInstance;
}

