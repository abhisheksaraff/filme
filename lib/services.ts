// lib/services.ts
// Composition root: the only file that chooses which adapter backs each port.
import { musicBrainzArtists } from "@/lib/adapters/musicbrainz/MusicBrainzArtists";
import { openverseSearch } from "@/lib/adapters/openverse/OpenverseSearch";
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
import { supabasePassRepository } from "@/lib/adapters/supabase/SupabasePassRepository";
import { supabaseProgressRepository } from "@/lib/adapters/supabase/SupabaseProgressRepository";
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
import type { MediaSearch } from "@/lib/ports/media";
import type { KeyVault } from "@/lib/ports/keys";
import type { LogRepository } from "@/lib/ports/log";
import type { SettingsRepository } from "@/lib/ports/settings";
import type { FollowRepository } from "@/lib/ports/follows";
import type { HiddenRepository } from "@/lib/ports/hidden";
import type { PassRepository } from "@/lib/ports/passes";
import type { ProgressRepository } from "@/lib/ports/progress";
import type { RatingsRepository } from "@/lib/ports/ratings";
import type { WantedRepository } from "@/lib/ports/wanted";

/** After a viewing is saved, changed, deleted or restored, the stored completion cards are brought up to date in the background. */
function syncLater(mediaId: string | null | undefined): void {
  if (!mediaId) return;
  void import("@/lib/completions").then((m) => m.syncAfterChange(mediaId));
}

const trackedLog: LogRepository = {
  ...supabaseLogRepository,
  async saveEntry(entry, stubs) {
    const res = await supabaseLogRepository.saveEntry(entry, stubs);
    if (res.ok) syncLater(res.value.mediaId);
    return res;
  },
  async updateViewing(id, entry) {
    const before = await supabaseLogRepository.getViewing(id);
    const res = await supabaseLogRepository.updateViewing(id, entry);
    if (res.ok) {
      syncLater(res.value.mediaId);
      if (before.ok && before.value.mediaId !== res.value.mediaId) syncLater(before.value.mediaId);
    }
    return res;
  },
  async deleteViewing(id) {
    const before = await supabaseLogRepository.getViewing(id);
    const res = await supabaseLogRepository.deleteViewing(id);
    if (res.ok && before.ok) syncLater(before.value.mediaId);
    return res;
  },
  async restoreViewing(id) {
    const res = await supabaseLogRepository.restoreViewing(id);
    if (res.ok) {
      const after = await supabaseLogRepository.getViewing(id);
      if (after.ok) syncLater(after.value.mediaId);
    }
    return res;
  },
};

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
  media: MediaSearch;
  catalog: Catalog;
  keys: KeyVault;
  log: LogRepository;
  hidden: HiddenRepository;
  follows: FollowRepository;
  ratings: RatingsRepository;
  progress: ProgressRepository;
  passes: PassRepository;
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
  media: openverseSearch,
  catalog: edgeCatalog,
  keys: supabaseKeyVault,
  log: trackedLog,
  hidden: supabaseHiddenRepository,
  follows: supabaseFollowRepository,
  ratings: supabaseRatingsRepository,
  progress: supabaseProgressRepository,
  passes: supabasePassRepository,
  settings: supabaseSettingsRepository,
  wanted: supabaseWantedRepository,
};
