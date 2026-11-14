// lib/services.ts
// Composition root: the only file that chooses which adapter backs each port.
import { edgeAiProvider } from "@/lib/adapters/ai/EdgeAIProvider";
import { supabaseKeyVault } from "@/lib/adapters/supabase/SupabaseKeyVault";
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import type { AiProvider } from "@/lib/ports/ai";
import type { Catalog } from "@/lib/ports/catalog";
import type { KeyVault } from "@/lib/ports/keys";

export const services: { ai: AiProvider; catalog: Catalog; keys: KeyVault } = {
  ai: edgeAiProvider,
  catalog: edgeCatalog,
  keys: supabaseKeyVault,
};
