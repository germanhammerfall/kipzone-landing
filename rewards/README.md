# KipZone Rewards — centro de mando

Sección estática aislada, sin frameworks ni nuevas dependencias. No requiere build.
Las páginas existentes, Firebase, eventos, entradas y configuración de Cloudflare
no se han editado. Esta entrega publica únicamente la sección Rewards aprobada.
Los puntos y el flujo de wallet siguen siendo una demo, sin transferencias reales.

## Archivos y rutas

- `index.html`: `/rewards/`, centro de mando demo con una frase introductoria,
  saldo, estadísticas, actividad, recompensas y wallet. Navegación por vistas:
  Overview, Actividad, Rewards y Wallet; soporta enlaces y atrás/adelante.
- `dashboard/index.html`: `/rewards/dashboard/`, acceso visual; con `?demo=1`,
  redirige al centro de mando actual en `/rewards/` para mantener los enlaces.
- `style.css`: estilos propios, responsive y movimiento reducido.
- `script.js`: datos demo, renderers de cards reutilizados en ambas páginas,
  navegación, animación ligera y diálogo de reclamo.
- `territory.svg`: polígono territorial con recorrido, bandera y marcador.
- `icons.svg`: iconos vectoriales compartidos de navegación y estadísticas.
- `assets/scroll-reference.mp4`: video proporcionado por el usuario, 1080 × 1920,
  10,048 segundos, aproximadamente 1,17 MB. Se conserva sin recomprimir.
- `assets/scroll-poster.jpg`: imagen estática de respaldo del mismo video.
- `assets/territory-city.webp`: territorio urbano generado con ImageGen a partir
  de las referencias del usuario. 720 × 540, transparencia, aproximadamente
  158 KB; el PNG maestro y el prompt se conservan en `assets/`.

El wordmark oficial se reutiliza sin copiarlo. La vista principal ya no contiene
hero de marketing, pasos, slogans repetidos, teléfono ni CTA de cierre.
La tarjeta de puntos incorpora el video proporcionado: el scroll avanza o
retrocede su posición temporal. No utiliza autoplay, sonido ni un loop.
La ruta termina de formarse antes de que la tarjeta salga de pantalla en móvil.
No hay barra ni controles visibles. Al enfocar el mapa, las flechas permiten
avanzar/retroceder; Home y End van al inicio y final del recorrido.
Con movimiento reducido, solo los cambios explícitos por teclado animan
el recorrido. En pantallas sin scroll, la rueda sobre el mapa permite explorarlo.
Los listeners y las búsquedas de frames se limpian al cambiar de estado demo.
Se revisó también `assets/app-screen-1.png` (2,48 MB). El teléfono usa el recurso
existente `organizadores/assets/hero-territory-screen.jpeg` (81 KB) como
poster/fallback si se vuelve a incorporar la ayuda visual. No carga el video
de fondo de 22 MB. El video territorial existente pesa aproximadamente 566 KB.

El selector de zonas de Rewards contiene Corredores, Organizadores y Rewards.
Agregar un enlace a Rewards en los otros headers puede hacerse después de la
revisión; en esta entrega no se modifican esas páginas.

## Datos y estados demo

`MOCK_REWARDS_DATA` en `script.js` contiene todos los saldos, estadísticas,
actividades, fechas, nombre, puntos del ejemplo de corrida y dirección abreviada.
Los puntos no se interpretan como dinero, tokens ni una regla de conversión.
`rewardsDataAdapter.getDemoData()` es la frontera para sustituir el origen de datos.
Los renderers escapan textos antes de insertarlos en HTML.

En el dashboard demo, “Probar estados de la demo” permite cambiar entre:

- puntos disponibles, saldo vacío, carga y error de sincronización;
- wallet no conectada, conectada, confirmación y éxito simulado.

Todos los estados de wallet están rotulados como demo. No hay proveedor real,
transacción, explorador, descuentos de puntos, almacenamiento persistente,
peticiones de secretos ni transferencias. “Ver transacción · ejemplo” explica
que no existe una transacción. Recargar restablece los ejemplos.

## Firebase: preparación, sin integración activa

Se revisó `organizadores/firebase-client.js` y el login de
`organizadores/perfil/dashboard.js`. El sitio ya dispone de `getFirebase()`,
`signInWithGoogle()`, correo/contraseña y `onAuthStateChanged` en el proyecto
Firebase existente. No se creó un sistema alternativo de usuarios.

Para activar Rewards con datos reales:

1. Reutilizar ese módulo y sus proveedores de autenticación, observando la sesión
   existente; reemplazar el acceso visual por el flujo real y sus errores.
2. Definir con backend un contrato de lectura de puntos sincronizados desde la
   app, historial y elegibilidad, ligado a la identidad Firebase verificada.
3. Sustituir el adapter demo, distinguir carga/error/vacío real y nunca mostrar
   un saldo mock como si perteneciera a una cuenta autenticada.
4. Revisar permisos mínimos y reglas actuales antes de proponer cambios.
   No se han inventado endpoints, colecciones ni escrituras en Firestore.

## Solana: preparación, sin blockchain activa

El flujo de interfaz es independiente del proveedor y existe solo en la web.
Para activarlo se requiere un adapter de wallets compatibles con Solana,
verificación de propiedad de la wallet y un servicio de claims autorizado por
el backend. El servidor debe validar identidad, elegibilidad, disponibilidad,
consumo atómico de puntos y protección ante reintentos o reclamos duplicados.
Nunca confiar en saldos enviados por el navegador. Las reglas económicas, mint,
red, comisiones y disponibilidad deben definirse antes de implementar reclamos.
Ninguna de estas decisiones se ha supuesto ni implementado en esta demo.

## Revisión local

Desde la raíz del repositorio:

```powershell
node ../rewards-preview.cjs
```

Abrir `http://127.0.0.1:4173/rewards/` y
`http://127.0.0.1:4173/rewards/dashboard/?demo=1`.

La vista previa de esta sesión usa el servidor Node ubicado junto al checkout,
con soporte HTTP Range para consultar posiciones de MP4. El servidor simple de
Python no entrega rangos y puede impedir el seeking. En hosting, comprobar
respuestas 206 y `Content-Range` para el video antes de publicar.

Validación realizada con Playwright + Edge headless:

- 375, 430, 768, 1024 y 1440 px para las tres vistas (15 comprobaciones).
- Sin desbordamiento horizontal ni errores JavaScript.
- Menú móvil y Escape, actividad expandible, acceso visual y restauración de foco.
- Flujo completo de wallet demo y saldo sin cambios tras confirmar.
- Estados de puntos vacío/carga/error, reintentos y selector de wallet.
- Movimiento reducido: scroll sin animación automática del video.
- Video: avance/retroceso reales, teclado sin barra, final visible en móvil y rueda en
  pantallas altas. Todas las comprobaciones pasaron en Edge headless.
- Capturas revisadas para desktop y móvil.

Comprobación de sintaxis: `node --check rewards/script.js`.
HTML, referencias locales y formato de cambios también se verifican en la revisión.

### Particularidad del checkout Windows

El repositorio remoto contiene pares de rutas que difieren solo por mayúsculas:
`politicaDePrivacidad/` y `politicadeprivacidad/`, y `terminosyCondiciones/` y
`terminosycondiciones/`. Git avisó del choque al clonar en Windows y mostró dos
archivos modificados desde ese momento. No son cambios de Rewards y no deben
incluirse en su entrega. Resolver esas rutas requiere una decisión separada.
