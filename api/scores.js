// ================================================================
//  La Cábala Screen — api/scores.js (versión ESPN — SIN KEY, GRATIS)
//
//  Usá este archivo si todavía no tenés la key de API-Football.
//  ESPN tiene un endpoint público no oficial que no requiere auth.
//
//  ⚠️  No apto para producción a largo plazo (endpoint no oficial),
//      pero perfecto para testear y para el período del Mundial.
//
//  Cuando tengas la key de API-Football, reemplazá con api-scores.js
// ================================================================

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Slugs de ligas de selecciones en ESPN
// Los primeros son los más probables para amistosos y torneos
const SLUGS = [
  "fifa.friendly",       // Amistosos FIFA
  "int.friendlies",      // Variante del slug
  "conmebol.worldq",     // Eliminatorias Conmebol
  "fifa.worldq",         // Eliminatorias mundiales (genérico)
];

let cache = { data: null, ts: 0 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store");

  const ahora = Date.now();
  if (cache.data && ahora - cache.ts < 60_000) {
    return res.json({ ...cache.data, cached: true });
  }

  try {
    // Buscar en todos los slugs en paralelo
    const results = await Promise.allSettled(
      SLUGS.map(slug => fetchScoreboard(slug))
    );

    // Juntar todos los partidos encontrados, eliminar duplicados por ID
    // y descartar partidos que no sean de hoy (ESPN a veces devuelve fixtures históricos)
    const now = new Date();
    const todayStr     = now.toISOString().slice(0, 10);
    const yesterdayStr = new Date(now - 864e5).toISOString().slice(0, 10);
    const seen = new Set();
    const allFixtures = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value)
      .filter(f => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        // Solo partidos de hoy o ayer (cubre desfase horario Argentina UTC-3)
        if (f.date && !f.date.startsWith(todayStr) && !f.date.startsWith(yesterdayStr)) return false;
        return true;
      });

    // Filtrar solo partidos en vivo o de hoy
    const live    = allFixtures.filter(f => f.status === "in");
    const today   = allFixtures.filter(f => f.status !== "in");
    const fixtures = live.length ? live : today;

    const result = {
      ok: true,
      fixtures,
      source: live.length ? "live" : "today",
      updatedAt: new Date().toISOString()
    };

    cache = { data: result, ts: ahora };
    return res.json(result);

  } catch (err) {
    console.error("Error ESPN API:", err);
    return res.status(502).json({ ok: false, error: err.message });
  }
}

// ── Fetch scoreboard de un slug + transformar al formato de API-Football ────
async function fetchScoreboard(slug) {
  const url = `${ESPN}/${slug}/scoreboard`;
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

    // Extraer goleadores de comp.details (ESPN usa "details", no "scoringPlays")
    const homeId = home?.team?.id;
    const scorers = { home: [], away: [] };
    for (const play of (comp?.details || [])) {
      if (!play.scoringPlay) continue;           // solo goles, no tarjetas
      const isOG  = !!play.ownGoal;
      const isHome = play.team?.id === homeId;
      const playerName = play.athletesInvolved?.[0]?.shortName
        || play.athletesInvolved?.[0]?.displayName || null;
      const min = play.clock?.displayValue || null;  // ya viene como "28'"
      const entry = { name: playerName, min, og: isOG };
      // Un gol en propia puerta cuenta para el equipo contrario
      const forHome = isOG ? !isHome : isHome;
      (forHome ? scorers.home : scorers.away).push(entry);
    }

    return {
      id: e.id,
      date: comp?.date || e.date || null,   // "YYYY-MM-DDTHH:mm:ssZ"
      status: statusType?.state === "in"  ? "in"   :
              statusType?.state === "post" ? "post" : "pre",
      fixture: {
        status: {
          short:   statusType?.shortDetail || "--",
          elapsed: comp?.status?.clock ? Math.floor((comp.status.clock) / 60) : null
        }
      },
      league: {
        name:  e.league?.name || "Amistoso Internacional",
        round: e.season?.slug || "Amistoso Internacional"
      },
      teams: {
        home: { name: home?.team?.displayName || "Local",  logo: home?.team?.logo },
        away: { name: away?.team?.displayName || "Visita", logo: away?.team?.logo }
      },
      goals: {
        home: home?.score != null ? parseInt(home.score) : null,
        away: away?.score != null ? parseInt(away.score) : null
      },
      scorers
    };
  });
}
