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
      {
        control: "🔥 Ember IA · Agente de Ayuda (botón flotante)",
        location: "Esquina inferior derecha (en todas las ventanas)",
        purpose:
          "Abre a Ember, tu agente de ayuda IA entrenado con todo el Manual de Uso y Conexiones de impulsa CRM. Respóndele dudas paso a paso en lenguaje natural, pide guiones o usa sus botones de acceso directo para saltar al módulo que necesitas.",
      },
      {
        control: "📲 Instalar App (PWA) y 🔔 Alertas en Vivo con Sonido",
        location: "Barra superior derecha (junto al selector de empresa)",
        purpose:
          "Permite instalar impulsa CRM como aplicación en tu celular (Android/iPhone) o computadora sin tiendas externas, y activa alertas con sonido + notificación cuando entra un mensaje o una «🔥 Compra real».",
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
        control: "Messenger e Instagram 2 vías + Auto-respuesta a Comentarios",
        location: "Pestañas Messenger / Instagram y Webhook oficial",
        purpose:
          "Recibe y responde mensajes directos en 2 vías con el nombre real del usuario, acomoda el Kanban con IA y responde automáticamente comentarios de «Precio», «Ubicación» o «Quiero» en publicaciones/Reels enviando un mensaje privado (DM) y creando el lead en el CRM.",
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
        control: "Sugerencia IA / ⚡ Rápidas (/) / 🔒 Nota interna / Enviar",
        location: "Parte inferior del chat",
        purpose:
          "«Sugerir respuesta con IA» redacta un borrador comercial leyendo tu catálogo. «⚡ Rápidas (/)» (o escribir / en el cuadro) inserta al instante tus datos de SINPE, ubicación, envíos o horarios. «🔒 Nota interna» guarda comentarios privados amarillos entre vendedores que el cliente nunca ve. «Enviar» manda el mensaje real por WhatsApp, IG, Messenger o Correo.",
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
        control: "🔗 Portal Cliente (Aprobar en 1 clic + Subir Comprobante SINPE IA)",
        location: "Columna «Acciones Rápidas» (botón «🔗 Portal»)",
        purpose:
          "Copia un enlace seguro firmado para el cliente: desde su celular puede ver la proforma con tu logo, descargar el PDF, pulsar «✅ Aprobar Proforma» o subir la captura de su SINPE Móvil / transferencia para que la IA valide monto, banco y referencia, mueva el negocio a GANADO y dispare un Aviso al Vendedor.",
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
      "Aquí entrenas el cerebro de tu Agente de IA con el Cuestionario Guiado de 7 bloques (tiendas, horarios, apartados, pagos, Tasa Cero, créditos, envíos, cambios, garantías, factura electrónica y proveedores) o subiendo documentos libres (Horario Navideño, listas de precios, políticas). Todo documento en estado «Activo en IA» es leído automáticamente por el bot antes de contestar.",
    tip: "Usa la pestaña «1. Cuestionario Guiado IA» para entrenar una empresa nueva en 5 minutos; si cambia una política o horario, solo edítalo ahí mismo sin duplicar documentos.",
    buttons: [
      {
        control: "Pestaña 1 · Cuestionario Guiado IA (7 secciones)",
        location: "Selector superior izquierdo",
        purpose:
          "Formulario completo guiado (Tiendas/Horarios, Apartados/Encargos, Pagos/Créditos, Envíos/7 datos, Cambios, Garantías y Precios/Factura Electrónica/Proveedores). Al guardar entrena al bot al instante.",
      },
      {
        control: "Pestaña 2 · Subir archivo (.txt, .md, .csv, .json)",
        location: "Segunda pestaña (formulario izquierdo)",
        purpose: "Carga automáticamente documentos adicionales (como horarios de temporada) desde tu PC.",
      },
      {
        control: "+ Guardar en Base de Conocimiento",
        location: "Formulario izquierdo (abajo)",
        purpose: "Guarda el documento y lo activa de inmediato para el Agente de IA.",
      },
      {
        control: "Activo en IA / Inactivo, Editar (✏️) y Eliminar (🗑️)",
        location: "En cada documento cargado",
        purpose:
          "Activa, desactiva, edita o borra cualquier documento de la base de conocimiento.",
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
      {
        control: "Pestaña 3 · Anuncios FB & IG (Meta Ads + Reels desde Fotos + Guiones IA)",
        location: "Selector superior",
        purpose:
          "Muestra tus campañas de Facebook e Instagram con presupuesto, gasto 30d, alcance, leads y Costo/Resultado en ₡, permite Pausar/Activar anuncios en 1 clic, mide el retorno real en tu CRM, incluye el Creador de Videos / Reels desde Fotos (en Modo Solo Fotos Cinematográfico o Comercial), el Estudio IA de Guiones para grabar Reels en tienda, el Lanzador Directo de Campañas Meta Ads y el Generador IA de Anuncios.",
      },
    ],
  },
  {
    id: "guia-anuncios",
    number: "11C",
    title: "Guía Paso a Paso: Cómo Crear y Publicar Anuncios en Facebook e Instagram (Sin Terceros)",
    route: "/campanas (Pestaña 3)",
    group: "IA Y SISTEMA",
    summary:
      "Receta práctica paso a paso para que cualquier persona del equipo pueda crear un Reel desde fotos o grabarlo en tienda, lanzar la campaña pagada en Facebook e Instagram y medir resultados en colones (₡) sin depender de agencias externas.",
    tip: "Antes de publicar tu primer anuncio, verifica en Meta Business Suite que tu Cuenta Publicitaria esté verificada («Verificar ahora») y con tarjeta activa, y que tu Meta Ad Account ID (ej. act_...) esté guardado en Conexiones y empresa → Meta Cloud API.",
    buttons: [
      {
        control: "Opción Rápida · Crear Video Reel Solo con Fotos (sin grabarse, 2 min)",
        location: "Campañas → 3. Anuncios FB & IG → Creador de Videos / Reels desde Fotos",
        purpose:
          "Sube de 2 a 12 fotos de tus productos (o jálalas directo del Catálogo), elige «📸 Modo Solo Fotos (Cinematográfico limpio)» para generar un video fluido sin textos ni banners encima, o «📣 Modo Comercial» para agregar gancho, precio y CTA («Comenta PRECIO»). Presiona «🎬 Generar Video» para descargarlo con transiciones suaves y música libre de derechos, o copia el «Prompt Cinematográfico IA» listo para herramientas externas como Google Veo, Kling o Shorty Edit.",
      },
      {
        control: "Paso 1 · Crear el Guion y Tomas con IA (2 min)",
        location: "Campañas → 3. Anuncios FB & IG → Estudio IA de Guiones",
        purpose:
          "Escribe el producto o promoción, elige Formato A (Asesor en tienda + acercamientos, 25 seg), Formato B (Solo manos y producto sin rostro, 15 seg) o Formato C (Promo / Temporada), y presiona «Crear Guion + Tomas + Caption con IA». El sistema te entrega el guion hablado, las tomas exactas, textos en pantalla sin faltas de ortografía, la descripción (Caption), hashtags locales y la palabra clave para DM.",
      },
      {
        control: "Paso 2 · Grabar el Video en Tienda con el Celular (10 min)",
        location: "En tu tienda física (formato vertical 9:16)",
        purpose:
          "Graba siempre en vertical (9:16), con buena luz de frente (limpia el lente del celular). Si usas Formato A, usa camiseta de la empresa + micrófono de solapa y graba 3 tomas cortas de acercamiento al producto/etiqueta/suela. Si usas Formato B, gira el producto lento en tus manos mostrando los detalles clave.",
      },
      {
        control: "Paso 3 · Subtítulos Rápidos y Revisión (3 min)",
        location: "App CapCut (gratis en celular o PC)",
        purpose:
          "Une las tomas en CapCut (máximo 15–25 segundos), activa «Subtítulos automáticos» grandes y legibles, coloca arriba el texto gancho generado por el CRM y revisa SIEMPRE la ortografía antes de exportar en 1080p.",
      },
      {
        control: "Paso 4 · Crear la Campaña y Segmentación desde el CRM (1 min)",
        location: "Campañas → 3. Anuncios FB & IG → «Crear Campaña Directo en Meta Ads»",
        purpose:
          "Pon nombre claro (ej. «Garmin Mensajes San Carlos Nov»), elige Objetivo «Conversaciones / Mensajes» (recomendado para cerrar ventas por WhatsApp/IG), presupuesto inicial de ₡3.000/día, zona (Ciudad Quesada + La Fortuna, Solo La Fortuna, GAM o Costa Rica) y edades (18–55). Al pulsar «Crear Campaña», queda creada en Meta Ads en estado PAUSADA.",
      },
      {
        control: "Paso 5 · Subir el Video en Meta Ads Manager y Encender (2 min)",
        location: "Botón «+ Crear Anuncio en Meta Ads» (arriba en Pestaña 3)",
        purpose:
          "Abre tu campaña pausada en Meta Ads Manager → nivel «Anuncio» → sube el video exportado de CapCut → pega el Caption y Título que copiaste del CRM → selecciona el botón «Enviar mensaje por WhatsApp» (o Instagram/Messenger) y publica. También puedes encender o pausar la campaña en 1 clic desde tu tabla en impulsa CRM.",
      },
      {
        control: "Paso 6 · Medir Resultados y Dejar que la IA Cierre (días 1 a 7)",
        location: "Tabla de Anuncios en /campanas + /bandeja",
        purpose:
          "Revisa cada 3 días el «Costo / Resultado» en tu CRM: un costo entre ₡100 y ₡400 por conversación es excelente (si supera ₡800–₡1.000 tras 4 días sin ventas, pausa ese anuncio y graba otro gancho). Mientras corre, tu Agente de IA responde mensajes y comentarios («Precio», «Ubicación»), filtra «🔥 Compra real» y agenda seguimientos en Ventas Kanban automáticamente.",
      },
    ],
  },
  {
    id: "configuracion",
    number: "12",
    title: "Conexiones y Empresa (7 Pestañas de Configuración y Control SaaS)",
    route: "/configuracion",
    group: "IA Y SISTEMA",
    summary:
      "Centro técnico y administrativo del CRM. Permite subir tu logotipo propio, configurar correos, WhatsApp/Messenger/Instagram/Meta Ads, ajustar la IA, gestionar vendedores, activar respaldos semanales automáticos y (para SuperAdmin) controlar todas las compañías.",
    buttons: [
      {
        control: "Pestaña 1 · Empresa y Proforma (+ Subir Logo)",
        location: "Primera pestaña",
        purpose:
          "Sube tu propio logotipo (PNG/JPG/WebP) para que aparezca en las Proformas PDF, y edita nombre comercial, razón social, cédula jurídica, dirección, teléfonos, SINPE Móvil, consecutivo, color, pie de página y cuentas bancarias.",
      },
      {
        control: "Pestaña 2 · Correo SMTP / IMAP",
        location: "Segunda pestaña",
        purpose:
          "Administra múltiples correos corporativos (ventas@ y uniformes@). Incluye botones para Agregar cuenta, Guardar, Probar conexión SMTP/IMAP, Sincronizar bandeja y marcar cuenta Predeterminada.",
      },
      {
        control: "Pestaña 3 · Meta Cloud API, Messenger, Instagram y Meta Ads",
        location: "Tercera pestaña",
        purpose:
          "URL del Webhook universal (con Copiar), Token Permanente, Phone Number ID, WABA ID, Meta Ad Account ID (act_...) y bloque dedicado de Facebook Messenger e Instagram Direct (Page ID, IG ID auto-detectado, Token de Página y botón «Verificar Messenger e Instagram»).",
      },
      {
        control: "Pestaña 4 · Agente de IA",
        location: "Cuarta pestaña",
        purpose:
          "Controla el interruptor global («IA Automática 24/7» vs «Modo Manual Total»), el Alcance de la IA («Solo Clientes Nuevos» vs «Todos los Clientes»), API Key de Gemini, botón «Probar Conexión IA», personalidad del bot y plantillas editables para búsquedas por foto.",
      },
      {
        control: "Pestaña 5 · Equipo y Vendedores",
        location: "Quinta pestaña",
        purpose:
          "Crea usuarios individuales de acceso para tus vendedores (aislados dentro de tu empresa), permite Pausar acceso, Cambiar contraseña o Eliminar vendedores.",
      },
      {
        control: "Pestaña 6 · Respaldos y Nube (+ Respaldo Semanal Automático)",
        location: "Sexta pestaña",
        purpose:
          "Todos los domingos 2:00 AM (CR) envía automáticamente un respaldo completo (.json) por correo (incluye clientes, chats, proformas, campañas, ciclo 1-7-90, catálogo y usuarios). Incluye «Enviar respaldo por correo ahora», descarga/restauración aislada por empresa y limpieza segura de datos de prueba.",
      },
      {
        control: "Pestaña 7 · Admin Compañías (SaaS · Solo SuperAdmin)",
        location: "Séptima pestaña (exclusiva SuperAdmin)",
        purpose:
          "Lista todas las compañías registradas con métricas en vivo (clientes, chats, proformas, vendedores, conexiones), selector de plan (Básico/Pro/Enterprise), botón «Entrar al espacio», restablecer clave del dueño y «Suspender / Activar» empresa por suscripción.",
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
