# Cuestionario web de KipZone — primera versión

Ruta prevista: `/plan/`. HTML, CSS y módulos JavaScript, sin dependencias ni
servicios de formularios de pago. No se añade enlace desde la portada existente.

## Alcance

- Portada vertical, identidad negra/blanca/lima, wordmark existente y referencia
  visual adjuntada por el propietario, conservada en `assets/runner-brand.webp`.
- Una pregunta o bloque semanal por pantalla; navegación hacia atrás, progreso,
  revisión y edición. Diseño adaptable, incluyendo pantallas pequeñas con scroll.
- Objetivo, experiencia, confirmaciones, carga actual, disponibilidad futura,
  preferencias, horizonte, carrera opcional, una referencia opcional y cuatro
  semanas completas fechadas. Las fechas se manejan como días civiles locales.
- Rutas cortas para casos que el alcance inicial no admite. No se cobra.
- Resultado preliminar, descarga explícita de respuestas JSON y enlace al bloque
  de descarga ya existente en la web. No se promete importar el JSON en la app.

No hay creación de cuenta, escritura en Firestore, generación de sesiones, pago,
sincronización con KipZone ni medición de conversiones. El sitio no realiza
peticiones de respuestas, no incluye Pixel y no coloca datos en URLs. Sus recursos
se cargan desde el propio sitio. La ruta lleva `noindex` mientras se revisa.

## Persistencia y privacidad

Las respuestas viven en memoria salvo consentimiento explícito para conservarlas
en este navegador. El guardado local caduca a los siete días desde la última
edición; no es una copia en la cuenta. Incluye información declarada de salud y
entrenamiento, anunciado junto al consentimiento. La versión/esquema, fechas,
tipos básicos y caducidad se comprueban al recuperar. Borrar no afecta otros datos
de la web. El archivo descargado puede contener estas mismas respuestas.

Sin consentimiento, recargar pierde el borrador. Volver y avanzar dentro del
cuestionario conserva el borrador en memoria. Cambiar una respuesta puede invalidar
otras y la revisión lo señala. Quitar una carrera o marca elimina sus datos ocultos.
Cambiar disponibilidad retira una preferencia de día largo incompatible.

## Contrato de integración preparado, todavía sin consumidor

`toHandoff()` produce un borrador versionado, no un `WeeklyInput` directamente
aceptable ni una autorización de pago. Incluye:

| Dato web | Correspondencia prevista en la app |
| --- | --- |
| `configuration` | Campos de `GoalConfiguration`; sin referencias/IDs inventados |
| `availability` | `availableMinutes`, `dayLimitMinutes` de `WeeklyInput` |
| `confirmations` | `adult`, `noSymptoms`, `noPain` |
| `interruptionDays` | Interrupción actual, en días |
| `history` | Cuatro `HistoryWeek` con estado y magnitudes declaradas |
| `recentRace` | Una `RecentRace` declarada; no un tiempo objetivo |

El objetivo web adicional `startRunning` no tiene enum equivalente: se exporta
como `null` en configuración y su resultado es fuera de alcance. No se degrada
silenciosamente a un programa soportado. Los datos opcionales ausentes son `null`.

Para integrarlo habrá que verificar el esquema y todas las respuestas en un
servicio confiable, asociar el borrador a la cuenta verificada, construir la semana
futura y las referencias reales de intensidad, invocar el motor existente y
conservar una identidad estable para reintentos. Una redirección a la tienda no
transporta estas respuestas. No aceptar el resultado del navegador como elegibilidad
final ni modificar `users.plan` desde el cliente.

## Comprobaciones preliminares, no segundo motor

`assessDraft()` distingue incompleto, historial desactualizado, fuera de alcance
inicial y listo para revisión del generador. Comprueba solo algunos requisitos
necesarios: objetivo/experiencia, confirmaciones, integridad del formulario,
cuatro semanas conocidas, medianas 240–360 minutos/≥3 días, interrupción de dos
semanas, variación del historial y posibilidad preliminar de al menos tres salidas.

No calcula dosis, horarios, reducciones, ritmos ni compatibilidad deportiva final.
No comprueba todas las reglas del motor (distribución, presupuesto mínimo tras
reducciones, continuidad, contradicciones de interrupción o separación entre días
de calidad, por ejemplo). La UI lo comunica como resultado inicial pendiente de
validación. `requiresEngineValidation: true` y `planGenerated: false` siempre.

Fuente de correspondencia: `kipzone-app`, rama `feat/zona-dorada-mvp`, archivos
`training/model.dart`, `training/weekly_engine.dart`, `domain.dart` y
`race_estimate.dart`, revisados el 27 de octubre de 2026. Antes de conectar hay que
fijar una revisión concreta del contrato y volver a contrastarla. No se modificó
el motor ni se activó la política Dev desde esta web.

## Procedencia del recorrido

La secuencia, la redacción, los iconos, el diseño y las rutas tempranas son
decisiones propias de KipZone. No es una reproducción del orden de Runna.
La fase 13 del análisis estático orienta la separación de objetivo, carga habitual,
disponibilidad, referencia actual y revisión. No se mezclan V1, V2 y Foundation
ni se atribuye a Runna el historial detallado de cuatro semanas.

El historial, las confirmaciones actuales, el presupuesto de minutos y la fecha
de la carrera realizada son adaptaciones para los contratos propios de KipZone.
No hay referencias de rendimiento precargadas ni mejoras físicas prometidas.

## Comprobaciones

```bash
node --check plan/app.mjs
node --check plan/questionnaire.mjs
node --test plan/questionnaire.test.mjs
git diff --check
```

Probar además en un teléfono real y dentro del navegador de Facebook/Instagram
antes de pautar anuncios: teclado, selector de fechas, scroll, descarga de JSON,
regreso al anuncio y apertura de tiendas. Una previsualización de navegador no
acredita esos comportamientos nativos. Una pantalla web vertical no es un archivo
de video publicable en Stories/Reels; los anuncios se preparan por separado.
