// lib/credentialsModel.ts

export type ApiKeyService = 'ai' | 'tmdb';

type KeyStore = Record<ApiKeyService, string | null>;

const memoryCache: KeyStore = {
  ai: null,
  tmdb: null,
};

function getEnvFallback(service: ApiKeyService): string | null {
  switch (service) {
    case 'ai':
      return process.env.NEXT_PUBLIC_AI_API_KEY || null;
    case 'tmdb':
      return process.env.NEXT_PUBLIC_TMDB_API_KEY || null;
    default:
      return null;
  }
}

export const CredentialsModel = {
  async setKey(service: ApiKeyService, key: string): Promise<boolean> {
    if (!key || !key.trim()) return false;
    memoryCache[service] = key.trim();
    return true;
  },

  async getKey(service: ApiKeyService): Promise<string | null> {
    if (memoryCache[service]) return memoryCache[service];

    const envKey = getEnvFallback(service);
    if (envKey) {
      memoryCache[service] = envKey;
      return envKey;
    }

    return null;
  },

  async deleteKey(service: ApiKeyService): Promise<void> {
    memoryCache[service] = null;
  },

  async validateKey(service: ApiKeyService, testKey?: string): Promise<boolean> {
    const key = testKey || (await this.getKey(service));
    if (!key) return false;

    try {
      let url = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      switch (service) {
        case 'ai':
          url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
          break;

        case 'tmdb':
          // Supports TMDB Bearer Read Token or v3 API key param
          url = key.startsWith('eyJ')
            ? 'https://api.themoviedb.org/3/authentication'
            : `https://api.themoviedb.org/3/authentication?api_key=${key}`;

          if (key.startsWith('eyJ')) {
            headers['Authorization'] = `Bearer ${key}`;
          }
          break;

        default:
          return false;
      }

      const response = await fetch(url, { method: 'GET', headers });
      return response.ok;
    } catch (error) {
      console.warn(`[CredentialsModel] Live validation failed for ${service}:`, error);
      return false;
    }
  },
};