# Cuestionario KipZone — maqueta funcional, versión 2

Ruta `/plan/`, rama `feat/cuestionario-plan-web`, PR #19.

Esta entrega se concentra en pantallas, preguntas, botones y navegación.
No conecta Firebase, no define sus campos, no genera un plan, no evalúa
compatibilidad deportiva, no cobra ni ofrece resultados físicos.

## Diseño

- Híbrido: portada/cierre negros con fotografía; preguntas claras sobre blanco cálido.
- Amarillo lima `#d4f500`, negro `#0a0d09`, blanco cálido `#f4f5ef`.
- Corredora y corredor anónimos, de espaldas, con presencia equivalente.
- Preguntas breves; tres pausas editoriales separadas de los formularios.
- Botones grandes, selección única/múltiple, números con accesos rápidos,
  fechas, tiempo, campo de nombre opcional y revisión editable.
- Formato móvil vertical, con scroll cuando hace falta y adaptación a pantallas cortas.

`assets/runners-anonymous-v2.webp` procede de una imagen generada para esta
interfaz con la herramienta integrada de generación de imágenes. Se optimizó
su codificación para la web; el original se conserva fuera del repositorio.
Prompt: fotografía deportiva vertical 9:16, una mujer y un hombre corredores
recreativos, vistos de espaldas sin caras identificables, ropa negra con detalles
lima, parque urbano al anochecer, espacio superior oscuro para tipografía,
reflejos discretos de ruta en el suelo, sin texto/logos/celebridades.

## Recorridos

`stepsFor()` separa dos familias de interfaz:

- Corredor habitual: objetivo/distancia cuando corresponde, evento opcional,
  unidades, nivel declarado, una referencia actual opcional, volumen actual,
  disponibilidad, preferencia de día largo e inicio/horizonte.
- Iniciación/regreso (inspiración Foundation): actividad y frecuencia inicial,
  meses sin correr en regreso, disponibilidad e inicio/horizonte. No pide marca.

Si hay carrera elegida, su fecha se conserva como tal. Sin carrera elegida se
pregunta duración del programa. Al cambiar respuestas se retiran datos de ramas
ocultas; editar disponibilidad revisa la preferencia de día largo.

La fase 13 del análisis estático Runna 8.57.0 respalda los tipos de datos,
la navegación condicional y disponibilidad suficiente. No acredita el orden exacto,
texto español, todas las opciones ni límites de estos selectores. Los títulos,
orden, opciones y rangos concretos de esta maqueta son propuestas de KipZone.
No se mezclan V1, V2 y Foundation como una única secuencia comprobada, ni se
presenta el cálculo deportivo de Runna como recuperado.

Respecto a la versión anterior se retiran del recorrido los filtros del motor Dev,
las confirmaciones universales de salud/edad, el historial de cuatro semanas,
la disponibilidad por minutos, la exportación JSON y la evaluación de compatibilidad.
Se podrán definir los datos adicionales al conectar con la app, por indicación
del propietario. Los objetivos de principiantes, constancia y retorno se pueden
recorrer completos en la maqueta aunque no tengan generador deportivo disponible.

## Mensajes intermedios aprobados

Se añaden tres pausas; no cambian preguntas, opciones ni orden relativo:

| Después de | Mensaje | Objetivo |
| --- | --- | --- |
| Objetivo | Récords. Medallas. | Contexto deportivo noruego, con logros fechados y fuentes |
| Nivel o actividad inicial | Revoluciona tu forma de entrenar. | Intensidad, umbral y recuperación |
| Disponibilidad semanal | Tu tiempo. Tu potencial. | Enfoque recreativo, nivel/metas/agenda |

El número de preguntas y el progreso no cuentan las pausas como respuestas.
Las pausas no escriben campos, no solicitan datos y no aparecen en la revisión.
Volver/continuar recorren la misma secuencia. Editar una respuesta desde la revisión
regresa al resumen, sin obligar a volver a ver el mensaje promocional.

`EDITORIAL_SCREENS` permite inserciones por `after` de una pregunta o una lista de
alternativas. La pausa de principios aparece una sola vez: tras `experience` o
`exerciseLevel`, según la rama. Se mantienen corredores anónimos de ambos géneros.

### Criterio de copy y fuentes

Fuente de tono: los tres flyers proporcionados por el propietario. Se retoman
aprovechar el tiempo, intensidad controlada, potencial y adaptación personal.
No se copian garantías de ausencia de lesiones, resultados en tres meses o
récord personal asegurado. «Revoluciona» es una invitación editorial, no el
resultado de un ensayo comparativo ni un aval clínico.

- World Athletics: perfil de Jakob Ingebrigtsen, récord de 3000 m logrado en 2024,
  y oros olímpicos en 1500 y 5000 m. Son logros del atleta, no resultados de
  usuarios de KipZone ni prueba de causalidad exclusiva de un método:
  https://worldathletics.org/athletes/_/14653717
  https://worldathletics.org/results/olympic-games/2024/the-xxxiii-olympic-games-7153115/men/5000-metres/final/result
- Casado et al. (2023), descripción del modelo de intervalos guiados por lactato
  y su utilización en corredores de élite, incluidos los Ingebrigtsen:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10000870/
- Marius Bakken, historia y principios del modelo; fuente del autor, de carácter
  descriptivo/empírico, no una garantía individual:
  https://www.mariusbakken.com/the-norwegian-model.html
- Entrevista a Bakken en The Extramilest Show #139 (13 de octubre de 2026):
  adaptación a corredores recreativos y equilibrio entre entrenamiento y vida diaria:
  https://extramilest.com/blog/the-norwegian-method-for-runners-the-extramilest-show-139/

Revisión de fuentes: 27 de octubre de 2026. No se encontró un conteo verificable
para afirmar que «miles de personas lo están probando», ni un conteo de clientes
KipZone. No se añade esa cifra ni testimonios inventados. Las fuentes quedan
disponibles bajo «Ver fuentes», sin párrafos largos en las pantallas.

## Datos locales

Respuestas en memoria; guardar siete días en el navegador es opcional.
Esquema local 2, independiente de Firestore. No migra automáticamente el
borrador de la versión 1: son cuestionarios distintos. No hay llamadas de red
para enviar respuestas, Pixel ni autenticación. El cierre confirma las respuestas,
no la creación de un plan. El resumen de revisión solo contiene pasos activos.

## Validación

```bash
node --check plan/app.mjs
node --check plan/questionnaire.mjs
node --test plan/questionnaire.test.mjs
git diff --check
```

Falta contrastar orden y redacción con capturas originales de Runna y probar
navegadores nativos de Facebook/Instagram antes de lanzar campañas. La web es
el destino del anuncio; sus pantallas no sustituyen los archivos creativos de
Stories/Reels.

## Galería completa de pantallas

- `/plan/`: encuesta funcional, sin respuestas precargadas.
- `/plan/pantallas.html`: catálogo de siete recorridos, con cada pregunta,
  las tres pausas, bienvenida, revisión y cierre. Selector por ruta y enlaces
  individuales para revisión. No es una landing para enviar publicidad.
- `/plan/preview.html?scenario=race&screen=goal`: muestra una pantalla real
  con datos de ejemplo. La vista de revisión no lee, borra ni guarda el borrador
  del usuario. Los ejemplos se cargan únicamente cuando el HTML declara
  `data-preview="true"`; el cuestionario público no interpreta estos parámetros.

Los siete ejemplos cubren carrera con evento, sin evento, distancia personalizada,
mejora, constancia, iniciación y regreso. Las alternativas de selección permanecen
visibles en cada pantalla; no se crean pantallas ficticias para respuestas que no
cambian de paso. La fecha de ejemplo se calcula al abrir para evitar ejemplos caducados.

## Pendiente para un MVP conectado

La interfaz está completa dentro del alcance aprobado. Para recibir usuarios reales
que terminen con su plan en la app se necesita definir e implementar:

1. Colección/campos Firebase y contrato del generador; distinguir respuestas del
   cuestionario de los datos adicionales requeridos por el motor deportivo.
2. Identidad y traspaso: login o vínculo seguro entre borrador web y cuenta de la app,
   evitando pedir respuestas dos veces. Nunca pasar respuestas personales por la URL.
3. Acción final: descarga de app, registro o pago; enlaces reales por plataforma,
   y qué ocurre cuando la app ya está instalada.
4. Publicación de `/plan/` en el dominio existente, reglas/validación de servidor,
   permisos de datos y prueba de extremo a extremo en Facebook/Instagram Android/iOS.
5. Si se medirán campañas: identificador y eventos aprobados de Meta, consentimiento
   cuando corresponda; no incluir respuestas ni datos deportivos en eventos publicitarios.

Ninguna de estas integraciones se simula como si ya funcionara. No hace falta
contratar un constructor de encuestas para utilizar este código; hosting y servicios
conectados dependen del uso y de las cuentas existentes.
