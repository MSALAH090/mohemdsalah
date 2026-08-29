import { useState, useMemo } from "react";
import { getPlayerImage, type Player } from "@/lib/players";
import { cn } from "@/lib/utils";

// English name mapping for common players, with fallback to capitalized id
const PLAYER_NAMES_EN: Record<string, string> = {
  messi: "MESSI",
  ronaldo: "C. RONALDO",
  mbappe: "MBAPPÉ",
  haaland: "HAALAND",
  vini: "VINÍCIUS JR.",
  bellingham: "BELLINGHAM",
  salah: "M. SALAH",
  debruyne: "DE BRUYNE",
  kane: "H. KANE",
  lewa: "LEWANDOWSKI",
  rodri: "RODRI",
  valverde: "VALVERDE",
  pedri: "PEDRI",
  gavi: "GAVI",
  wirtz: "WIRTZ",
  musiala: "MUSIALA",
  odegaard: "ØDEGAARD",
  kimmich: "KIMMICH",
  modric: "MODRIĆ",
  fdj: "DE JONG",
  bruno: "B. FERNANDES",
  saka: "SAKA",
  foden: "FODEN",
  rapha: "RAPHINHA",
  yamal: "L. YAMAL",
  leao: "R. LEÃO",
  kvara: "KVARATSKHELIA",
  doku: "DOKU",
  nico: "NICO WILLIAMS",
  olise: "OLISE",
  dembele: "O. DEMBÉLÉ",
  griez: "GRIEZMANN",
  osimhen: "OSIMHEN",
  vlahovic: "VLAHOVIĆ",
  gyokeres: "GYÖKERES",
  isak: "ISAK",
  martinez_l: "L. MARTÍNEZ",
  nunez: "DARWIN",
  benzema: "BENZEMA",
  mitrovic: "MITROVIĆ",
  vandijk: "VAN DIJK",
  dias: "RÚBEN DIAS",
  saliba: "SALIBA",
  hernandez: "T. HERNÁNDEZ",
  bastoni: "BASTONI",
  hakimi: "A. HAKIMI",
  cubarsi: "CUBARSÍ",
  marquinhos: "MARQUINHOS",
  rudiger: "RÜDIGER",
  carvajal: "CARVAJAL",
  taa: "ALEXANDER-ARNOLD",
  gvardiol: "GVARDIOL",
  militao: "É. MILITÃO",
  kounde: "KOUNDÉ",
  romero: "C. ROMERO",
  alba: "JORDI ALBA",
  courtois: "COURTOIS",
  alisson: "ALISSON",
  donnarumma: "DONNARUMMA",
  terstegen: "TER STEGEN",
  neuer: "NEUER",
  maignan: "MAIGNAN",
  raya: "RAYA",
  oblak: "OBLAK",
  bounou: "BOUNOU",
  elshenawy: "EL SHENAWY",
  palmer: "COLE PALMER",
  rice: "DECLAN RICE",
  mainoo: "K. MAINOO",
  zubimendi: "ZUBIMENDI",
  tchouameni: "TCHOUAMÉNI",
  camavinga: "CAMAVINGA",
  barella: "BARELLA",
  szoboszlai: "SZOBOSZLAI",
  mac_allister: "MAC ALLISTER",
  konate: "I. KONATÉ",
  martinez_e: "EMI MARTÍNEZ",
  sommer: "SOMMER",
  diogo: "DIOGO COSTA",
  saliba2: "SALIBA",
  huijsen: "HUIJSEN",
  guehi: "M. GUÉHI",
  dumfries: "DUMFRIES",
  theo2: "T. HERNÁNDEZ",
  sesko: "ŠEŠKO",
  zirkzee: "ZIRKZEE",
  retegui: "RETEGUI",
  david: "J. DAVID",
  openda: "OPENDA",
  marmoush: "MARMOUSH",
  kudus: "M. KUDUS",
  mudryk: "MUDRYK",
  garnacho: "GARNACHO",
  rodrygo: "RODRYGO",
  cherki: "R. CHERKI",
  diaz_l: "LUIS DÍAZ",
  nkunku: "NKUNKU",
  ederson: "EDERSON",
  lunin: "LUNIN",
  onana: "A. ONANA",
  mamardashvili: "MAMARDASHVILI",
  vicario: "VICARIO",
  trubin: "TRUBIN",
  kobel: "G. KOBEL",
  nuno_mendes: "NUNO MENDES",
  van_de_ven: "VAN DE VEN",
  araujo: "R. ARAÚJO",
  kim_minjae: "KIM MIN-JAE",
  upamecano: "UPAMECANO",
  calafiori: "CALAFIORI",
  gabriel: "GABRIEL",
  stones: "JOHN STONES",
  de_ligt: "DE LIGT",
  bremer: "BREMER",
  dimarco: "DIMARCO",
  frattesi: "FRATTESI",
  vitinha: "VITINHA",
  joao_neves: "JOÃO NEVES",
  enzo: "ENZO F.",
  caicedo: "M. CAICEDO",
  bernardo: "BERNARDO SILVA",
  gundogan: "GÜNDOĞAN",
  locatelli: "LOCATELLI",
  depaul: "DE PAUL",
  xavi_simons: "XAVI SIMONS",
  doue: "D. DOUÉ",
  barcola: "BARCOLA",
  kubo: "KUBO",
  mitoma: "MITOMA",
  sancho: "SANCHO",
  coman: "COMAN",
  chiesa: "CHIESA",
  savinho: "SAVINHO",
  julian: "J. ÁLVAREZ",
  thuram: "M. THURAM",
  hojlund: "HØJLUND",
  boniface: "BONIFACE",
  watkins: "O. WATKINS",
  solanke: "D. SOLANKE",
  endrick: "ENDRICK",
  duran: "JHÓN DURÁN",
  neymar: "NEYMAR JR",
  hamdallah: "A. HAMDALLAH",
  kanno: "M. KANNO",
  alshehri: "S. AL-SHEHRI",
  trezeguet: "TREZEGUET",
  mostafa: "MOSTAFA MOHAMED",
  msakni: "Y. MSAKNI",
  bennasser: "I. BENNACER",
  bouali: "BOUALI",
  elsulaya: "AMR EL SULAYA",
  alowais: "M. AL-OWAIS",
  hamed: "TAREK HAMED",
  hakim: "HAKIM ZIYECH",
  amrabat: "S. AMRABAT",
  elneny: "M. ELNENY",
  hegazy: "A. HEGAZY",
  marcelo: "MARCELO",
  dani: "DANI ALVES",
  akram: "AKRAM AFIF",
  moanes: "MOANES DABBOUR",
  pele: "PELÉ",
  maradona: "MARADONA",
  zidane: "ZIDANE",
  ronaldinho: "RONALDINHO",
  r9: "RONALDO R9",
  cannavaro: "CANNAVARO",
  maldini: "MALDINI",
  buffon: "BUFFON",
  kahn: "O. KAHN",
  figo: "LUÍS FIGO",
  iniesta: "INIESTA",
  xavi: "XAVI",
  gerrard: "GERRARD",
  drogba: "DROGBA",
  henry: "T. HENRY",
  cruyff: "CRUYFF",
  beckenbauer: "BECKENBAUER",
  puskas: "PUSKÁS",
  eusebio: "EUSÉBIO",
  baggio: "R. BAGGIO",
  zico: "ZICO",
  romario: "ROMÁRIO",
  totti: "TOTTI",
  kaka: "KAKÁ",
  nedved: "NEDVĚD",
  pirlo: "PIRLO",
  scholes: "SCHOLES",
  beckham: "BECKHAM",
  roberto_carlos: "R. CARLOS",
  nesta: "NESTA",
  puyol: "PUYOL",
  ramos: "SERGIO RAMOS",
  casillas: "CASILLAS",
  schmeichel: "P. SCHMEICHEL",
  yashin: "L. YASHIN",
  shevchenko: "SHEVCHENKO",
  raul: "RAÚL",
  ibra: "IBRAHIMOVIĆ",
  aguero: "AGÜERO",
  robben: "A. ROBBEN",
  ribery: "F. RIBÉRY",
  bale: "GARETH BALE",
  hazard: "E. HAZARD",
};

// Known famous FIFA card stats
const FAMOUS_STATS: Record<string, { s1: number; s2: number; s3: number; s4: number; s5: number; s6: number }> = {
  haaland:    { s1: 91, s2: 94, s3: 79, s4: 89, s5: 48, s6: 90 },
  messi:      { s1: 99, s2: 99, s3: 99, s4: 99, s5: 54, s6: 93 },
  mbappe:     { s1: 97, s2: 90, s3: 82, s4: 92, s5: 36, s6: 78 },
  ronaldo:    { s1: 88, s2: 93, s3: 82, s4: 88, s5: 35, s6: 78 },
  salah:      { s1: 92, s2: 89, s3: 83, s4: 90, s5: 45, s6: 77 },
  vini:       { s1: 96, s2: 84, s3: 81, s4: 91, s5: 32, s6: 69 },
  bellingham: { s1: 83, s2: 87, s3: 84, s4: 89, s5: 78, s6: 83 },
  debruyne:   { s1: 74, s2: 88, s3: 94, s4: 87, s5: 65, s6: 75 },
  kane:       { s1: 73, s2: 93, s3: 84, s4: 83, s5: 49, s6: 83 },
  lewa:       { s1: 77, s2: 91, s3: 80, s4: 86, s5: 44, s6: 82 },
  rodri:      { s1: 65, s2: 74, s3: 86, s4: 80, s5: 87, s6: 85 },
  valverde:   { s1: 89, s2: 83, s3: 85, s4: 85, s5: 81, s6: 84 },
  pedri:      { s1: 78, s2: 72, s3: 88, s4: 89, s5: 68, s6: 73 },
  gavi:       { s1: 77, s2: 68, s3: 83, s4: 86, s5: 71, s6: 80 },
  wirtz:      { s1: 83, s2: 81, s3: 88, s4: 90, s5: 53, s6: 68 },
  musiala:    { s1: 87, s2: 81, s3: 83, s4: 91, s5: 35, s6: 66 },
  yamal:      { s1: 93, s2: 82, s3: 85, s4: 91, s5: 30, s6: 58 },
  vandijk:    { s1: 78, s2: 60, s3: 71, s4: 72, s5: 90, s6: 86 },
  dias:       { s1: 68, s2: 39, s3: 70, s4: 69, s5: 89, s6: 87 },
  saliba:     { s1: 82, s2: 38, s3: 70, s4: 74, s5: 88, s6: 83 },
  courtois:   { s1: 85, s2: 89, s3: 76, s4: 93, s5: 46, s6: 90 },
  alisson:    { s1: 86, s2: 85, s3: 85, s4: 89, s5: 54, s6: 90 },
  ronaldinho: { s1: 94, s2: 91, s3: 92, s4: 97, s5: 37, s6: 81 },
  zidane:     { s1: 85, s2: 92, s3: 96, s4: 95, s5: 75, s6: 86 },
  pele:       { s1: 96, s2: 96, s3: 93, s4: 96, s5: 60, s6: 77 },
  maradona:   { s1: 92, s2: 94, s3: 92, s4: 97, s5: 42, s6: 75 },
  r9:         { s1: 97, s2: 95, s3: 81, s4: 95, s5: 45, s6: 76 },
};

function getPlayerStats(player: Player): {
  labels: [string, string, string, string, string, string];
  values: [number, number, number, number, number, number];
} {
  const isGK = player.base === "GK";

  if (isGK) {
    const gkLabels: [string, string, string, string, string, string] = ["DIV", "REF", "HAN", "SPE", "KIC", "POS"];
    const ovr = player.overall;
    const s = FAMOUS_STATS[player.id];
    if (s) {
      return { labels: gkLabels, values: [s.s1, s.s4, s.s2, s.s5, s.s3, s.s6] };
    }
    return {
      labels: gkLabels,
      values: [
        Math.min(99, Math.round(ovr * 0.96)),
        Math.min(99, Math.round(ovr * 0.98)),
        Math.min(99, Math.round(ovr * 0.94)),
        Math.min(99, Math.round(ovr * 0.52)),
        Math.min(99, Math.round(ovr * 0.88)),
        Math.min(99, Math.round(ovr * 0.95)),
      ],
    };
  }

  const labels: [string, string, string, string, string, string] = ["PAC", "DRI", "SHO", "DEF", "PAS", "PHY"];

  const s = FAMOUS_STATS[player.id];
  if (s) {
    return {
      labels,
      values: [s.s1, s.s4, s.s2, s.s5, s.s3, s.s6],
    };
  }

  // Deterministic formula from player OVR + Base position
  const ovr = player.overall;
  const pos = player.base;

  let pac = 75, sho = 70, pas = 70, dri = 72, def = 60, phy = 70;

  switch (pos) {
    case "ST":
      pac = Math.round(ovr * 0.94);
      sho = Math.round(ovr * 0.98);
      pas = Math.round(ovr * 0.78);
      dri = Math.round(ovr * 0.90);
      def = Math.round(ovr * 0.40);
      phy = Math.round(ovr * 0.88);
      break;
    case "WING":
      pac = Math.round(ovr * 0.98);
      sho = Math.round(ovr * 0.88);
      pas = Math.round(ovr * 0.85);
      dri = Math.round(ovr * 0.96);
      def = Math.round(ovr * 0.38);
      phy = Math.round(ovr * 0.72);
      break;
    case "MID":
      pac = Math.round(ovr * 0.82);
      sho = Math.round(ovr * 0.80);
      pas = Math.round(ovr * 0.96);
      dri = Math.round(ovr * 0.89);
      def = Math.round(ovr * 0.75);
      phy = Math.round(ovr * 0.80);
      break;
    case "DEF":
      pac = Math.round(ovr * 0.82);
      sho = Math.round(ovr * 0.45);
      pas = Math.round(ovr * 0.74);
      dri = Math.round(ovr * 0.72);
      def = Math.round(ovr * 0.98);
      phy = Math.round(ovr * 0.92);
      break;
  }

  return {
    labels,
    values: [
      Math.min(99, pac),
      Math.min(99, dri),
      Math.min(99, sho),
      Math.min(99, def),
      Math.min(99, pas),
      Math.min(99, phy),
    ],
  };
}

export function PlayerCard({
  player,
  size = "lg",
  className,
  posLabel,
}: {
  player: Player;
  size?: "sm" | "lg";
  className?: string | undefined;
  posLabel?: string | undefined;
}) {
  const big = size === "lg";
  const imageUrl = player.image || getPlayerImage(player);
  const [imgError, setImgError] = useState(false);
  const hasImage = !!(imageUrl && !imgError);

  const stats = useMemo(() => getPlayerStats(player), [player]);
  const nameEn = PLAYER_NAMES_EN[player.id] || player.id.toUpperCase();

  // Tier color styling
  const isLegend = player.tier === "legend";
  const isGold = player.tier === "gold";

  return (
    <div
      className={cn(
        "relative shrink-0 group select-none transition-all duration-300 hover:scale-105",
        big ? "w-64 sm:w-72 h-[380px] sm:h-[430px]" : "w-44 sm:w-48 h-[270px] sm:h-[295px]",
        className,
      )}
    >
      {/* Outer Glow Wings */}
      <div
        className={cn(
          "absolute -inset-2 opacity-85 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none filter blur-md",
          isLegend
            ? "bg-gradient-to-t from-[#ff3d00] via-[#ff9100] to-[#ffd700] animate-pulse"
            : isGold
            ? "bg-gradient-to-b from-[#ffd700]/45 via-[#d4af37]/35 to-transparent"
            : "bg-gradient-to-b from-[#c0c0e0]/40 via-[#8b5cf6]/30 to-transparent",
        )}
        style={{
          clipPath: "polygon(14% 0%, 50% 3%, 86% 0%, 100% 12%, 100% 86%, 50% 100%, 0% 86%, 0% 12%)",
        }}
      />

      {/* FUT Card Outer Metallic Bevel Frame */}
      <div
        className="w-full h-full p-[3px] sm:p-[3.5px] transition-transform duration-300"
        style={{
          background: isLegend
            ? "linear-gradient(135deg, #FFF9C4 0%, #FFD700 20%, #FF8F00 45%, #FF3D00 70%, #FFD700 100%)"
            : isGold
            ? "linear-gradient(145deg, #FFF9C4 0%, #D4AF37 35%, #855800 65%, #FFD700 100%)"
            : "linear-gradient(145deg, #FFFFFF 0%, #B0BEC5 40%, #78909C 75%, #ECEFF1 100%)",
          clipPath: "polygon(14% 0%, 50% 3%, 86% 0%, 100% 12%, 100% 86%, 50% 100%, 0% 86%, 0% 12%)",
          boxShadow: isLegend
            ? "0 10px 30px rgba(255,69,0,0.6), 0 0 35px rgba(255,215,0,0.8), inset 0 0 15px rgba(255,140,0,0.5)"
            : "0 10px 30px rgba(0,0,0,0.8), 0 0 25px rgba(255,215,0,0.3)",
        }}
      >
        {/* Inner Card Body */}
        <div
          className="w-full h-full relative overflow-hidden flex flex-col justify-between"
          style={{
            background: isLegend
              ? "linear-gradient(180deg, #331000 0%, #200800 35%, #0d0300 75%, #000000 100%)"
              : "linear-gradient(180deg, #18092B 0%, #0E041B 35%, #05010A 75%, #000000 100%)",
            clipPath: "polygon(14% 0%, 50% 3%, 86% 0%, 100% 12%, 100% 86%, 50% 100%, 0% 86%, 0% 12%)",
          }}
        >
          {/* Cosmic Crystal / Fiery Flame Shard Geometry */}
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              backgroundImage: isLegend
                ? `
                radial-gradient(circle at 50% 20%, rgba(255, 140, 0, 0.6) 0%, transparent 65%),
                radial-gradient(circle at 20% 10%, rgba(255, 215, 0, 0.5) 0%, transparent 40%),
                radial-gradient(circle at 80% 10%, rgba(255, 69, 0, 0.5) 0%, transparent 45%),
                linear-gradient(180deg, rgba(255, 69, 0, 0.3) 0%, transparent 50%, rgba(255, 215, 0, 0.25) 100%)
              `
                : `
                radial-gradient(circle at 50% 25%, rgba(139, 92, 246, 0.4) 0%, transparent 65%),
                radial-gradient(circle at 15% 10%, rgba(255, 215, 0, 0.35) 0%, transparent 40%),
                radial-gradient(circle at 85% 10%, rgba(0, 229, 255, 0.3) 0%, transparent 45%),
                linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, transparent 50%, rgba(139, 92, 246, 0.2) 100%)
              `,
            }}
          />

          {/* Golden / Fire Geometric Shards Border Overlay */}
          <div className="absolute inset-0 pointer-events-none border border-[#ffd700]/30 opacity-70" />

          {/* ── TOP SECTION: Player Image + Top Left Stack (Rating / Pos / Flag / Club) ── */}
          <div className="relative flex-1 w-full overflow-hidden">
            {/* Top Left Stack */}
            <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-4 z-20 flex flex-col items-center leading-none select-none">
              {/* OVR Rating */}
              <span
                className={cn(
                  "font-display font-black tracking-tighter leading-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]",
                  isLegend ? "text-[#FFF59D] animate-pulse" : "text-[#FFE57F]",
                  big ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
                )}
                style={{
                  textShadow: isLegend
                    ? "0 0 16px rgba(255,100,0,1), 0 0 30px rgba(255,215,0,0.9), 0 2px 4px rgba(0,0,0,0.9)"
                    : "0 0 12px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.9)",
                }}
              >
                {player.overall}
              </span>

              {/* Position */}
              <span
                className={cn(
                  "font-display font-bold uppercase tracking-wider text-[#FFD700] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]",
                  big ? "text-xs sm:text-sm mt-0.5" : "text-[10px] mt-0.5",
                )}
              >
                {posLabel ?? player.base}
              </span>

              {/* Thin gold divider */}
              <div className="w-5 h-[1.5px] bg-[#ffd700]/50 my-1 rounded-full" />

              {/* Country Flag */}
              <span className={cn("filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]", big ? "text-lg sm:text-xl" : "text-xs sm:text-sm")}>
                {player.flag}
              </span>

              {/* Club Emblem Shield */}
              <div
                className={cn(
                  "mt-1 rounded-full flex items-center justify-center font-display font-extrabold text-[#ffd700] border border-[#ffd700]/60 bg-black/60 shadow-[0_0_8px_rgba(255,215,0,0.3)]",
                  big ? "w-5 h-5 sm:w-6 sm:h-6 text-[8px] sm:text-[9px]" : "w-4 h-4 text-[7px]",
                )}
                title={player.clubAr}
              >
                🛡️
              </div>
            </div>

            {/* Central Player Image */}
            <div className="absolute inset-0 flex items-center justify-center pt-2 overflow-hidden">
              {hasImage ? (
                <img
                  src={imageUrl}
                  alt={player.nameAr}
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onError={() => setImgError(true)}
                  className={cn(
                    "object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] transition-transform duration-500 group-hover:scale-110",
                    big ? "h-44 sm:h-56 max-w-[80%] translate-x-3 translate-y-1" : "h-28 sm:h-34 max-w-[75%] translate-x-2",
                  )}
                  style={{
                    filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.95)) contrast(1.05) saturate(1.1)",
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center my-auto opacity-20">
                  <span className={cn("font-display font-black text-white", big ? "text-6xl" : "text-4xl")}>
                    {player.base}
                  </span>
                </div>
              )}
            </div>

            {/* Gradient Mask at bottom of player image */}
            <div
              className="absolute bottom-0 inset-x-0 h-16 pointer-events-none z-10"
              style={{
                background: "linear-gradient(0deg, rgba(8,2,16,1) 0%, rgba(8,2,16,0.85) 45%, transparent 100%)",
              }}
            />
          </div>

          {/* ── LOWER SECTION: Name Banner + 6 FUT Stats Grid + Sub-Footer ── */}
          <div className="relative z-20 w-full px-2 sm:px-3 pb-2.5 sm:pb-3 flex flex-col items-center bg-gradient-to-t from-black via-[#080210]/95 to-transparent">
            {/* "TITAN" or "LEGENDS" watermark badge */}
            <div
              className={cn(
                "text-[7px] sm:text-[8px] font-display font-black tracking-[0.25em] uppercase -mb-0.5",
                isLegend ? "text-[#ff9100] drop-shadow-[0_0_6px_rgba(255,100,0,0.8)]" : "text-[#8b5cf6]/60",
              )}
            >
              {isLegend ? "🔥 TITAN LEGEND 🔥" : "GOLD RARE"}
            </div>

            {/* Player Arabic Name */}
            <div
              className={cn(
                "font-display font-extrabold text-[#FFE57F] tracking-wide text-center truncate w-full filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
                big ? "text-base sm:text-lg" : "text-[11px] sm:text-xs",
              )}
              style={{
                textShadow: "0 0 10px rgba(255,215,0,0.6)",
              }}
            >
              {player.nameAr}
            </div>

            {/* Player English Name */}
            <div
              className={cn(
                "font-display font-black tracking-widest text-[#FFF59D] uppercase text-center truncate w-full -mt-0.5 opacity-90",
                big ? "text-[10px] sm:text-[11px]" : "text-[7.5px] sm:text-[8.5px]",
              )}
              style={{
                letterSpacing: "0.15em",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {nameEn}
            </div>

            {/* Gold separator line with diamond accent */}
            <div className="w-full flex items-center justify-center my-1 sm:my-1.5 opacity-70">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#FFD700] to-[#FFD700]/30" />
              <div className="w-1.5 h-1.5 rotate-45 bg-[#FFD700] mx-1 shadow-[0_0_5px_#ffd700]" />
              <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#FFD700] to-[#FFD700]/30" />
            </div>

            {/* 6 Core EA FC / FIFA Attributes Grid (2 Columns x 3 Rows) */}
            <div
              className={cn(
                "w-full grid grid-cols-2 gap-x-2.5 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 font-display font-bold text-center px-1 sm:px-2",
                big ? "text-xs sm:text-sm" : "text-[9px] sm:text-[10px]",
              )}
            >
              {/* Row 1: Left PAC / Right DRI */}
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[0]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[0]}</span>
              </div>
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[1]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[1]}</span>
              </div>

              {/* Row 2: Left SHO / Right DEF */}
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[2]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[2]}</span>
              </div>
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[3]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[3]}</span>
              </div>

              {/* Row 3: Left PAS / Right PHY */}
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[4]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[4]}</span>
              </div>
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                <span className="text-[#FFE57F] font-extrabold">{stats.values[5]}</span>
                <span className="text-white/70 font-semibold tracking-wider">{stats.labels[5]}</span>
              </div>
            </div>

            {/* Bottom Sub-Footer Pill */}
            <div
              className={cn(
                "mt-1 sm:mt-1.5 font-display font-semibold text-white/50 tracking-wider uppercase text-center truncate w-full",
                big ? "text-[8px] sm:text-[9px]" : "text-[6.5px] sm:text-[7.5px]",
              )}
            >
              {player.nation} | {player.clubAr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



