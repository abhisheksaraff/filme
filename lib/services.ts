// lib/services.ts
// Composition root: the only file that chooses which adapter backs each port.
import { musicBrainzArtists } from "@/lib/adapters/musicbrainz/MusicBrainzArtists";
import { nominatimGeocoder } from "@/lib/adapters/geo/NominatimGeocoder";
import { edgeAiProvider } from "@/lib/adapters/ai/EdgeAIProvider";
import { supabaseLogRepository } from "@/lib/adapters/supabase/SupabaseLogRepository";
import { supabaseCollectionRepository } from "@/lib/adapters/supabase/SupabaseCollectionRepository";
import { supabaseSettingsRepository } from "@/lib/adapters/supabase/SupabaseSettingsRepository";
import { supabaseBrowseRepository } from "@/lib/adapters/supabase/SupabaseBrowseRepository";
import { supabaseDataRepository } from "@/lib/adapters/supabase/SupabaseDataRepository";
import { supabaseImageRepository } from "@/lib/adapters/supabase/SupabaseImageRepository";
import { supabaseNotificationRepository } from "@/lib/adapters/supabase/SupabaseNotificationRepository";
import { supabaseWantedRepository } from "@/lib/adapters/supabase/SupabaseWantedRepository";
import { supabaseKeyVault } from "@/lib/adapters/supabase/SupabaseKeyVault";
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import type { AiProvider } from "@/lib/ports/ai";
import type { ArtistSearch } from "@/lib/ports/artists";
import type { BrowseRepository } from "@/lib/ports/browse";
import type { DataRepository } from "@/lib/ports/data";
import type { ImageRepository } from "@/lib/ports/images";
import type { NotificationRepository } from "@/lib/ports/notifications";
import type { Catalog } from "@/lib/ports/catalog";
import type { Geocoder } from "@/lib/ports/geo";
import type { CollectionRepository } from "@/lib/ports/collections";
import type { KeyVault } from "@/lib/ports/keys";
import type { LogRepository } from "@/lib/ports/log";
import type { SettingsRepository } from "@/lib/ports/settings";
import type { WantedRepository } from "@/lib/ports/wanted";

export const services: {
  ai: AiProvider;
  artists: ArtistSearch;
  browse: BrowseRepository;
  data: DataRepository;
  images: ImageRepository;
  notifications: NotificationRepository;
  geo: Geocoder;
  catalog: Catalog;
  collections: CollectionRepository;
  keys: KeyVault;
  log: LogRepository;
  settings: SettingsRepository;
  wanted: WantedRepository;
} = {
  ai: edgeAiProvider,
  artists: musicBrainzArtists,
  browse: supabaseBrowseRepository,
  data: supabaseDataRepository,
  images: supabaseImageRepository,
  notifications: supabaseNotificationRepository,
  geo: nominatimGeocoder,
  catalog: edgeCatalog,
  collections: supabaseCollectionRepository,
  keys: supabaseKeyVault,
  log: supabaseLogRepository,
  settings: supabaseSettingsRepository,
  wanted: supabaseWantedRepository,
};
