# KipZone Landing

Sitio estático publicado en `kipzone.run` y servido por Cloudflare.

## Rutas para organizadores

- `/organizadores/`: portada y próximos eventos cargados mediante `publicEventsFeed`.
- `/eventos/detalle/?id=...`: ficha pública de un evento.
- `/eventos/inscripcion/?id=...`: acceso compatible a la inscripción web.
- `/organizadores/perfil/`: inicio de sesión y listado de eventos propios.
- `/organizadores/crear/`: creación de eventos en `run_events`.
- `/organizadores/editar/?id=...`: edición del documento original del evento.

Las páginas privadas usan Firebase Authentication y las reglas de Firestore para validar al propietario. La edición nunca reemplaza `ownerUid`, `creatorUid`, `uid`, `userRef`, participantes ni datos territoriales.

## Comprobaciones antes de publicar

```bash
node --check organizadores/firebase-client.js
node --check organizadores/firebase-events.js
node --check organizadores/perfil/dashboard.js
node --check organizadores/crear/create.js
node --check organizadores/editar/edit.js
node --check eventos/detalle/event-detail.js
git diff --check
```
