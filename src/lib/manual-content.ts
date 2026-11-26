export interface ManualButtonRow {
  control: string;
  location: string;
  purpose: string;
}

export interface ManualSection {
  id: string;
  number: string;
  title: string;
  route: string;
  group: string;
  summary: string;
  tip?: string;
  buttons: ManualButtonRow[];
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "navegacion",
    number: "01",
    title: "Acceso, Barra Lateral y Barra Superior (Multiempresa)",
    route: "Visible en todas las ventanas",
    group: "NAVEGACIÓN GENERAL",
    summary:
      "Es la estructura principal de impulsa CRM. Desde aquí cambias de módulo, buscas contactos, revisas el estado de tus integraciones y cambias entre empresas si manejas más de un negocio.",
    tip: "Cada empresa creada desde el selector superior (o registrada desde /login?mode=register) es 100% independiente y privada: tiene sus propios contactos, proformas PDF, correos, WhatsApp, catálogo y Agente de IA.",
    buttons: [
      {
        control: "Buscar contacto o proforma...",
        location: "Menú izquierdo (arriba)",
        purpose: "Buscador rápido para ir directo al directorio de clientes.",
      },
      {
        control: "Insignias de estado (BD / WA / Mail / IA)",
        location: "Menú izquierdo (abajo)",
        purpose:
          "Muestran si la base de datos, WhatsApp Business, Correo SMTP/IMAP y Gemini IA están activos. Al hacer clic te llevan directo a Conexiones y empresa.",
      },
      {
        control: "Manual de Uso",
        location: "Menú izquierdo (sección IA y Sistema)",
        purpose:
          "Abre esta guía completa con 2 pestañas (Manual de Uso y Manual Interno de Conexiones) lista para imprimir o guardar como PDF.",
      },
      {
        control: "Cerrar sesión (ícono puerta)",
        location: "Esquina inferior izquierda",
        purpose:
          "Cierra tu sesión segura en el navegador. Úsalo si accedes desde una computadora compartida.",
      },
      {
        control: "Selector de Empresa (Caminante Corporativo ▾)",
        location: "Barra superior derecha",
        purpose:
          "Permite cambiar entre tus empresas registradas o crear una nueva empresa independiente con el botón «+ Crear nueva empresa».",
      },
    ],
  },
  {
    id: "resumen",
    number: "02",
    title: "Resumen (Tablero Comercial)",
    route: "/",
    group: "TU ESPACIO",
    summary:
      "Vista ejecutiva en tiempo real del negocio: monto en negociación, proformas enviadas y ganadas, mensajes sin leer, avisos de compra urgentes y tareas del día. Excluye automáticamente contactos marcados como Compañero/Agente o Proveedor (Sin IA) para que tus métricas reflejen solo clientes reales.",
    tip: "Es la primera pantalla que conviene revisar cada mañana: en menos de 1 minuto ves si hay clientes listos para comprar o mensajes pendientes. La tarjeta de «Puesta en marcha» se oculta sola en cuanto WhatsApp y Correo están conectados.",
    buttons: [
      {
        control: "Actualizar",
        location: "Arriba a la derecha",
        purpose: "Recarga en tiempo real todas las métricas, alertas y tareas del tablero.",
      },
      {
        control: "Bandeja (N)",
        location: "Arriba a la derecha (botón verde)",
        purpose:
          "Abre la Bandeja de Conversaciones mostrando el número de mensajes sin leer.",
      },
      {
        control: "+ Nueva Proforma",
        location: "Arriba a la derecha (botón azul)",
        purpose: "Abre el generador de Facturas Proforma PDF.",
      },
      {
        control: "Proforma / Atender / Ver todos los avisos",
        location: "Tarjeta «Avisos al Vendedor»",
        purpose:
          "Atajos inmediatos para cotizar o atender a un cliente que el Agente de IA marcó como listo para comprar.",
      },
      {
        control: "Círculo de tarea pendiente",
        location: "Bloque de tareas del tablero",
        purpose: "Marca una tarea o llamada como completada en 1 clic.",
      },
    ],
  },
  {
    id: "conversaciones",
    number: "03",
    title: "Conversaciones (Bandeja Omnicanal)",
    route: "/bandeja",
    group: "TU ESPACIO",
    summary:
      "Centraliza en una sola pantalla todos los mensajes entrantes y salientes de WhatsApp Business (+506 8449-1975), Correo Corporativo (ventas@ y uniformes@), Messenger e Instagram, asistidos por el Agente de IA. Unifica automáticamente hilos del mismo número de WhatsApp para evitar chats duplicados.",
    tip: "Si activas «🆕 IA: Solo Clientes Nuevos», el bot atenderá únicamente a prospectos nuevos (etapa Nuevo Lead) sin intervenir en clientes existentes. Y para compañeros de trabajo o agentes, toca «👥 Compañero · Sin IA» una sola vez para apagarles la IA para siempre.",
    buttons: [
      {
        control: "IA Automática: ACTIVA / Modo Manual Total (IA Apagada)",
        location: "Barra superior derecha (interruptor maestro)",
        purpose:
          "Interruptor global en 1 clic: en «Modo Manual Total» apaga las respuestas automáticas del bot en TODOS los chats (tú respondes todo a mano o con Borrador IA). Al volver a hacer clic reactivas la IA automática 24/7.",
      },
      {
        control: "IA: Todos los Clientes / 🆕 IA: Solo Clientes Nuevos",
        location: "Barra superior derecha (junto al interruptor maestro)",
        purpose:
          "Controla el alcance de la IA: en modo «Solo Clientes Nuevos», la IA responde únicamente a contactos tipo Cliente en etapa «Nuevo Lead». Si el cliente ya pasó a Contactado, Cotizado, Seguimiento o Ganado (o ya existía en Contactos con otra etapa), la IA no le contesta sola.",
      },
      {
        control: "👥 Compañero · Sin IA / ✅ Es Compañero (Sin IA)",
        location: "Encabezado del chat abierto",
        purpose:
          "Marca en 1 clic a compañeros de trabajo, agentes o proveedores: apaga la IA de forma permanente para ese número (ni texto ni fotos), evita Avisos al vendedor, los saca de Ventas Kanban y del Tablero, y los protege de Campañas y del Ciclo 1-7-90 mientras tú chateas normal con ellos.",
      },
      {
        control: "Sincronizar Correo IMAP",
        location: "Barra superior derecha",
        purpose:
          "Descarga los correos nuevos de ventas@elcaminantecr.com y uniformes@elcaminantecr.com directo a su pestaña correspondiente.",
      },
      {
        control: "Buscar por Foto · Stock",
        location: "Barra superior derecha",
        purpose:
          "Buscador visual universal: sube la foto de cualquier artículo (calzado, ropa, gorras, mochilas, balones o accesorios) para identificar el modelo exacto, precio y disponibilidad real por sucursal en elcaminantecr.com/tienda/.",
      },
      {
        control: "Clasificación IA (🔥 Compra real vs 💬 Solo consultas)",
        location: "Barra de filtros encima de la lista de chats",
        purpose:
          "Separa automáticamente en WhatsApp, Messenger, Instagram y Correo los clientes con intención real de compra (cantidades, cotización, reserva, SINPE/pago) de quienes solo hacen consultas generales (horario, ubicación o info). Permite filtrar en 1 clic solo los compradores calientes.",
      },
      {
        control: "Pestañas separadas por canal y correo + «Acomodar conexiones»",
        location: "Debajo del encabezado",
        purpose:
          "Separa automáticamente cada buzón corporativo en su propia bandeja (ej. ventas@ y uniformes@ por separado, nunca revueltos) junto a WhatsApp, Messenger e Instagram. Con «Acomodar conexiones» puedes reordenar (← / →) u ocultar canales que no uses.",
      },
      {
        control: "Tomar control (👤 AGENTE) / Devolver al bot (🤖)",
        location: "Encabezado del chat abierto",
        purpose:
          "«Tomar control» pausa el bot solo en ese chat para atención humana directa; «Devolver al bot» reactiva la IA en esa conversación. Cada burbuja indica si respondió BOT o AGENTE, la hora y doble check ✓✓.",
      },
      {
        control: "Reloj 24h de WhatsApp + Plantillas Meta",
        location: "Encabezado y barra inferior del chat",
        purpose:
          "El Reloj 24h indica cuánto tiempo gratis queda desde el último mensaje del cliente (🟢 abierta / 🟠 menos de 4h / 🔴 cerrada). Cuando se cierra la ventana de 24h, «Plantillas Meta» te permite reabrir el chat enviando una plantilla oficial aprobada.",
      },
      {
        control: "Actualizar CRM (Piloto Automático IA)",
        location: "Encabezado del chat abierto",
        purpose:
          "Analiza silenciosamente la conversación con IA para actualizar la etapa del Kanban, etiquetas, valor estimado, [Resumen IA] y crear tareas automáticas en Agenda. También corre en segundo plano al recibir o enviar mensajes.",
      },
      {
        control: "Cotizar con IA",
        location: "Encabezado del chat abierto",
        purpose:
          "Lee los mensajes del cliente y te lleva directo a Nueva Proforma con los datos y productos pre-extraídos automáticamente.",
      },
      {
        control: "WhatsApp (enlace externo) / Eliminar conversación (🗑️)",
        location: "Encabezado del chat abierto",
        purpose:
          "Abre la conversación directo en WhatsApp Web/Desktop, o borra ese chat individual (pide confirmación).",
      },
      {
        control: "Sugerencia IA (Borrador) / Enviar",
        location: "Parte inferior del chat",
        purpose:
          "«Sugerencia IA» redacta una respuesta recomendada para que la revises antes de enviar. «Enviar» manda el mensaje real por WhatsApp Cloud API o por correo SMTP (eligiendo desde qué cuenta enviar).",
      },
    ],
  },
  {
    id: "avisos",
    number: "04",
    title: "Avisos al Vendedor (Clientes Listos para Comprar)",
    route: "/avisos",
    group: "TU ESPACIO",
    summary:
      "Bandeja prioritaria de alertas de venta caliente. Cada vez que el Agente de IA detecta señales claras de compra (cantidades, pedido, solicitud de proforma o SINPE), pausa automáticamente el bot y crea un aviso aquí. Los contactos marcados como Compañero/Agente o Proveedor (Sin IA) nunca generan avisos.",
    tip: "Este módulo garantiza que nunca se pierda un cierre: el bot atiende las consultas iniciales y te entrega el cliente listo para facturar.",
    buttons: [
      {
        control: "Actualizar / Limpiar resueltos",
        location: "Arriba a la derecha",
        purpose:
          "Refresca la lista de avisos pendientes o depura en 1 clic todos los avisos que ya marcaste como resueltos.",
      },
      {
        control: "Crear Proforma PDF",
        location: "Dentro de cada tarjeta de aviso",
        purpose:
          "Abre una proforma nueva ya vinculada a ese cliente con todos sus datos cargados.",
      },
      {
        control: "Tomar Chat (Bot pausado)",
        location: "Dentro de cada tarjeta de aviso",
        purpose:
          "Te lleva directamente a esa conversación en la Bandeja para responderle personalmente al cliente.",
      },
      {
        control: "Resuelto + Reactivar IA / Solo Marcar Resuelto",
        location: "Dentro de cada tarjeta de aviso",
        purpose:
          "«Resuelto + Reactivar IA» cierra el aviso y vuelve a encender el bot en ese chat; «Solo Marcar Resuelto» cierra el aviso dejando el chat en modo manual (AGENTE).",
      },
      {
        control: "Reabrir / Eliminar (🗑️)",
        location: "En cada aviso resuelto o pendiente",
        purpose:
          "Devuelve un aviso resuelto a pendientes si requiere nuevo seguimiento, o borra un aviso individual.",
      },
    ],
  },
  {
    id: "embudo",
    number: "05",
    title: "Ventas · Kanban (Embudo de Ventas)",
    route: "/embudo",
    group: "TU ESPACIO",
    summary:
      "Tablero visual por columnas (Nuevo, Contactado, Cotizado, Seguimiento, Ganado y Perdido) con el monto total en colones acumulado en cada etapa y panel completo de vista previa deslizable. Excluye automáticamente contactos internos (Compañeros/Proveedores Sin IA).",
    tip: "Haz clic sobre cualquier tarjeta para abrir su panel completo a la derecha (chat reciente, proformas, tareas y edición rápida de monto, etiquetas y notas) sin salir del tablero.",
    buttons: [
      {
        control: "Kanban ↔ Lista completa",
        location: "Barra superior de herramientas",
        purpose:
          "Alterna entre el tablero visual por columnas y una vista de tabla completa ideal para revisar todos los negocios sin desplazamiento horizontal.",
      },
      {
        control: "Ocultar columnas vacías",
        location: "Barra superior de herramientas",
        purpose:
          "Esconde temporalmente las etapas sin clientes para concentrar la pantalla solo en las columnas activas.",
      },
      {
        control: "Buscador, filtros rápidos por etapa y flechas (← / →)",
        location: "Barra de filtros del embudo",
        purpose:
          "Filtra tarjetas por nombre, empresa o etiqueta, enfoca una sola etapa o desplaza el tablero lateralmente en un clic.",
      },
      {
        control: "Clic en tarjeta (Panel de Vista Previa Completa)",
        location: "Cualquier tarjeta del tablero",
        purpose:
          "Abre un panel lateral deslizable con el resumen del cliente, últimos mensajes del chat, proformas PDF, tareas de agenda y edición directa de etapa, valor estimado, etiquetas y notas.",
      },
      {
        control: "Arrastrar tarjeta / Selector de etapa / Proforma / WhatsApp",
        location: "En cada tarjeta y panel lateral",
        purpose:
          "Permite mover negocios de etapa arrastrando o desde el selector, crear una proforma PDF o abrir WhatsApp directo.",
      },
    ],
  },
  {
    id: "contactos",
    number: "06",
    title: "Contactos (Clientes, Compañeros y Proveedores)",
    route: "/clientes",
    group: "TU ESPACIO",
    summary:
      "Directorio centralizado de clientes, compañeros/agentes internos y proveedores. Guarda razón social, contacto, tipo de contacto, teléfono, WhatsApp, correo, dirección, etapa, vendedor asignado, notas internas e historial de proformas.",
    tip: "Puedes registrar de antemano los números de WhatsApp de tus compañeros, agentes de ventas y proveedores con «Tipo de Contacto → Compañero / Agente (Sin IA)» para que el bot nunca les responda ni desde su primer mensaje.",
    buttons: [
      {
        control: "Importar CSV / Exportar CSV",
        location: "Arriba a la derecha",
        purpose:
          "Carga contactos masivamente desde una hoja de cálculo (.csv) o descarga tu base filtrada en formato Excel/CSV.",
      },
      {
        control: "+ Nuevo Cliente",
        location: "Arriba a la derecha (botón azul)",
        purpose:
          "Abre el formulario para registrar manualmente un cliente, compañero/agente interno o proveedor.",
      },
      {
        control: "Tipo de Contacto (Cliente / Compañero·Agente Sin IA / Proveedor Sin IA)",
        location: "Dentro del formulario y en el filtro superior",
        purpose:
          "Define si la persona es un Cliente comercial o un contacto interno/proveedor excluido de la IA, Avisos, Kanban, Tablero y Campañas. El selector superior permite ver cada grupo por separado.",
      },
      {
        control: "Buscar / Filtros de Etapa y Origen",
        location: "Barra de filtros",
        purpose:
          "Busca por empresa, nombre, teléfono, correo o etiqueta, y filtra por tipo de contacto, etapa del embudo o canal de origen.",
      },
      {
        control: "Clic en una fila (Ficha del Cliente)",
        location: "Tabla de contactos",
        purpose:
          "Abre el panel de detalle con todas las proformas emitidas a ese cliente y un campo para agregar notas internas al historial.",
      },
      {
        control: "Acciones de fila (Proforma / Editar ✏️ / Eliminar 🗑️)",
        location: "Columna derecha de cada contacto",
        purpose:
          "Permiten crearle una proforma, cambiar sus datos o tipo de contacto, o borrarlo de la base de datos.",
      },
    ],
  },
  {
    id: "agenda",
    number: "07",
    title: "Agenda y Reportes",
    route: "/agenda",
    group: "TU ESPACIO",
    summary:
      "Combina tu calendario de seguimientos (tareas, llamadas, WhatsApp y correos —incluidos los detectados automáticamente por el Piloto Automático IA—) con dos reportes gerenciales en vivo: desempeño por vendedor y rendimiento por canal de origen.",
    buttons: [
      {
        control: "Formulario «Programar Cita, Llamada o Seguimiento»",
        location: "Columna izquierda",
        purpose:
          "Permite seleccionar Tipo (Tarea, Llamada, WhatsApp o Correo), Cliente, Título, Fecha/Hora y Notas.",
      },
      {
        control: "+ Agendar Actividad",
        location: "Botón azul del formulario",
        purpose: "Guarda la cita o seguimiento en tu agenda y en el tablero principal.",
      },
      {
        control: "Círculo de estado en cada actividad",
        location: "Lista «Agenda de Seguimientos y Citas Pendientes»",
        purpose: "Marca una cita o llamada como realizada.",
      },
      {
        control: "Tablas de Reportes",
        location: "Parte inferior",
        purpose:
          "Muestran automáticamente clientes, ganados y cartera en colones (₡) por vendedor y por origen (WhatsApp, Correo, Meta Ads, Manual).",
      },
    ],
  },
  {
    id: "cotizaciones",
    number: "08",
    title: "Cotizaciones PDF (Facturas Proforma)",
    route: "/cotizaciones",
    group: "CATÁLOGO Y PROFORMAS",
    summary:
      "Reemplaza por completo la hoja de Excel con macros (1408-MEP.xlsm). Genera PDFs con el formato oficial de Caminante Corporativo, logo, consecutivo automático, colones (₡) con IVA 13% Incluido / Desglosado / Exonerado, cuentas bancarias (BN, BCR, BAC, Davivienda) y SINPE Móvil 8691-1975.",
    tip: "Si el cliente tiene precio al por mayor configurado en un artículo del catálogo y superas la cantidad mínima, el precio unitario se ajusta automáticamente al cambiar la cantidad.",
    buttons: [
      {
        control: "+ Nueva Proforma",
        location: "Arriba a la derecha",
        purpose:
          "Abre el constructor de proformas con el siguiente número consecutivo automático.",
      },
      {
        control: "Extraer con IA (dentro del constructor)",
        location: "Parte superior del formulario de nueva proforma",
        purpose:
          "Pegas el texto de un mensaje de WhatsApp o correo y la IA rellena automáticamente las líneas, cantidades y descripciones.",
      },
      {
        control: "Agregar línea del catálogo / + Agregar línea manual",
        location: "Sección de ítems del constructor",
        purpose:
          "Permite insertar productos guardados en tu catálogo o redactar partidas personalizadas con varias líneas de detalle.",
      },
      {
        control: "Selector de Impuesto y Moneda",
        location: "Datos comerciales de la proforma",
        purpose:
          "Elige entre IVA 13% Incluido (predeterminado), IVA 13% Desglosado o Exonerado (0%), y moneda ₡ Colones o $ Dólares.",
      },
      {
        control: "Selector de Estado (Borrador / Enviada / Seguimiento / Ganada / Perdida)",
        location: "Columna «Estado» en la tabla",
        purpose:
          "Actualiza el estado de la proforma y refleja el avance en los KPIs del Tablero.",
      },
      {
        control: "Ver PDF (↗) y Descargar PDF (⬇)",
        location: "Columna «Acciones Rápidas»",
        purpose:
          "Abre el PDF oficial en el navegador o lo descarga nombrado automáticamente como «Numero-Cliente.pdf».",
      },
      {
        control: "Enviar por Correo (✉️)",
        location: "Columna «Acciones Rápidas»",
        purpose:
          "Abre la ventana de envío SMTP: eliges si enviar desde ventas@ o uniformes@, editas el texto y el sistema adjunta el PDF automáticamente.",
      },
      {
        control: "Enviar por WhatsApp (💬)",
        location: "Columna «Acciones Rápidas»",
        purpose:
          "Envía la proforma PDF por WhatsApp Cloud API oficial o genera el enlace directo a WhatsApp Web/Desktop.",
      },
      {
        control: "Editar (✏️) / Duplicar (📋) / Eliminar (🗑️)",
        location: "Columna «Acciones Rápidas»",
        purpose:
          "Edita la proforma existente, crea una copia nueva con el siguiente consecutivo o borra una proforma.",
      },
    ],
  },
  {
    id: "catalogo",
    number: "09",
    title: "Catálogo e Inventario",
    route: "/catalogo",
    group: "CATÁLOGO Y PROFORMAS",
    summary:
      "Almacena tus productos y servicios (Uniformes, Bordados, Artículos Promocionales, Artículos Deportivos, Zapatos de Seguridad) con precio regular, costo y precio al por mayor para insertarlos en segundos en las proformas.",
    buttons: [
      {
        control: "Buscar por Foto · Stock Web",
        location: "Arriba a la derecha (botón morado)",
        purpose:
          "Sube o pega la foto de cualquier artículo (calzado, ropa, gorras, mochilas, balones o accesorios) para consultar al instante el modelo, precio y existencias por sucursal en elcaminantecr.com/tienda/.",
      },
      {
        control: "Vaciar Catálogo",
        location: "Arriba a la derecha (visible si hay productos)",
        purpose:
          "Elimina todos los artículos del catálogo en 1 clic (no afecta las proformas ya emitidas).",
      },
      {
        control: "+ Nuevo Producto",
        location: "Arriba a la derecha (botón azul)",
        purpose:
          "Registra un nuevo artículo con SKU, categoría, descripción, unidad, precio, costo y escala de mayoreo.",
      },
      {
        control: "Filtros por Categoría y Buscador",
        location: "Debajo del encabezado",
        purpose: "Filtra rápidamente artículos por línea de negocio o nombre/SKU.",
      },
      {
        control: "Editar (✏️) / Eliminar (🗑️)",
        location: "En cada tarjeta o fila de producto",
        purpose: "Modifica precios/descripciones o borra un artículo específico.",
      },
    ],
  },
  {
    id: "conocimiento",
    number: "10",
    title: "Conocimiento y Docs (Cerebro del Agente IA)",
    route: "/conocimiento",
    group: "IA Y SISTEMA",
    summary:
      "Aquí guardas la información oficial de tu empresa (horarios regulares, Horario Navideño, garantías, políticas de bordado, cuentas, direcciones y tiempos de entrega). Todo documento en estado «Activo en IA» es leído automáticamente por el bot antes de contestar a un cliente.",
    tip: "Cuando cambie tu horario de temporada (por ejemplo al pasar de Horario Navideño a horario normal), solo desactiva o edita el documento aquí y el Agente de IA se actualiza al instante.",
    buttons: [
      {
        control: "Subir archivo (.txt, .md, .csv, .json)",
        location: "Formulario izquierdo (arriba)",
        purpose: "Carga automáticamente el contenido de un documento desde tu PC.",
      },
      {
        control: "+ Guardar en Base de Conocimiento",
        location: "Formulario izquierdo (abajo)",
        purpose: "Guarda el documento y lo activa de inmediato para el Agente de IA.",
      },
      {
        control: "Activo en IA / Inactivo",
        location: "En cada documento cargado",
        purpose:
          "Activa o desactiva ese documento sin borrarlo (ideal para horarios temporales o promociones).",
      },
      {
        control: "Eliminar (🗑️)",
        location: "En cada documento cargado",
        purpose: "Borra definitivamente el documento de la base de conocimiento.",
      },
    ],
  },
  {
    id: "automatizaciones",
    number: "11",
    title: "Agente IA y Reglas (Automatizaciones)",
    route: "/automatizaciones",
    group: "IA Y SISTEMA",
    summary:
      "Controla las reglas automáticas del CRM (respuestas automáticas por WhatsApp, seguimientos de proformas sin respuesta, reactivación de clientes) y ofrece un chat interno para probar al Agente de IA o pedirle tareas.",
    buttons: [
      {
        control: "Ejecutar seguimientos ahora",
        location: "Arriba a la derecha",
        purpose:
          "Revisa de inmediato qué proformas superaron el tiempo de espera configurado y dispara su seguimiento automático.",
      },
      {
        control: "+ Regla Reactivación",
        location: "Arriba a la derecha",
        purpose:
          "Crea automáticamente una regla para volver a contactar clientes anteriores a los 30 días.",
      },
      {
        control: "+ Nueva Regla",
        location: "Arriba a la derecha (botón azul)",
        purpose:
          "Abre el formulario para definir una regla personalizada: disparador, canal, horas de espera, acción y texto de plantilla.",
      },
      {
        control: "Modo «Asistente CRM» vs «Simular Cliente»",
        location: "Panel izquierdo «Agente IA Caminante»",
        purpose:
          "«Asistente CRM» te permite preguntarle por proformas pendientes o pedirle «Agenda llamada con X mañana». «Simular Cliente» prueba exactamente cómo respondería el bot a un comprador en WhatsApp.",
      },
      {
        control: "Interruptor Activa / Pausada y Eliminar (🗑️)",
        location: "Lista de reglas (columna derecha)",
        purpose: "Enciende, apaga o elimina cada automatización y muestra cuántas veces se ha ejecutado.",
      },
    ],
  },
  {
    id: "campanas",
    number: "11B",
    title: "Campañas Masivas Seguras y Ciclo 1-7-90",
    route: "/campanas",
    group: "IA Y SISTEMA",
    summary:
      "Permite enviar campañas masivas de WhatsApp sin riesgo de bloqueo usando la API Oficial de Meta y Plantillas aprobadas, y gestionar secuencias multi-día («Ciclo 1-7-90») para que ningún cliente que dijo «lo voy a pensar» se enfríe.",
    tip: "Las campañas y el Ciclo 1-7-90 excluyen automáticamente a clientes con opt-out (no molestar) y a todos los Compañeros/Agentes o Proveedores (Sin IA). Además, las secuencias 1-7-90 se detienen solas en cuanto el cliente responde o compra.",
    buttons: [
      {
        control: "Pestaña 1 · Campañas Masivas (API Oficial)",
        location: "Selector superior",
        purpose:
          "Filtra solo clientes comerciales por etapa Kanban o etiqueta, elige una plantilla aprobada de Meta, personaliza con {{contacto}} / {{empresa}}, revisa la vista previa y envía con reporte de entregados.",
      },
      {
        control: "Pestaña 2 · Secuencias Ciclo 1-7-90",
        location: "Selector superior",
        purpose:
          "Crea en 1 clic la secuencia de 9 pasos (Días 1, 3, 4, 5, 7 + Nutrición 15, 30, 60 y 90 días), permite editar cada paso, asignar plantillas Meta, inscribir clientes o etapas completas y ejecutar envíos pendientes.",
      },
    ],
  },
  {
    id: "configuracion",
    number: "12",
    title: "Conexiones y Empresa (5 Pestañas de Configuración)",
    route: "/configuracion",
    group: "IA Y SISTEMA",
    summary:
      "Centro técnico y administrativo del CRM. Permite personalizar los datos legales de la proforma, gestionar múltiples cuentas de correo, configurar WhatsApp Cloud API, ajustar el alcance y personalidad de la IA y respaldar o limpiar datos.",
    buttons: [
      {
        control: "Pestaña 1 · Empresa y Proforma",
        location: "Primera pestaña",
        purpose:
          "Edita nombre comercial, razón social, cédula jurídica, dirección, teléfonos, SINPE Móvil, consecutivo de proforma, color/logo, frase del pie de página y cuentas bancarias del PDF.",
      },
      {
        control: "Pestaña 2 · Correo SMTP / IMAP",
        location: "Segunda pestaña",
        purpose:
          "Administra múltiples correos corporativos (ventas@ y uniformes@). Incluye botones para Agregar cuenta, Guardar, Probar conexión SMTP/IMAP, Sincronizar bandeja y marcar cuenta Predeterminada.",
      },
      {
        control: "Pestaña 3 · Meta Cloud API & WhatsApp",
        location: "Tercera pestaña",
        purpose:
          "Muestra la URL del Webhook (con botón Copiar), guarda el Token Permanente, Phone Number ID y WABA ID. Incluye «Verificar Conexión Meta», «Enviar WhatsApp Prueba» y «Enviar Texto Libre».",
      },
      {
        control: "Pestaña 4 · Agente de IA",
        location: "Cuarta pestaña",
        purpose:
          "Controla el interruptor global («IA Automática 24/7» vs «Modo Manual Total»), el Alcance de la IA («Solo Clientes Nuevos» vs «Todos los Clientes»), API Key de Gemini, botón «Probar Conexión IA», personalidad del bot y plantillas editables para búsquedas por foto.",
      },
      {
        control: "Pestaña 5 · Respaldos y Nube",
        location: "Quinta pestaña",
        purpose:
          "«Descargar Migración Completa (JSON)» guarda copia total de seguridad. «Subir archivo de respaldo JSON» restaura datos. El bloque de Limpieza permite borrar chats de prueba, vaciar catálogo o limpiar el tablero Kanban de pruebas de forma segura.",
      },
      {
        control: "Guardar Configuración",
        location: "Botón azul inferior derecho",
        purpose: "Guarda todos los cambios realizados en las pestañas Empresa, Meta o Agente de IA.",
      },
    ],
  },
];

export const DAILY_ROUTINE = [
  {
    step: "1. Revisar Avisos al Vendedor",
    detail:
      "Entra a «Avisos al vendedor» al iniciar el día. Ahí están los clientes que ya pidieron cotización, tallas o pago por SINPE (el bot ya pausó su respuesta para que tú cierres). Al terminar, usa «Resuelto + Reactivar IA» o «Solo Marcar Resuelto».",
  },
  {
    step: "2. Sincronizar Correos y Controlar la IA en Bandeja",
    detail:
      "En «Conversaciones», haz clic en «Sincronizar Correo IMAP» para traer correos de ventas@ y uniformes@. Verifica si prefieres «🆕 IA: Solo Clientes Nuevos» activo, y marca cualquier compañero o agente con «👥 Compañero · Sin IA» para que el bot nunca le responda.",
  },
  {
    step: "3. Emitir y Enviar Proformas PDF",
    detail:
      "Desde el mismo chat usa «Cotizar con IA» o abre «Cotizaciones PDF → Nueva Proforma», revisa precios e IVA 13%, y envía el PDF en 1 clic por Correo o WhatsApp.",
  },
  {
    step: "4. Revisar Ventas Kanban y Seguimientos 1-7-90",
    detail:
      "Haz clic en tus negocios en «Ventas · Kanban» para ver su panel completo (chat, proformas y tareas), cambia a «Lista completa» si lo prefieres, y mantén activos tus seguimientos en «Agenda» o «Campañas y Ciclo 1-7-90».",
  },
  {
    step: "5. Mantener Horarios y Políticas al Día",
    detail:
      "Cuando cambien horarios, promociones o tiempos de entrega, actualízalo en «Conocimiento y docs» para que tu Agente de IA siempre dé información exacta 24/7.",
  },
];
