# AutoInsight MVP — Guion de prueba guerrilla y demo

App: https://autoinsight-team2-nine.vercel.app (staging). Usuarios de demo: todos con PIN **1234**
(Ana Ríos, Beto Cruz, Caro Díaz, Diego Mora y Eli Vega en Línea 3; Fer Luna en Línea 1; Gabi Paz en Línea 2).
La clave del back office se pide en privado.

## Qué queremos validar

**Insight:** los jefes de planta, ingenieros de calidad y de garantías necesitan interpretar métricas y
alertas de un vistazo, pero usan un dashboard pensado para oficina. En el piso, los reflejos, los guantes y
la poca atención disponible hacen difícil detectar desviaciones a tiempo.

| Evidencia | Qué dice | Cómo la ponemos a prueba |
| --- | --- | --- |
| F1 | Sesiones en tablet de 1,4 min contra 12 min en escritorio | ¿Se completa la tarea en una sesión corta con la vista de planta? |
| E4 | "En el piso traigo guantes y hay reflejos. Esos filtros chiquitos ahí no se pueden usar." | Prueba con guantes y con luz fuerte, Planta contra Oficina |
| F3.3 | Vista de piso: pantalla grande, 3 indicadores, cero filtros | ¿Responde solo con las 3 tarjetas y la alerta de arriba? |

**Criterios de éxito (definirlos ANTES de la primera sesión):**
- Al menos el 80 % responde bien "¿Cómo está tu línea?" en menos de 5 s en Planta.
- Al menos el 80 % atiende la alerta más grave sin ayuda.
- En Oficina, con guantes, tardan claramente más o se equivocan más que en Planta.
- Al menos la mitad nota la franja de alertas nuevas sin ayuda después de un cambio de turno.

La demo NO valida el uso real a lo largo del tiempo (Planta Sur sin sesiones en 5 de 12 semanas, 23 días
entre el defecto y su detección, 340 alertas por semana): eso necesita un piloto de varias semanas.

---

## A. Sesión con un participante (~15–20 min)

### Preparación del facilitador

1. Back office → **"Nuevo participante"** (reinicia la demo y pasa a P1, P2…).
2. Aplicar el escenario **"Línea 3 en PARAR con 1 ALTA"**.
3. Tablet en `/planta` sin sesión. Participante **con guantes**, junto a una ventana o una lámpara.
4. Laptop con `/oficina` y las notificaciones activadas (para la parte de oficina).
5. Cronómetro y hoja de notas.

**Reglas:** no explicar la interfaz, no ayudar, pedir que piense en voz alta, anotar tiempos, dudas y
toques fallidos. Si pregunta "¿qué hago?", devolver: "¿Qué harías tú?".

### Contexto (2 min, antes de mostrar nada)

- ¿Cuál es tu rol y en qué línea o área trabajas?
- ¿Cuántas veces por turno revisas cómo está la línea? ¿Dónde: en el piso o en el escritorio?
- ¿Qué usas hoy para eso (dashboard, planillas, radio, WhatsApp, recorrido)?
- ¿Qué es lo que más te cuesta de la herramienta actual?
- La última vez que hubo un problema de calidad, ¿cómo te enteraste y cuánto tardaste?

### Tareas

| # | Pedido | Qué observar | Evidencia |
| --- | --- | --- | --- |
| 1 | "Entra como Ana Ríos" (PIN 1234) | ¿Puede con guantes? ¿Toques fallidos? | E4 |
| 2 | Mira la pantalla 5 s y la tapas: "¿Cómo está tu línea? ¿Qué harías primero?" | Respuesta correcta y segundos (cronómetro) | F1, F3.3 |
| 3 | "Atiende la alerta más grave" | Embudo y tiempos en PostHog | F1 |
| 4 | Sin avisar, "Simular turno" en Línea 3. "Sigue con lo tuyo." Después: "¿Qué cambió?" | ¿Nota la franja de alertas nuevas sola? | Vistazo |
| 5 | Escenario "Muchas alertas MEDIA": "¿Cuál atenderías primero? ¿Hay más?" | ¿Entiende "+N alertas menos graves"? | F3.3 |
| 6 | Misma tablet con guantes, `/oficina`: "¿Cómo está la Línea 3?" | ¿Tarda más o se equivoca más? | F1, E4 |
| 7 | Rol oficina, laptop: facilitador hace "Disparar push". "¿Qué harías con esto?" | ¿Abre la investigación? ¿Usa la campanita? | Vista por contexto |
| 8 | Abrir el reporte en Mailinator: "¿Te sirve al cierre del turno?" | Valor del correo | |

### Cierre (3 min)

- Del 1 al 7, ¿qué tan fácil fue saber cómo estaba la línea?
- ¿Qué te costó con los guantes o la luz?
- ¿Lo usarías en el piso en vez de lo que usas hoy? ¿Por qué sí o por qué no?
- ¿Confiarías en esta alerta para detener la línea?
- Si pudieras sacar una cosa y agregar una, ¿cuáles serían?

---

## B. Banco de preguntas por área

Elegir 2 o 3 por área según el rol del participante. Preguntar por lo que hizo, no por opiniones en abstracto.

### Planta (tablet)

- Sin mirar de nuevo: ¿qué indicador estaba peor? ¿Cómo lo supiste: por el color, la forma o la palabra?
- ¿Qué significa para ti ATENCIÓN y qué significa PARAR? ¿Qué harías distinto en cada caso?
- ¿Te sobró o te faltó algo en la pantalla? ¿Echas de menos ver el número del indicador?
- ¿La alerta de arriba era la que tú habrías atendido primero?
- "Atendida" y "No aplica": ¿qué entiendes por cada una? ¿Te faltó alguna otra opción?
- ¿Te quedó claro qué había cambiado desde tu última visita?
- Cuando apareció "N alertas nuevas", ¿lo viste enseguida? ¿Qué pensaste que tenías que hacer?
- ¿Dónde pondrías esta tablet en la línea? ¿A qué distancia la mirarías?
- ¿Cada cuánto esperas que se actualice? ¿"Última actualización" te da confianza?
- ¿El PIN con guantes te resultó cómodo? ¿Cómo te identificas hoy en los equipos del piso?

### Oficina (escritorio)

- ¿Qué es lo primero que miras al llegar al escritorio? ¿Está en el Resumen?
- ¿Qué información te falta para investigar una alerta (historial, mediciones, causa raíz, responsable)?
- ¿Usarías el análisis 8D desde aquí o tienes otra herramienta para eso?
- Los filtros (planta, línea, turno, período): ¿cuáles usarías de verdad?
- ¿Qué reportes te piden hoy y quién los arma? ¿Cuánto tiempo te llevan?
- ¿Tiene sentido para ti que planta y oficina vean cosas distintas de la misma línea?

### Notificaciones push (oficina)

- Cuando llegó el aviso, ¿qué entendiste? ¿Qué hiciste primero?
- ¿Para qué alertas querrías aviso: solo ALTA, también MEDIA, solo de tus líneas?
- ¿Cuántos avisos por turno te parecen razonables antes de que molesten?
- ¿Dónde preferirías recibirlos: navegador, celular, WhatsApp, correo, radio?
- ¿En qué horario? ¿Fuera de turno también?
- La campanita: ¿revisarías el listado o solo mirarías el número?
- ¿Quién más debería recibir el aviso cuando hay una ALTA (jefe de turno, calidad, mantenimiento)?
- ¿Qué te haría confiar en el aviso lo suficiente para actuar sin ir a ver primero?

### Correo (reporte de turno)

- ¿Leerías este correo? ¿En qué momento: al cierre del turno o al día siguiente?
- ¿Qué es lo primero que buscas en él? ¿Lo encontraste rápido?
- ¿Te sobra o te falta algo (tendencias, comparación con el turno anterior, responsables)?
- ¿Uno por turno o un resumen diario? ¿Por línea o de toda la planta?
- ¿A quién se lo reenviarías? ¿Lo usarías en la reunión de arranque del turno?
- ¿Te sirve el enlace al tablero?

### Back office y demo (solo para el equipo o el facilitador)

- ¿Pudiste preparar cada sesión rápido? ¿Qué te faltó para facilitar?
- ¿Los escenarios cubren las situaciones reales que quieres probar? ¿Cuál agregarías?

### Valor y adopción

- ¿Qué problema de tu día a día resuelve esto? ¿Cuál no resuelve?
- ¿Qué tendría que pasar para que lo abras todos los días?
- Si mañana desapareciera, ¿lo extrañarías? ¿Qué parte?
- ¿Quién más en tu planta debería verlo?

---

## C. Guion de demo para mostrar lo hecho (~10 min)

1. **Problema** (1 min): el insight y la evidencia F1, E4 y F3.3.
2. **Selector** (`/`): una vista por contexto de uso.
3. **Planta:** estado de un vistazo (3 KPI con color, forma y palabra), la alerta más grave arriba, botones
   de 88 px para guantes, modo kiosco sin scroll, "Desde tu última visita".
4. **Back office:** tabla de estado por línea, escenarios, participante, correo y push.
5. **En vivo:** "Simular turno" y mostrar en paralelo la franja de alertas nuevas en la tablet, el correo en
   Mailinator y el push y la campanita en Oficina.
6. **Oficina:** investigación de la alerta con datos reales.
7. **PostHog:** embudo por participante, segundos hasta abrir y resolver, una grabación de sesión.
8. **Qué valida y qué no** (1 min): esta prueba muestra si se entiende de un vistazo; el uso real y los
   tiempos de detección necesitan un piloto de varias semanas.

---

## D. Qué mirar en PostHog después de cada sesión

- **Embudo** "Planta · ¿Completa la tarea?": `login` → `alerta_mostrada` → `alerta_abierta` → "Alerta
  resuelta" (acción que agrupa `alerta_atendida` y `alerta_no_aplica`), desglose por `participante`.
- **Trend** "Planta · ¿Lo entiende de un vistazo?": mediana de `ms_desde_mostrada` en `alerta_abierta` y
  `alerta_atendida`, en segundos, por `participante`.
- **Personas:** P1, P2… para ver la secuencia completa de cada participante.
- **Session replay:** dudas, toques fallidos y scroll de más, sobre todo con guantes.
