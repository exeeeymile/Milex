# Exe & Mile — Milex: Juntos 💞

Plataformero cooperativo en 3D para **dos jugadores online**, hecho para jugar en pareja.
Cada uno controla a un personaje con habilidades distintas y ninguno puede terminar el nivel solo.

## Personajes

| Exe | Mile |
| --- | --- |
| Doble salto | Doble salto |
| **Golpe de suelo** (Ctrl / clic derecho en el aire): rompe cajas agrietadas y dispara la catapulta | **Planeo** (mantener Espacio después del doble salto) con su hoja-paraguas |
| | Las corrientes de aire del ventilador la elevan |

## El nivel: "El Gran Jardín"

1. **El Patio** – tutorial sobre una mesa de jardín.
2. **La Puerta de Libros** – uno pisa la tapita para abrir la puerta al otro, y después al revés.
3. **La Catapulta** – Mile se sube a la cuchara, Exe golpea el mango y la lanza a la cornisa; ella activa el ascensor para Exe.
4. **El Pasillo de Cajas** – solo el golpe de Exe rompe las cajas agrietadas.
5. **El Abismo del Ventilador** – Mile planea sobre el viento y extiende el puente de lápiz para Exe.
6. **El Tocadiscos** – gomas móviles y un disco que gira con un brazo que barre.
7. **El Corazón del Jardín** – pisen las dos tapitas al mismo tiempo, la flor se abre y entran juntos al corazón.

Hay 15 botones dorados escondidos. Con **F** se abrazan, con **1** saludan y con **2** bailan.

## Controles

| Tecla | Acción |
| --- | --- |
| W A S D | moverse (relativo a la cámara) |
| Mouse | cámara (hacé clic en el juego para capturar el mouse) |
| Espacio | saltar / doble salto (mantener: planear, Mile) |
| Shift | correr |
| Ctrl o clic derecho | golpe de suelo (Exe, en el aire) |
| E | usar palanca |
| F / 1 / 2 | abrazo / saludo / baile |
| R | volver al último punto de control |
| M | música on/off |
| Esc | pausa |

También funciona con joystick (A saltar, B golpe, X usar, Y abrazo, RB correr).

## Jugar en tu compu (misma red)

```bash
npm install
npm start
```

Abrí `http://localhost:3000`. Desde la otra compu de la misma red WiFi entrá a `http://IP-DE-TU-COMPU:3000`.

## Publicarlo para jugar desde cualquier lado (gratis)

El servidor es Node.js con WebSockets, así que funciona en cualquier hosting de Node. Con **Render**:

1. Entrá a <https://render.com> y conectá tu cuenta de GitHub.
2. *New → Blueprint* y elegí este repositorio (usa el `render.yaml` incluido).
3. Cuando termine, abrí la URL que te da (algo como `https://milex-juntos.onrender.com`).

Una persona toca **Crear sala**, le pasa el código de 4 letras (o el link de invitación) a la otra, que toca **Unirme**, y el anfitrión toca **¡Empezar aventura!**.
Si alguien se desconecta, puede volver a entrar con el mismo código y retoma donde está su compañero.

> En el plan gratuito de Render el servidor "se duerme" tras un rato sin uso: la primera carga puede tardar ~30 segundos.

## Estructura

- `server.js` – servidor HTTP + WebSocket: salas con código, retransmisión de posiciones y estado compartido del nivel.
- `public/js/character.js` – modelos de Exe y Mile y su animación procedural.
- `public/js/player.js` – física, colisiones y habilidades; interpolación del compañero online.
- `public/js/world.js` – el nivel, los puzzles y la decoración animada.
- `public/js/main.js` – menú, lobby, cámara, HUD y bucle del juego.
- `public/js/effects.js`, `audio.js`, `textures.js` – partículas, sonidos/música sintetizados y texturas generadas.
