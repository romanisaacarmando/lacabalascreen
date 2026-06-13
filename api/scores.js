// ================================================================
//  La Cábala Screen — api/scores.js
//  ESPN público (sin auth) — Solo partidos oficiales FIFA World Cup 2026
// ================================================================

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const SLUG = "fifa.world";

// Traducción de nombres de países al español
const ES = {
  // Américas
  "United States":       "Estados Unidos",
  "USA":                 "Estados Unidos",
  "Brazil":              "Brasil",
  "Mexico":              "México",
  "Canada":              "Canadá",
  "Peru":                "Perú",
  "Panama":              "Panamá",
  "Haiti":               "Haití",
  "Trinidad and Tobago": "Trinidad y Tobago",
  "Curacao":             "Curazao",
  "Curaçao":             "Curazao",
  // Europa
  "England":             "Inglaterra",
  "Germany":             "Alemania",
  "France":              "Francia",
  "Spain":               "España",
  "Netherlands":         "Países Bajos",
  "Holland":             "Países Bajos",
  "Switzerland":         "Suiza",
  "Scotland":            "Escocia",
  "Belgium":             "Bélgica",
  "Portugal":            "Portugal",
  "Croatia":             "Croacia",
  "Serbia":              "Serbia",
  "Poland":              "Polonia",
  "Ukraine":             "Ucrania",
  "Denmark":             "Dinamarca",
  "Sweden":              "Suecia",
  "Norway":              "Noruega",
  "Turkey":              "Turquía",
  "Türkiye":             "Turquía",
  "Turkiye":             "Turquía",
  "Slovakia":            "Eslovaquia",
  "Slovenia":            "Eslovenia",
  "Hungary":             "Hungría",
  "Czech Republic":      "República Checa",
  "Czechia":             "República Checa",
  "Albania":             "Albania",
  "Wales":               "Gales",
  "Greece":              "Grecia",
  "Romania":             "Rumania",
  "Iceland":             "Islandia",
  "Finland":             "Finlandia",
  "Ireland":             "Irlanda",
  "Northern Ireland":    "Irlanda del Norte",
  "Kosovo":              "Kosovo",
  "Cyprus":              "Chipre",
  "Andorra":             "Andorra",
  "Liechtenstein":       "Liechtenstein",
  // África
  "Morocco":             "Marruecos",
  "Senegal":             "Senegal",
  "Nigeria":             "Nigeria",
  "Ghana":               "Ghana",
  "Cameroon":            "Camerún",
  "Egypt":               "Egipto",
  "Tunisia":             "Túnez",
  "Ivory Coast":         "Costa de Marfil",
  "Côte d'Ivoire":       "Costa de Marfil",
  "Cote d'Ivoire":       "Costa de Marfil",
  "South Africa":        "Sudáfrica",
  "Algeria":             "Argelia",
  "Mali":                "Malí",
  "Congo DR":            "R.D. del Congo",
  "Congo":               "Congo",
  "Mozambique":          "Mozambique",
  "Kenya":               "Kenia",
  "Tanzania":            "Tanzania",
  "Lesotho":             "Lesoto",
  "Angola":              "Angola",
  // Asia / Oceanía
  "Japan":               "Japón",
  "Korea Republic":      "Corea del Sur",
  "South Korea":         "Corea del Sur",
  "Saudi Arabia":        "Arabia Saudita",
  "Iran":                "Irán",
  "IR Iran":             "Irán",
  "Australia":           "Australia",
  "New Zealand":         "Nueva Zelanda",
  "Qatar":               "Catar",
  "Uzbekistan":          "Uzbekistán",
  "Jordan":              "Jordania",
  "Iraq":                "Irak",
  "Syria":               "Siria",
  "Oman":                "Omán",
  "Afghanistan":         "Afganistán",
  "Pakistan":            "Pakistán",
  "China":               "China",
  "Indonesia":           "Indonesia",
  "Philippines":         "Filipinas",
};

const tradES = name => ES[name] || name;

let cache = { data: null, ts: 0 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store");

  const ahora = Date.now();
  if (cache.data && ahora - cache.ts < 60_000) {
    return res.json({ ...cache.data, cached: true });
  }

  try {
    const now = new Date();

    // Fechas en UTC: ayer (cubre ART UTC-3 tarde noche), hoy y mañana
    const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, "");
    const yesterday = fmt(new Date(now - 864e5));
    const today     = fmt(now);
    const tomorrow  = fmt(new Date(now.getTime() + 864e5));

    const [resYesterday, resToday, resTomorrow] = await Promise.allSettled([
      fetchScoreboard(yesterday),
      fetchScoreboard(today),
      fetchScoreboard(tomorrow),
    ]);

    const seen = new Set();
    const allFixtures = [
      ...(resYesterday.status === "fulfilled" ? resYesterday.value : []),
      ...(resToday.status    === "fulfilled" ? resToday.value    : []),
      ...(resTomorrow.status === "fulfilled" ? resTomorrow.value : []),
    ].filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    // Ordenar: en vivo → por empezar (cronológico) → finalizados
    const ORDER = { in: 0, pre: 1, post: 2 };
    allFixtures.sort((a, b) => {
      const s = (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9);
      return s !== 0 ? s : (a.date || "").localeCompare(b.date || "");
    });

    const liveCount = allFixtures.filter(f => f.status === "in").length;
    const result = {
      ok: true,
      fixtures: allFixtures,
      source: liveCount ? "live" : "worldcup",
      updatedAt: new Date().toISOString()
    };

    cache = { data: result, ts: ahora };
    return res.json(result);

  } catch (err) {
    console.error("Error ESPN API:", err);
    return res.status(502).json({ ok: false, error: err.message });
  }
}

async function fetchScoreboard(dateESPN) {
  const url = `${ESPN}/${SLUG}/scoreboard?dates=${dateESPN}`;
  const resp = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(5000)
  });
  if (!resp.ok) return [];

  const json = await resp.json();
  const events = json.events || [];

  return events.map(e => {
    const comp       = e.competitions?.[0];
    const home       = comp?.competitors?.find(c => c.homeAway === "home");
    const away       = comp?.competitors?.find(c => c.homeAway === "away");
    const statusType = comp?.status?.type;

    // Goleadores desde comp.details
    const homeId  = home?.team?.id;
    const scorers = { home: [], away: [] };
    for (const play of (comp?.details || [])) {
      if (!play.scoringPlay) continue;
      const isOG    = !!play.ownGoal;
      const isHome  = play.team?.id === homeId;
      const name    = play.athletesInvolved?.[0]?.shortName
                   || play.athletesInvolved?.[0]?.displayName || null;
      const min     = play.clock?.displayValue || null;
      const entry   = { name, min, og: isOG };
      const forHome = isOG ? !isHome : isHome;
      (forHome ? scorers.home : scorers.away).push(entry);
    }

    return {
      id:   e.id,
      date: comp?.date || e.date || null,
      status: statusType?.state === "in"   ? "in"   :
              statusType?.state === "post"  ? "post" : "pre",
      fixture: {
        status: {
          short:   statusType?.shortDetail || "--",
          elapsed: comp?.status?.clock ? Math.floor(comp.status.clock / 60) : null
        }
      },
      league: {
        name:  e.league?.name || "FIFA World Cup 2026",
        round: e.season?.slug || "FIFA World Cup 2026"
      },
      teams: {
        home: { name: tradES(home?.team?.displayName || "Local"),  logo: home?.team?.logo },
        away: { name: tradES(away?.team?.displayName || "Visita"), logo: away?.team?.logo }
      },
      goals: {
        home: home?.score != null ? parseInt(home.score) : null,
        away: away?.score != null ? parseInt(away.score) : null
      },
      scorers
    };
  });
}
