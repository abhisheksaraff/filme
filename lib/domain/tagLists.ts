// lib/domain/tagLists.ts
// The countries and languages that can be typed as search tags. Only the two-letter codes are listed; the names come from the
// browser's own translation tables, so every language is covered without a hand-written list.

/** ISO 3166-1 countries, by two-letter code. */
export const COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI",
  "KH","CM","CA","CV","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE",
  "SZ","ET","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IL","IT",
  "JM","JP","JO","KZ","KE","KI","KP","KR","XK","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH",
  "MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PS","PA","PG","PY",
  "PE","PH","PL","PT","PR","QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","SS","ES",
  "LK","SD","SR","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV","UG","UA","AE","GB","US","UY","UZ","VU","VA","VE",
  "VN","YE","ZM","ZW","SU","YU","CS","DD",
] as const;

/** ISO 639-1 languages that films are made in. */
export const LANGUAGE_CODES = [
  "af","sq","am","ar","hy","az","eu","be","bn","bs","bg","my","ca","zh","cn","hr","cs","da","nl","en","eo","et","fi","fr","gl","ka","de","el","gu",
  "he","hi","hu","is","id","ga","it","ja","kn","kk","km","ko","ku","lo","lv","lt","mk","ms","ml","mt","mr","mn","ne","no","fa","pl","pt","pa","ro",
  "ru","sr","si","sk","sl","so","es","sw","sv","tl","ta","te","th","tr","uk","ur","uz","vi","cy","yi","zu","la","xx",
] as const;

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const languageNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "language" }) : null;

/** Names for codes the browser's tables do not know, such as the Soviet Union. */
const OLD_COUNTRIES: Record<string, string> = { SU: "Soviet Union", YU: "Yugoslavia", CS: "Czechoslovakia", DD: "East Germany", XK: "Kosovo" };
const EXTRA_LANGUAGES: Record<string, string> = { cn: "Cantonese", xx: "No spoken language" };

/** The English name for a country code, or the code itself when nothing is known. */
export function countryName(code: string): string {
  if (OLD_COUNTRIES[code]) return OLD_COUNTRIES[code];
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The English name for a language code, or the code itself when nothing is known. */
export function languageName(code: string): string {
  if (EXTRA_LANGUAGES[code]) return EXTRA_LANGUAGES[code];
  try {
    return languageNames?.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Adjective forms people type for a country ("german" for Germany), so either word finds it. */
export const COUNTRY_ADJECTIVES: Record<string, string> = {
  DE: "german", FR: "french", IN: "indian", IT: "italian", JP: "japanese", KR: "korean", CN: "chinese", ES: "spanish", GB: "british english",
  US: "american", RU: "russian", SE: "swedish", DK: "danish", NO: "norwegian", FI: "finnish", PL: "polish", MX: "mexican", BR: "brazilian",
  AR: "argentine argentinian", IR: "iranian persian", TR: "turkish", EG: "egyptian", GR: "greek", NL: "dutch", BE: "belgian", AT: "austrian",
  CH: "swiss", IE: "irish", CA: "canadian", AU: "australian", NZ: "new zealand", TH: "thai", VN: "vietnamese", ID: "indonesian", PH: "filipino",
  PK: "pakistani", BD: "bangladeshi", LK: "sri lankan", NP: "nepali", IL: "israeli", SA: "saudi", NG: "nigerian", ZA: "south african",
  CZ: "czech", HU: "hungarian", RO: "romanian", UA: "ukrainian", PT: "portuguese", CU: "cuban", CL: "chilean", CO: "colombian", TW: "taiwanese",
  HK: "hong kong", SU: "soviet", YU: "yugoslav", DD: "east german",
};
