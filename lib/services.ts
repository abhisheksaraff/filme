// lib/services.ts
// Composition root: the only file that chooses which adapter backs each port.
import { edgeAiProvider } from "@/lib/adapters/ai/EdgeAIProvider";
import { supabaseLogRepository } from "@/lib/adapters/supabase/SupabaseLogRepository";
import { supabaseSettingsRepository } from "@/lib/adapters/supabase/SupabaseSettingsRepository";
import { supabaseWantedRepository } from "@/lib/adapters/supabase/SupabaseWantedRepository";
import { supabaseKeyVault } from "@/lib/adapters/supabase/SupabaseKeyVault";
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import type { AiProvider } from "@/lib/ports/ai";
import type { Catalog } from "@/lib/ports/catalog";
import type { KeyVault } from "@/lib/ports/keys";
import type { LogRepository } from "@/lib/ports/log";
import type { SettingsRepository } from "@/lib/ports/settings";
import type { WantedRepository } from "@/lib/ports/wanted";

export const services: {
  ai: AiProvider;
  catalog: Catalog;
  keys: KeyVault;
  log: LogRepository;
  settings: SettingsRepository;
  wanted: WantedRepository;
} = {
  ai: edgeAiProvider,
  catalog: edgeCatalog,
  keys: supabaseKeyVault,
  log: supabaseLogRepository,
  settings: supabaseSettingsRepository,
  wanted: supabaseWantedRepository,
};
