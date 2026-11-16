export type Department = { code: string; name: string };

// Snapshot of anteaterapi.com /websoc/departments (2026-11-01), minus TEST.
export const DEPARTMENTS: Department[] = [
  { code: "AC ENG", name: "Academic English" },
  { code: "AFAM", name: "African American Studies" },
  { code: "AI SCI", name: "Artificial Intelligence Science" },
  { code: "ANATOMY", name: "Anatomy and Neurobiology" },
  { code: "ANESTH", name: "Anesthesiology" },
  { code: "ANTHRO", name: "Anthropology" },
  { code: "ARABIC", name: "Arabic" },
  { code: "ARMN", name: "Armenian" },
  { code: "ART", name: "Art" },
  { code: "ART HIS", name: "Art History" },
  { code: "ARTS", name: "Arts" },
  { code: "ARTSHUM", name: "Arts and Humanities" },
  { code: "ART STU", name: "Arts Studio" },
  { code: "ASIANAM", name: "Asian American Studies" },
  { code: "ASL", name: "American Sign Language" },
  { code: "BANA", name: "Business Analytics" },
  { code: "BATS", name: "Biomedical and Translational Science" },
  { code: "BIOCHEM", name: "Biological Chemistry" },
  { code: "BIO SCI", name: "Biological Sciences" },
  { code: "BME", name: "Biomedical Engineering" },
  { code: "BSEMD", name: "Biological Sciences and Educational Media Design" },
  { code: "CAMPREC", name: "Campus Recreation" },
  { code: "CBE", name: "Chemical and Biomolecular Engineering" },
  { code: "CBEMS", name: "Chemical Engr and Materials Science" },
  { code: "CEM", name: "Community and Environmental Medicine" },
  { code: "CHC/LAT", name: "Chicano/Latino" },
  { code: "CHEM", name: "Chemistry" },
  { code: "CHINESE", name: "Chinese" },
  { code: "CLASSIC", name: "Classics" },
  { code: "CLT&THY", name: "Culture and Theory" },
  { code: "COGS", name: "Cognitive Sciences " },
  { code: "COM LIT", name: "Comparative Literature" },
  { code: "COMPCLT", name: "Comparative Culture" },
  { code: "COMPSCI", name: "Computer Science" },
  { code: "CRITISM", name: "Criticism" },
  { code: "CRM/LAW", name: "Criminology, Law and Society" },
  { code: "CSE", name: "Computer Science and Engineering" },
  { code: "DANCE", name: "Dance" },
  { code: "DATA", name: "Data Science" },
  { code: "DERM", name: "Dermatology" },
  { code: "DEV BIO", name: "Developmental and Cell Biology" },
  { code: "DRAMA", name: "Drama" },
  { code: "EARTHSS", name: "Earth System Science" },
  { code: "EAS", name: "East Asian Studies" },
  { code: "E ASIAN", name: "East Asian Languages and Literatures" },
  { code: "ECO EVO", name: "Ecology and Evolutionary Biology" },
  { code: "ECON", name: "Economics" },
  { code: "ECPS", name: "Embedded and Cyber-Physical Systems" },
  { code: "ED AFF", name: "Educational Affairs" },
  { code: "EDU ABR", name: "Education Abroad" },
  { code: "EDUC", name: "Education" },
  { code: "EECS", name: "Electrical Engineering and Computer Science" },
  { code: "EHS", name: "Environmental Health Sciences" },
  { code: "ENGLISH", name: "English" },
  { code: "ENGR", name: "Engineering" },
  { code: "ENGR AE", name: "Engineering, Aerospace" },
  { code: "ENGRBE", name: "Engrbe*" },
  { code: "ENGR BE", name: "Engineering, Biochemical" },
  { code: "ENGRCBE", name: "Engineering, Chemical and Biochemical" },
  { code: "ENGRCE", name: "Engrce*" },
  { code: "ENGR CE", name: "Engineering, Civil" },
  { code: "ENGRCEE", name: "Civil and Environmental Engineering" },
  { code: "ENGRCHE", name: "Engineering, Chemical" },
  { code: "ENGRECE", name: "Engineering, Electrical and Computer" },
  { code: "ENGRMAE", name: "Mechanical and Aerospace Engineering" },
  { code: "ENGR ME", name: "Engineering, Mechanical" },
  { code: "ENGRMSE", name: "Materials Science and Engineering" },
  { code: "ENVIRON", name: "Environmental Health, Science, and Policy" },
  { code: "EPIDEM", name: "Epidemiology" },
  { code: "ER MED", name: "Emergency Medicine" },
  { code: "EURO ST", name: "European Studies" },
  { code: "EXCHANG", name: "Campus Exchange Program" },
  { code: "FAM MED", name: "Family Medicine" },
  { code: "FILIPNO", name: "Filipino" },
  { code: "FILMSTD", name: "Film and Media Studies" },
  { code: "FIN", name: "Finance" },
  { code: "FINEART", name: "Fine Arts" },
  { code: "FLM&MDA", name: "Film and Media Studies" },
  { code: "FRENCH", name: "French" },
  { code: "GDIM", name: "Game Design and Interactive Media" },
  { code: "GEN&SEX", name: "Gender and Sexuality Studies" },
  { code: "GERMAN", name: "German" },
  { code: "GLBLCLT", name: "Global Cultures" },
  { code: "GLBL ME", name: "Global Middle East Studies" },
  { code: "GREEK", name: "Greek" },
  { code: "HEBREW", name: "Hebrew" },
  { code: "HINDI", name: "Hindi" },
  { code: "HISTORY", name: "History" },
  { code: "HUMAN", name: "Humanities" },
  { code: "HUMARTS", name: "Humanities and Arts" },
  { code: "I&C SCI", name: "Information and Computer Science" },
  { code: "IN4MATX", name: "Informatics" },
  { code: "INNO", name: "Innovation and Entrepreneurship" },
  { code: "INT DEP", name: "Int Dep*" },
  { code: "INTL ST", name: "International Studies" },
  { code: "INT MED", name: "Internal Medicine" },
  { code: "IRAN", name: "Iranian" },
  { code: "ITALIAN", name: "Italian" },
  { code: "JAPANSE", name: "Japanese" },
  { code: "JUDAICA", name: "Judaica Studies" },
  { code: "KOREAN", name: "Korean" },
  { code: "LATIN", name: "Latin" },
  { code: "LAW", name: "Law" },
  { code: "LINGUIS", name: "Linguistics" },
  { code: "LIT JRN", name: "Literary Journalism" },
  { code: "LPS", name: "Logic and Philosophy of Science" },
  { code: "LSCI", name: "Language Science" },
  { code: "MATH", name: "Mathematics" },
  { code: "MED", name: "Medicine" },
  { code: "MED ED", name: "Medical Education" },
  { code: "MED HUM", name: "Medical Humanities" },
  { code: "MGMT", name: "Management" },
  { code: "MGMT EP", name: "Executive MBA" },
  { code: "MGMT FE", name: "Fully Employed MBA" },
  { code: "MGMT HC", name: "Health Care MBA" },
  { code: "MGMTMBA", name: "Management MBA" },
  { code: "MGMTPHD", name: "Management PhD" },
  { code: "MIC BIO", name: "Microbiology" },
  { code: "M&MG", name: "Microbiology and Molecular Genetics" },
  { code: "MNGE", name: "Master in Management" },
  { code: "MOL BIO", name: "Molecular Biology and Biochemistry" },
  { code: "MPAC", name: "Accounting" },
  { code: "MSE", name: "Materials Science and Engineering" },
  { code: "MUSIC", name: "Music" },
  { code: "NET SYS", name: "Networked Systems" },
  { code: "NEURBIO", name: "Neurobiology and Behavior" },
  { code: "NEUROL", name: "Neurology" },
  { code: "NUR DNP", name: "Nursing Practice" },
  { code: "NUR SCI", name: "Nursing Science" },
  { code: "OB/GYN", name: "Obstetrics and Gynecology" },
  { code: "OPHTHAL", name: "Ophthalmology and Visual Sciences" },
  { code: "PATH", name: "Pathology and Laboratory Medicine" },
  { code: "PED GEN", name: "Pediatrics Genetics" },
  { code: "PEDS", name: "Pediatrics" },
  { code: "PERSIAN", name: "Persian" },
  { code: "PHARM", name: "Pharmacology" },
  { code: "PHILOS", name: "Philosophy" },
  { code: "PHMD", name: "Pharmacy" },
  { code: "PHRMSCI", name: "Pharmaceutical Sciences" },
  { code: "PHY ED", name: "Physical Education" },
  { code: "PHY SCI", name: "Physical Science" },
  { code: "PHYSICS", name: "Physics" },
  { code: "PHYSIO", name: "Physiology and Biophysics" },
  { code: "PM&R", name: "Physical Medicine and Rehabilitation" },
  { code: "POL SCI", name: "Political Science" },
  { code: "PORTUG", name: "Portuguese" },
  { code: "PP&D", name: "Planning, Policy, and Design" },
  { code: "PSCI", name: "Psychological Science" },
  { code: "PSMD", name: "Psychiatry" },
  { code: "PSY", name: "Psychology" },
  { code: "PSY BEH", name: "Psychology and Social Behavior" },
  { code: "PSYBIO", name: "Psychobiology" },
  { code: "PSYCH", name: "Psychiatry" },
  { code: "PUBHLTH", name: "Public Health" },
  { code: "PUB POL", name: "Public Policy" },
  { code: "RADIO", name: "Radiology" },
  { code: "RAD SCI", name: "Radiological Sciences" },
  { code: "REL STD", name: "Religious Studies" },
  { code: "ROTC", name: "Reserve Officers' Training Corps" },
  { code: "RUSSIAN", name: "Russian" },
  { code: "SOCECOL", name: "Social Ecology" },
  { code: "SOCIOL", name: "Sociology" },
  { code: "SOC SCI", name: "Social Science" },
  { code: "SPANISH", name: "Spanish" },
  { code: "SPPS", name: "Social Policy and Public Service" },
  { code: "STATS", name: "Statistics" },
  { code: "SURGERY", name: "Surgery" },
  { code: "SWE", name: "Software Engineering" },
  { code: "SYS BIO", name: "Systems Biology" },
  { code: "TAGALOG", name: "Tagalog" },
  { code: "TOX", name: "Toxicology" },
  { code: "UCDC", name: "UC Washington DC" },
  { code: "UNI AFF", name: "University Affairs" },
  { code: "UNI STU", name: "University Studies" },
  { code: "UPPP", name: "Urban Planning and Public Policy" },
  { code: "URBPLAN", name: "Planning, Policy, and Design" },
  { code: "VIETMSE", name: "Vietnamese" },
  { code: "VIS STD", name: "Visual Studies" },
  { code: "WOMN ST", name: "Women's Studies" },
  { code: "WRITING", name: "Writing" },
];

// Student shorthand -> Anteater code. Keys are normalized (uppercase, no whitespace).
const ALIASES: Record<string, string> = {
  ICS: "I&C SCI",
  ICSCI: "I&C SCI",
  INF: "IN4MATX",
  INFX: "IN4MATX",
  INFO: "IN4MATX",
  INFORMATICS: "IN4MATX",
  CS: "COMPSCI",
  STAT: "STATS",
  BIO: "BIO SCI",
  PHYS: "PHYSICS",
  POLSCI: "POL SCI",
  PHIL: "PHILOS",
  HIST: "HISTORY",
  ANTH: "ANTHRO",
  SOC: "SOCIOL",
  MAE: "ENGRMAE",
  CEE: "ENGRCEE",
  WRIT: "WRITING",
  MGT: "MGMT",
  PUBHEALTH: "PUBHLTH",
};

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");

const LOOKUP = new Map<string, string>();
for (const d of DEPARTMENTS) {
  LOOKUP.set(norm(d.code), d.code);
  if (!LOOKUP.has(norm(d.name))) LOOKUP.set(norm(d.name), d.code);
}
for (const [alias, code] of Object.entries(ALIASES)) LOOKUP.set(alias, code);

export function resolveDept(raw: string): string | null {
  const key = norm(raw);
  return key ? (LOOKUP.get(key) ?? null) : null;
}

// Tie-break for autocomplete: departments most students search for.
const COMMON = ["I&C SCI", "COMPSCI", "IN4MATX", "MATH", "STATS", "WRITING", "BIO SCI", "MGMT", "ECON", "PSYCH", "PSCI", "CHEM", "PHYSICS"];
const common = (code: string) => (COMMON.includes(code) ? COMMON.indexOf(code) : COMMON.length);

const BY_CODE = new Map(DEPARTMENTS.map((d) => [d.code, d]));

export function matchDepartments(query: string, limit = 8): Department[] {
  const q = norm(query);
  if (!q) return [];
  const exact = LOOKUP.get(q);
  const hits = new Map<string, number>(); // code -> rank (lower is better)
  if (exact) hits.set(exact, 0);
  const add = (code: string, rank: number) => {
    if ((hits.get(code) ?? Infinity) > rank) hits.set(code, rank);
  };
  for (const [alias, code] of Object.entries(ALIASES)) if (alias.startsWith(q)) add(code, 1);
  for (const d of DEPARTMENTS) {
    if (norm(d.code).startsWith(q)) add(d.code, 1);
    else if (norm(d.name).startsWith(q)) add(d.code, 2);
    else if (d.name.toUpperCase().split(/[\s&,-]+/).some((w) => w.startsWith(q))) add(d.code, 3);
  }
  return [...hits]
    .sort((a, b) => a[1] - b[1] || common(a[0]) - common(b[0]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([code]) => BY_CODE.get(code) ?? { code, name: code });
}
