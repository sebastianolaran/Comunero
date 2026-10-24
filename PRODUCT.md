# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Copropietarios de una quinta o casa de fin de semana: una familia o un grupo de amigos (típicamente 3 a 6) que comparten el bien. Se turnan para usarlo, reparten los gastos, a veces lo alquilan a terceros y tienen que ponerse de acuerdo en las decisiones que lo afectan. Cada uno entra a la app para su parte del trabajo: pedir días, votar lo que piden los demás, cargar un gasto, ver cuánto debe o le deben, gestionar un alquiler.

Un usuario puede estar en más de un bien y elige con cuál trabajar (pantalla "Mis bienes").

## Product Purpose

Comunero organiza el uso compartido de un bien entre sus copropietarios, para que la convivencia no dependa de un grupo de WhatsApp, una planilla y la memoria de alguien. Éxito: el grupo usa, paga, alquila y decide sobre el bien sin peleas, y cualquiera puede ver en qué está cada cosa y quién hizo qué.

## Positioning

Lo que no ofrece la suma de Splitwise, Google Calendar y un grupo de WhatsApp:

- **Todo junto y conectado:** uso, plata, alquileres y decisiones en un solo lugar, y las piezas se afectan entre sí (un alquiler pago genera el ingreso en Movimientos, una reserva aprobada ocupa el calendario y rechaza las pendientes que se pisan).
- **Unanimidad y transparencia:** nada se aprueba sin el Sí de todos los copropietarios, y cada cambio queda registrado con quién lo hizo.
- **Reparto por porcentajes:** cada uno pone y recibe según su parte del bien, no siempre en partes iguales.
- **Alquiler a terceros como parte central:** inquilinos, votación de solicitudes, cobro y preparación de la casa.

## Operating Context

- Trabajo práctico de la materia Gestión (GDSI, FIUBA). Los docentes lo recorren en el deploy (comunero.onrender.com) en cada entrega (V1 a V4) y evalúan que la funcionalidad esté completa y prolija; esa recorrida es hoy el uso real más importante.
- Se usa sobre todo en navegador de escritorio. Mobile tiene que funcionar sin romperse, pero no es la experiencia principal.
- Secciones: Calendario, Alquiler a terceros (solicitudes, historial de inquilinos, tareas de preparación), Movimientos, Balance, Decisiones grupales, Historial y Configuración.
- Datos de demo: el seed carga la casa "Casa" con Ana, Bruno, Carla y Flor (usuarios `@comunero.test`).

## Capabilities and Constraints

- **Votación:** se aprueba con el Sí de todos; un No alcanza para rechazar. Única excepción: en Configuración el bien puede elegir que, vencido el tiempo para responder, quien no votó cuente como Sí (por defecto, se rechaza).
- **Uso propio:** reservas de días que los demás votan; máximo de días consecutivos configurable.
- **Alquiler a terceros:** solicitudes con inquilino (nombre y teléfono), monto, votación, pago en dos estados (Pendiente → Pago, final), cancelación sin votar mientras no esté paga, observaciones por inquilino y tareas de preparación.
- **Movimientos y Balance:** gastos e ingresos con reparto por persona o desglose por ítem; balance entre cada par de copropietarios con pagos parciales y saldos cerrados.
- **Decisiones grupales:** propuestas (con monto opcional) votadas por unanimidad, con historial de aprobadas y rechazadas.
- **Configuración:** porcentaje de cada integrante, precio por día del alquiler, máximo de días seguidos, tiempo para responder y qué pasa si alguien no responde. Cualquier copropietario la cambia sin votar y queda en "Cambios recientes".
- **Integrantes:** se entra a un bien con un código de invitación y se puede salir; al entrar o salir alguien, los porcentajes vuelven a partes iguales.
- Moneda: pesos argentinos. Zona horaria: Buenos Aires.
- Fuera de alcance por ahora: movimientos recurrentes (se sacaron), anticipación máxima de reservas, elegir color por integrante.

## Brand Commitments

- El nombre es **Comunero**. "Compartido" es el nombre viejo del prototipo y no aparece en ningún texto de marca.
- Idioma: español rioplatense, con voseo ("Elegí", "Votá", "No podés").

## Evidence on Hand

- Prototipo de diseño: `Modificaciones de componente HTML/Compartido.dc.html` (local, fuera de git), publicado en https://claude.ai/artifact/F6F5CVtzMPzw7mcpZofx8C.
- Datos de demo del seed (`server/prisma/seed.js`).
- Devolución docente de la V2: valoró movimientos, balance y votaciones; pidió que Historial no repita lo que ya está en otras pantallas.
- No hay usuarios reales, testimonios ni métricas de uso: no inventarlos.

## Product Principles

1. **Nadie decide solo.** Todo lo que afecta a los demás pasa por el voto de todos, y la interfaz muestra siempre quién votó y quién falta.
2. **Todo a la vista.** Cada cambio de plata, uso o reglas deja rastro con quién y cuándo; el usuario nunca tiene que preguntar "¿esto quién lo cambió?".
3. **Las piezas se hablan.** Una acción en una sección se refleja en las demás sin cargar dos veces lo mismo.
4. **Claro antes que completo.** Cada regla (porcentajes, vencimientos, solapamientos) se explica en la pantalla donde actúa, en lenguaje llano.
5. **Escritorio primero.** Densidad, tablas, hover, foco y teclado pensados para la web de escritorio; mobile no se rompe.
