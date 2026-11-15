// lib/services.ts
// Composition root: the only file that chooses which adapter backs each port.
import { musicBrainzArtists } from "@/lib/adapters/musicbrainz/MusicBrainzArtists";
import { nominatimGeocoder } from "@/lib/adapters/geo/NominatimGeocoder";
import { edgeAiProvider } from "@/lib/adapters/ai/EdgeAIProvider";
import { supabaseAuth } from "@/lib/adapters/supabase/auth";
import { activeStore } from "@/lib/files";
import { supabaseLogRepository } from "@/lib/adapters/supabase/SupabaseLogRepository";
import { supabaseSettingsRepository } from "@/lib/adapters/supabase/SupabaseSettingsRepository";
import { supabaseBrowseRepository } from "@/lib/adapters/supabase/SupabaseBrowseRepository";
import { supabaseDataRepository } from "@/lib/adapters/supabase/SupabaseDataRepository";
import { supabaseImageRepository } from "@/lib/adapters/supabase/SupabaseImageRepository";
import { supabaseNotificationRepository } from "@/lib/adapters/supabase/SupabaseNotificationRepository";
import { supabaseFollowRepository } from "@/lib/adapters/supabase/SupabaseFollowRepository";
import { supabaseHiddenRepository } from "@/lib/adapters/supabase/SupabaseHiddenRepository";
import { supabaseRatingsRepository } from "@/lib/adapters/supabase/SupabaseRatingsRepository";
import { supabaseWantedRepository } from "@/lib/adapters/supabase/SupabaseWantedRepository";
import { supabaseKeyVault } from "@/lib/adapters/supabase/SupabaseKeyVault";
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import type { AiProvider } from "@/lib/ports/ai";
import type { AuthProvider } from "@/lib/ports/auth";
import type { FileStore } from "@/lib/ports/files";
import type { ArtistSearch } from "@/lib/ports/artists";
import type { BrowseRepository } from "@/lib/ports/browse";
import type { DataRepository } from "@/lib/ports/data";
import type { ImageRepository } from "@/lib/ports/images";
import type { NotificationRepository } from "@/lib/ports/notifications";
import type { Catalog } from "@/lib/ports/catalog";
import type { Geocoder } from "@/lib/ports/geo";
import type { KeyVault } from "@/lib/ports/keys";
import type { LogRepository } from "@/lib/ports/log";
import type { SettingsRepository } from "@/lib/ports/settings";
import type { FollowRepository } from "@/lib/ports/follows";
import type { HiddenRepository } from "@/lib/ports/hidden";
import type { RatingsRepository } from "@/lib/ports/ratings";
import type { WantedRepository } from "@/lib/ports/wanted";

export const services: {
  ai: AiProvider;
  artists: ArtistSearch;
  auth: AuthProvider;
  files: FileStore;
  browse: BrowseRepository;
  data: DataRepository;
  images: ImageRepository;
  notifications: NotificationRepository;
  geo: Geocoder;
  catalog: Catalog;
  keys: KeyVault;
  log: LogRepository;
  hidden: HiddenRepository;
  follows: FollowRepository;
  ratings: RatingsRepository;
  settings: SettingsRepository;
  wanted: WantedRepository;
} = {
  ai: edgeAiProvider,
  artists: musicBrainzArtists,
  auth: supabaseAuth,
  files: activeStore,
  browse: supabaseBrowseRepository,
  data: supabaseDataRepository,
  images: supabaseImageRepository,
  notifications: supabaseNotificationRepository,
  geo: nominatimGeocoder,
  catalog: edgeCatalog,
  keys: supabaseKeyVault,
  log: supabaseLogRepository,
  hidden: supabaseHiddenRepository,
  follows: supabaseFollowRepository,
  ratings: supabaseRatingsRepository,
  settings: supabaseSettingsRepository,
  wanted: supabaseWantedRepository,
};
