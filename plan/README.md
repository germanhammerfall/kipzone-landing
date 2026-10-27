# Cuestionario KipZone — maqueta funcional, versión 2

Ruta `/plan/`, rama `feat/cuestionario-plan-web`, PR #19.

Esta entrega se concentra en pantallas, preguntas, botones y navegación.
No conecta Firebase, no define sus campos, no genera un plan, no evalúa
compatibilidad deportiva, no cobra ni ofrece resultados físicos.

## Diseño

- Híbrido: portada/cierre negros con fotografía; preguntas claras sobre blanco cálido.
- Amarillo lima `#d4f500`, negro `#0a0d09`, blanco cálido `#f4f5ef`.
- Corredora y corredor anónimos, de espaldas, con presencia equivalente.
- Preguntas breves, sin párrafos promocionales entre pantallas.
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

## Mensajes intermedios futuros

`EDITORIAL_SCREENS` está vacío. Acepta pantallas `{id, after, title, body}` cuando
el propietario elija la redacción y el punto de inserción. El renderizador y la
navegación están preparados; no se añadieron testimonios, cifras ni promesas.
Las láminas nuevas aportadas por el propietario son contexto para esa futura
redacción, no pantallas ya incorporadas ni pruebas de resultados.

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
