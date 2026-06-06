# La Cábala Screen 🇦🇷⚽

Pantalla en vivo para bares y cantinas durante el Mundial 2026.

**Producto de [Singularidad](https://singularidad.net.ar)**

## ¿Qué es?

Pantalla fullscreen para poner en la TV del bar: marcador en vivo, trivia rotante, promos del local y QR para el Prode.

## Estructura

```
/
├── public/
│   └── index.html        ← pantalla del bar (se sirve en /)
├── api/
│   └── scores.js         ← proxy de scores (ESPN sin key o API-Football)
└── vercel.json
```

## Config rápida por bar

Editá el objeto `CONFIG` al inicio del `index.html`:

```js
const CONFIG = {
  bar: {
    inicial:  "R",                          // letra del logo
    nombre:   "EL RINCÓN",                  // nombre del bar
    tagline:  "Bar & Parrilla · Carlos Paz"
  },
  prodeURL:   "https://prode.tudominio.ar/elrincon",
  prodePremio: "🏆 El ganador se lleva una picada",
  promos: [
    { emoji:"🍺", titulo:"Birra + Pizza", sub:"Pinta + muzza", precio:"$6.900" },
    // ...
  ],
  // ...
};
```

## Deploy

1. Fork o cloná este repo
2. Conectalo a Vercel (import desde GitHub)
3. **Opcional:** agregá la variable de entorno `API_FOOTBALL_KEY` para datos premium
4. El proxy ESPN funciona sin variables de entorno

## API de scores

- **`api/scores.js` (ESPN):** gratis, sin key, funciona ya mismo.
- **`api-scores.js` (API-Football):** requiere `API_FOOTBALL_KEY` en variables de entorno Vercel. Más confiable para producción.

## Contacto

📱 +54 9 3541 62-3335  
🌐 singularidad.net.ar
