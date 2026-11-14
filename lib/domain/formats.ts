// lib/domain/formats.ts
/**
 * Primary Base Format / Screen Type (Choose Exactly ONE)
 * Represents the core auditorium brand or venue type.
 */
export const PRIMARY_FORMATS = [
  "Regular",
  "Standard",
  
  // --- Major Global PLFs & Specialty Auditoriums ---
  "IMAX",
  "Dolby Cinema",
  "4DX",                  // Complete sensory motion auditorium
  "ScreenX",              // 270-degree wall screens
  "ICE Immersive",        // Side LED panels + PLF
  
  // --- North American Major Chains ---
  "UltraAVX",             // Cineplex (Canada)
  "InfinityVision",       // Cineplex next-gen LED / multi-screen
  "VIP",                  // Cineplex 19+
  "Cineplex Clubhouse",
  "Laser ULTRA",          // Landmark (Canada) & Kinepolis (Europe)
  "EXTRA",                // Landmark
  "PRIME",                // AMC
  "XL",                   // AMC non-PLF large screen (40ft+)
  "RPX",                  // Regal
  "Cinemark XD",
  "Super EMAX",           // Marcus
  "UltraScreen DLX",      // Marcus
  "Cine Capri",           // Harkins
  "BigD",                 // AMC / GTC
  "Titan XC",             // Reading
  "The Big Show",         // Alamo Drafthouse
  "Monster Screen",       // Celebrity Cinemas
  
  // --- Latin America & Caribbean ---
  "MacroXE",              // Cinépolis PLF (Latin America, India, US)
  "Cinépolis Junior",     // Cinépolis family auditorium
  "MEGA Screen",          // Cinemex PLF
  
  // --- Europe & UK ---
  "ISENSE",               // Odeon / UCI
  "Superscreen",          // Cineworld
  "Vue Xtreme",           // Vue
  "Dolby Atmos Cinema",   // Pathé / European standalone PLFs
  "Kinepolis Laser ULTRA",// Kinepolis flagship format
  
  // --- Middle East & Africa (MENA) ---
  "MAX",                  // VOX Cinemas PLF
  "XPERIENCE",            // Muvi Cinemas (Saudi Arabia)
  
  // --- Asia & Oceania ---
  "P[XL]",                // PVR Cinemas (India)
  "LUXE",                 // RealD PLF brand (China & UK)
  "Vmax",                 // Event / Village Cinemas (Australia/NZ)
  "TCX",                  // TOHO (Japan)
  "SphereX",              // CJ CGV (Asia)
  "STARium",              // CJ CGV (Asia)
  
  // --- Special Venues ---
  "Live",                 // Concerts, theatre performances, live events
  "Drive-In",
  "Planetarium / Dome",
  "Archival / Repertory",
  
  // --- Fallback ---
  "Unknown"
] as const;

export type PrimaryFormat = (typeof PRIMARY_FORMATS)[number];

/**
 * Format Add-ons & Modifiers (Choose ZERO or MULTIPLE)
 * Pure, non-overlapping atomic traits.
 */
export const FORMAT_ADDONS = [
  // --- Physical Film Stock ---
  "70mm",
  "35mm",
  "16mm",
  "8mm",
  
  // --- Projection, Display & Resolution ---
  "4K",
  "2K",
  "Laser",
  "Dual Laser",
  "LED Screen",           // Samsung Onyx / direct-view display
  "HFR",                  // High Frame Rate (48/60/120 fps)
  
  // --- Dimension & 3D Tech ---
  "2D",
  "3D",
  "RealD 3D",
  "IMAX 3D",
  "Dolby 3D",
  
  // --- Motion & Seating ---
  "D-BOX",                // Individual motion seats
  "MX4D",
  
  // --- Audio Tech ---
  "Dolby Atmos",
  "DTS:X",
  "7.1 Surround",
  "5.1 Surround",
  
  // --- Accessibility & Language ---
  "Open Caption",
  "Closed Caption",
  "Audio Description",
  "Subtitled",
  "Dubbed",
  "Sensory Friendly",
  
  // --- Special Event Features ---
  "Early Access",
  "Fan Event",
  "Sing-Along",
  "Live Orchestra",
  "Director Q&A",
  "Double Feature",
  "Marathon",
  "Re-Release"
] as const;

export type FormatAddon = (typeof FORMAT_ADDONS)[number];
