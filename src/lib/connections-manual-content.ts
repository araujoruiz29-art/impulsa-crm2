export interface ConnectionLink {
  label: string;
  url: string;
  note: string;
}

export interface ConnectionStep {
  title: string;
  details: string[];
  link?: { label: string; url: string };
}

export interface ConnectionGuideSection {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  badge: string;
  prerequisites: string[];
  steps: ConnectionStep[];
  crmFields: Array<{ field: string; whereToFind: string }>;
  warning?: string;
}

export const QUICK_PORTAL_LINKS: ConnectionLink[] = [
  {
    label: "impulsa CRM · Registro de Nueva Empresa",
    url: "https://impulsa-crm2.vercel.app/login?mode=register",
    note: "Enlace para compartir con otra empresa y que cree su cuenta privada.",
  },
  {
    label: "impulsa CRM · Configuración y Conexiones",
    url: "https://impulsa-crm2.vercel.app/configuracion",
    note: "Pantalla donde se pegan los tokens de Meta, correos SMTP/IMAP y Gemini IA.",
  },
  {
    label: "Meta for Developers (Apps y Webhooks)",
    url: "https://developers.facebook.com/apps",
    note: "Aquí se crea la app de Meta, se registra el número de WhatsApp y se configura el Webhook.",
  },
  {
    label: "Meta Business · Usuarios del Sistema (Token Permanente)",
    url: "https://business.facebook.com/settings/system-users",
    note: "Aquí se genera el Token Permanente que NO vence cada 24 horas.",
  },
  {
    label: "Meta Business · Cuentas de WhatsApp (WhatsApp Manager)",
    url: "https://business.facebook.com/wa/manage/home/",
    note: "Administra números registrados, perfil, plantillas aprobadas y método de pago.",
  },
  {
    label: "Meta Business · Páginas de Facebook y Cuentas de Instagram",
    url: "https://business.facebook.com/settings/instagram-accounts",
    note: "Vincula tu cuenta comercial de Instagram con tu Página de Facebook para recibir DMs.",
  },
  {
    label: "Google AI Studio (Llave API de Gemini IA)",
    url: "https://aistudio.google.com/apikey",
    note: "Crea tu API Key de Gemini para activar el Agente IA, transcripción de audios y visión.",
  },
  {
    label: "Google · Contraseñas de Aplicación (Gmail / Workspace)",
    url: "https://myaccount.google.com/apppasswords",
    note: "Genera contraseña especial de 16 letras si conectas un correo de Gmail por SMTP/IMAP.",
  },
];

export const CONNECTION_GUIDES: ConnectionGuideSection[] = [
  {
    id: "whatsapp",
    number: "01",
    title: "WhatsApp Business Oficial (Meta Cloud API)",
    subtitle: "Recibe y responde textos, notas de voz, fotos y proformas PDF 24/7 con tu número real.",
    badge: "WHATSAPP CLOUD API",
    prerequisites: [
      "Un Portafolio Comercial en Meta Business Suite (business.facebook.com).",
      "Un número de teléfono que NO esté activo al mismo tiempo en la app tradicional de WhatsApp (o migrado en modo Coexistencia) y pueda recibir un SMS o llamada de verificación.",
      "Una tarjeta de débito/crédito agregada en Meta Business (responder a clientes dentro de las primeras 24 horas es GRATIS; Meta pide tarjeta solo para habilitar envíos en producción).",
    ],
    steps: [
      {
        title: "Crear la App en Meta for Developers",
        link: { label: "Abrir Meta for Developers", url: "https://developers.facebook.com/apps" },
        details: [
          "Haz clic en «Crear app» → elige tipo «Negocios / Otro» → selecciona tu Portafolio Comercial.",
          "En el panel de la app, busca el producto «WhatsApp» y haz clic en «Configurar».",
        ],
      },
      {
        title: "Registrar tu número real en «Paso 2: Configuración de producción»",
        link: { label: "WhatsApp Manager", url: "https://business.facebook.com/wa/manage/home/" },
        details: [
          "En WhatsApp → Configuración de la API → «Paso 2: Configuración de producción» → «Registra tu número de teléfono de WhatsApp».",
          "Ingresa tu número con código de país (ej. +506 8449-1975), confirma el código por SMS o llamada y espera a que aparezca en verde: «Registrado».",
          "Anota los dos números que salen ahí mismo: «Identificador de número de teléfono (Phone Number ID)» y «Messaging Account ID (WABA ID)».",
          "IMPORTANTE: Enciende el interruptor «Suscribir webhooks» a la derecha del nombre de tu cuenta.",
        ],
      },
      {
        title: "Configurar el Webhook 24/7 apuntando a impulsa CRM",
        details: [
          "En la misma pantalla abre «Configurar webhooks» → clic en «Editar».",
          "URL de devolución de llamada (Callback URL): https://impulsa-crm2.vercel.app/api/webhooks/meta",
          "Token de verificación (Verify Token): copia exactamente el que aparece en tu CRM → Conexiones y empresa → Meta Cloud API & WhatsApp (cada empresa tiene su propio Verify Token único).",
          "Haz clic en «Verificar y guardar». Luego entra a «Campos de webhook → Administrar» y suscribe el campo «messages».",
        ],
      },
      {
        title: "Generar el Token Permanente (sin vencimiento de 24 horas)",
        link: {
          label: "Abrir Usuarios del Sistema en Meta",
          url: "https://business.facebook.com/settings/system-users",
        },
        details: [
          "Haz clic en «+ Agregar» → Nombre: «Impulsa CRM» → Rol: «Admin» (Administrador) → «Create system user».",
          "Selecciona «Impulsa CRM» → clic en «Asignar activos»: marca tu App (Control total) y tu Cuenta de WhatsApp (Control total) → Guardar cambios.",
          "Haz clic en «Generar token nuevo» → elige tu App → Expiración: «Nunca (Never)» → marca los permisos: whatsapp_business_messaging y whatsapp_business_management.",
          "Copia el token generado (empieza con EAA...) y guárdalo en un lugar seguro (Meta solo lo muestra una vez).",
        ],
      },
      {
        title: "Agregar método de pago y pasar la App a modo Activo (Live)",
        link: { label: "Facturación de WhatsApp en Meta", url: "https://business.facebook.com/billing_hub/accounts" },
        details: [
          "En «Paso 2: Configuración de producción» completa «Agrega la información de pago» para evitar el error #131042.",
          "En la barra superior de Meta Developers, cambia el modo de la app de «Desarrollo» a «Activo (Live)» para recibir mensajes de cualquier cliente.",
        ],
      },
      {
        title: "Pegar los datos en impulsa CRM y verificar",
        link: { label: "Abrir Configuración del CRM", url: "https://impulsa-crm2.vercel.app/configuracion" },
        details: [
          "Entra a Conexiones y empresa → pestaña «Meta Cloud API & WhatsApp».",
          "Pega: Token de Acceso Permanente, WhatsApp Phone Number ID, WABA ID y URL Pública HTTPS (https://impulsa-crm2.vercel.app).",
          "Haz clic en «Guardar Configuración» y luego en «Verificar Conexión Meta» (debe salir ✅ Calidad: GREEN).",
          "Prueba real: escribe un WhatsApp desde OTRO teléfono hacia tu número empresarial y verifica que entre en Conversaciones.",
        ],
      },
    ],
    crmFields: [
      { field: "Token de Acceso Permanente", whereToFind: "Meta Business → Usuarios del sistema → Generar token (Nunca)" },
      { field: "WhatsApp Phone Number ID", whereToFind: "Meta Developers → Paso 2 → debajo de tu número registrado" },
      { field: "WhatsApp Business Account ID (WABA)", whereToFind: "Meta Developers → Paso 2 → Messaging Account ID" },
      { field: "Verify Token del Webhook", whereToFind: "El mismo texto escrito en el CRM y en Meta → Configurar webhooks" },
      { field: "URL Pública HTTPS", whereToFind: "https://impulsa-crm2.vercel.app (o tu dominio propio)" },
    ],
    warning:
      "En números reales de producción, Meta NO permite enviar la plantilla demo «hello_world» (error #131058). Para probar un número real, envía primero un WhatsApp desde otro teléfono hacia tu número comercial para abrir la ventana gratuita de 24 horas.",
  },
  {
    id: "messenger",
    number: "02",
    title: "Facebook Messenger (Mensajes de tu Página)",
    subtitle: "Recibe los mensajes directos de tu Página de Facebook en la misma Bandeja de Conversaciones.",
    badge: "MESSENGER API",
    prerequisites: [
      "Ser Administrador de la Página de Facebook de tu empresa.",
      "Tener la misma App creada en Meta for Developers (puedes usar la misma app que ya creaste para WhatsApp).",
    ],
    steps: [
      {
        title: "Agregar el producto Messenger a tu App de Meta",
        link: { label: "Abrir Meta for Developers", url: "https://developers.facebook.com/apps" },
        details: [
          "Abre tu App en Meta Developers → menú izquierdo «Agregar productos» → busca «Messenger» y haz clic en «Configurar».",
        ],
      },
      {
        title: "Vincular tu Página de Facebook y obtener el Page ID",
        link: { label: "Páginas en Meta Business", url: "https://business.facebook.com/settings/pages" },
        details: [
          "En Messenger → Configuración de la API de Messenger → «Tokens de acceso» → haz clic en «Conectar página» y selecciona la Página de tu empresa.",
          "Copia el «Identificador de página (Page ID)» (es un número largo de 15 dígitos).",
        ],
      },
      {
        title: "Configurar el Webhook de Messenger",
        details: [
          "En Messenger → Configuración de webhooks → clic en «Configurar webhooks»:",
          "URL de devolución de llamada: https://impulsa-crm2.vercel.app/api/webhooks/meta",
          "Token de verificación: el mismo Verify Token de tu empresa en el CRM.",
          "Suscribe tu Página a los campos: «messages» y «messaging_postbacks».",
        ],
      },
      {
        title: "Agregar permisos al Usuario del Sistema y verificar en el CRM",
        link: { label: "Usuarios del Sistema", url: "https://business.facebook.com/settings/system-users" },
        details: [
          "En Usuarios del sistema → selecciona «Impulsa CRM» → Asignar activos → agrega tu Página de Facebook (Control total).",
          "Genera un Token de Página (o regenera tu Token Permanente) con los permisos: pages_messaging, pages_show_list, instagram_basic e instagram_manage_messages.",
          "En tu CRM → Conexiones y empresa → Meta Cloud API → sección «Facebook Messenger e Instagram Direct»: pega tu «Facebook Page ID» y el «Token de Página».",
          "Haz clic en «Verificar Messenger e Instagram»: el CRM validará tu Página y detectará automáticamente tu «Instagram Business Account ID» vinculado.",
        ],
      },
    ],
    crmFields: [
      { field: "Facebook Page ID", whereToFind: "Meta Business → Páginas → ID debajo del nombre de tu Página" },
      { field: "Instagram Business Account ID", whereToFind: "Se detecta automáticamente al pulsar «Verificar Messenger e Instagram»" },
      { field: "Token de Página (Page Access Token)", whereToFind: "Meta Developers → Messenger → Tokens de acceso (o Token Permanente con la Página asignada)" },
      { field: "Webhook URL", whereToFind: "https://impulsa-crm2.vercel.app/api/webhooks/meta" },
    ],
  },
  {
    id: "instagram",
    number: "03",
    title: "Instagram Direct (DM) y Meta Lead Ads (Formularios)",
    subtitle: "Centraliza mensajes directos de Instagram y prospectos que llenan formularios en anuncios de Facebook/IG.",
    badge: "INSTAGRAM & LEAD ADS",
    prerequisites: [
      "Tu cuenta de Instagram debe ser «Cuenta Profesional (Empresa o Creador)» y estar vinculada a tu Página de Facebook.",
      "Para Lead Ads, debes tener una Cuenta Publicitaria en Meta Business.",
    ],
    steps: [
      {
        title: "Vincular Instagram Profesional con tu Página de Facebook",
        link: {
          label: "Cuentas de Instagram en Meta Business",
          url: "https://business.facebook.com/settings/instagram-accounts",
        },
        details: [
          "En la app de Instagram en tu celular: Configuración → Tipo de cuenta → Cambiar a cuenta profesional (Empresa).",
          "En la misma app de Instagram: Configuración → Mensajes y respuestas a historias → Controles de mensajes → Activar «Permitir acceso a los mensajes» (herramientas conectadas).",
          "En Meta Business → Cuentas de Instagram → vincula tu cuenta y verifica que quede conectada a tu Página de Facebook.",
        ],
      },
      {
        title: "Activar Webhooks de Instagram en Meta Developers",
        link: { label: "Abrir Meta for Developers", url: "https://developers.facebook.com/apps" },
        details: [
          "En tu App de Meta → Messenger (o producto Instagram) → «Configuración de Instagram» → vincula tu cuenta de Instagram.",
          "En Webhooks → selecciona objeto «Instagram» → pega la URL https://impulsa-crm2.vercel.app/api/webhooks/meta y tu Verify Token.",
          "Suscribe el campo «messages» (y agrega los permisos instagram_basic e instagram_manage_messages al token).",
        ],
      },
      {
        title: "Conectar Formularios de Meta Lead Ads (Opcional)",
        details: [
          "En Meta Developers → Webhooks → selecciona objeto «Page» (Página) → suscribe el campo «leadgen».",
          "Agrega el permiso «leads_retrieval» al Usuario del Sistema «Impulsa CRM».",
          "Cada vez que alguien llene un formulario en tus anuncios de Facebook o Instagram, el CRM creará automáticamente el contacto en Contactos y abrirá su conversación.",
        ],
      },
    ],
    crmFields: [
      { field: "Meta Ad Account ID / Page ID", whereToFind: "ID de tu Página de Facebook vinculada a Instagram y Lead Ads" },
      { field: "Webhook URL (misma para todos)", whereToFind: "https://impulsa-crm2.vercel.app/api/webhooks/meta" },
      { field: "Permisos de Token", whereToFind: "instagram_basic, instagram_manage_messages, leads_retrieval" },
    ],
  },
  {
    id: "correos",
    number: "04",
    title: "Correos Corporativos (SMTP para enviar + IMAP para recibir)",
    subtitle: "Conecta uno o varios buzones (cPanel, Hosting propio, Gmail / Google Workspace o Outlook / Microsoft 365).",
    badge: "SMTP + IMAP MULTICUENTA",
    prerequisites: [
      "Tener la dirección de correo completa y su contraseña (en Gmail o Microsoft 365 requiere Contraseña de Aplicación).",
      "Confirmar que tu proveedor tenga habilitado acceso IMAP y SMTP.",
    ],
    steps: [
      {
        title: "Caso A · Correo de dominio propio (cPanel / Webmail, ej. elcaminantecr.com)",
        details: [
          "Servidor SMTP (salida): mail.tudominio.com · Puerto: 465 · SSL/TLS: Activado (o puerto 587 STARTTLS).",
          "Servidor IMAP (entrada): mail.tudominio.com · Puerto: 993 · SSL/TLS: Activado.",
          "Usuario SMTP e IMAP: tu correo completo (ej. ventas@tudominio.com).",
          "Contraseña: la misma contraseña con la que entras a tu Webmail o Thunderbird.",
        ],
      },
      {
        title: "Caso B · Gmail o Google Workspace",
        link: {
          label: "Generar Contraseña de Aplicación de Google",
          url: "https://myaccount.google.com/apppasswords",
        },
        details: [
          "Activa la «Verificación en 2 pasos» en tu cuenta de Google si aún no está activa.",
          "Abre el enlace de «Contraseñas de aplicación», ponle nombre «impulsa CRM» y copia la clave de 16 letras (sin espacios).",
          "En el CRM usa: SMTP smtp.gmail.com (puerto 465 SSL) · IMAP imap.gmail.com (puerto 993 SSL) · Contraseña: la clave de 16 letras.",
        ],
      },
      {
        title: "Caso C · Outlook / Microsoft 365",
        link: {
          label: "Seguridad de Cuenta Microsoft",
          url: "https://account.microsoft.com/security",
        },
        details: [
          "SMTP: smtp.office365.com · Puerto: 587 · SSL/TLS (STARTTLS).",
          "IMAP: outlook.office365.com · Puerto: 993 · SSL/TLS.",
          "Si tienes verificación en 2 pasos, crea una contraseña de aplicación en Seguridad de Microsoft.",
        ],
      },
      {
        title: "Configurar, probar y sincronizar en impulsa CRM",
        link: { label: "Abrir Pestaña de Correos", url: "https://impulsa-crm2.vercel.app/configuracion" },
        details: [
          "Entra a Conexiones y empresa → pestaña «Correo SMTP / IMAP».",
          "Puedes agregar varias cuentas (ej. ventas@ y uniformes@) y marcar una como «Predeterminada».",
          "Ingresa la contraseña, haz clic en «Guardar cuenta», luego en «Probar SMTP + IMAP» (debe confirmar ambos en verde ✅) y por último «Sincronizar bandeja».",
        ],
      },
    ],
    crmFields: [
      { field: "SMTP Host / Puerto", whereToFind: "mail.tudominio.com (465 SSL) · smtp.gmail.com (465) · smtp.office365.com (587)" },
      { field: "IMAP Host / Puerto", whereToFind: "mail.tudominio.com (993 SSL) · imap.gmail.com (993) · outlook.office365.com (993)" },
      { field: "Usuario y Contraseña", whereToFind: "Correo completo + contraseña del buzón (o clave de aplicación en Gmail)" },
    ],
  },
  {
    id: "ia",
    number: "05",
    title: "Agente de Inteligencia Artificial (Google Gemini API)",
    subtitle: "Activa respuestas inteligentes 24/7, transcripción de notas de voz, borradores y extracción de proformas.",
    badge: "GOOGLE GEMINI IA",
    prerequisites: [
      "Una cuenta de Google (Gmail o Google Workspace) para ingresar a Google AI Studio.",
    ],
    steps: [
      {
        title: "Generar tu API Key en Google AI Studio",
        link: { label: "Abrir Google AI Studio (API Keys)", url: "https://aistudio.google.com/apikey" },
        details: [
          "Inicia sesión con tu cuenta de Google y haz clic en «Create API key».",
          "Copia la llave generada (empieza con AIza... o AQ....).",
        ],
      },
      {
        title: "Conectar la llave y definir la personalidad en impulsa CRM",
        link: { label: "Abrir Pestaña Agente de IA", url: "https://impulsa-crm2.vercel.app/configuracion" },
        details: [
          "Entra a Conexiones y empresa → pestaña «Agente de IA».",
          "Proveedor IA: Google Gemini API · Modelo recomendado: gemini-flash-lite-latest (el CRM incluye respaldo automático entre modelos).",
          "Pega tu API Key, redacta en «Instrucciones / Personalidad del Agente» cómo quieres que hable el bot, y haz clic en «Guardar Configuración» → «Probar Conexión IA (Gemini)».",
          "Usa el interruptor superior si deseas trabajar en «IA Automática 24/7» o en «Respuesta Manual Total».",
        ],
      },
      {
        title: "Cargar horarios, políticas y precios en Conocimiento y Docs",
        link: { label: "Abrir Conocimiento y Docs", url: "https://impulsa-crm2.vercel.app/conocimiento" },
        details: [
          "Agrega documentos con tu horario normal, horario de temporada, ubicación, cuentas bancarias, garantías y preguntas frecuentes.",
          "Asegúrate de que aparezcan en verde «Activo en IA».",
        ],
      },
    ],
    crmFields: [
      { field: "API Key", whereToFind: "Google AI Studio (aistudio.google.com/apikey)" },
      { field: "Modelo", whereToFind: "gemini-flash-lite-latest (recomendado)" },
      { field: "Modo Global", whereToFind: "IA Automática 24/7 o Respuesta Manual Total (1 clic en Bandeja o Configuración)" },
    ],
  },
];

export const TROUBLESHOOTING_ROWS = [
  {
    error: "(#131058) Hello World templates can only be sent from Public Test Numbers",
    cause: "Tu número ya es real de producción; Meta bloquea la plantilla demo hello_world.",
    fix: "No es un fallo de conexión. Escribe un WhatsApp desde otro teléfono hacia tu número empresarial para abrir la ventana gratis de 24h y usa «Enviar Texto Libre».",
  },
  {
    error: "(#131042) Business eligibility payment issue",
    cause: "Falta registrar una tarjeta de pago en la cuenta de WhatsApp Business en Meta.",
    fix: "Entra a Meta Business → Facturación → agrega una tarjeta. Responder dentro de 24 horas sigue siendo gratuito.",
  },
  {
    error: "No entran mensajes de WhatsApp al CRM",
    cause: "Interruptor «Suscribir webhooks» apagado, URL vieja o App en modo Desarrollo.",
    fix: "En Meta Developers verifica: 1) Switch «Suscribir webhooks» encendido, 2) URL exacta https://impulsa-crm2.vercel.app/api/webhooks/meta con «messages» suscrito, 3) App en modo Activo (Live).",
  },
  {
    error: "El botón «Genera un token» de Meta se queda girando o no llega el SMS",
    cause: "Bug frecuente del asistente rápido de Meta o bloqueo de SMS en Costa Rica.",
    fix: "Usa el enlace directo https://business.facebook.com/settings/system-users para crear el usuario «Impulsa CRM» (Admin) y generar el token permanente manualmente.",
  },
  {
    error: "Error de autenticación al conectar Gmail (SMTP/IMAP)",
    cause: "Google bloquea contraseñas normales para conexiones IMAP/SMTP.",
    fix: "Activa verificación en 2 pasos y crea una Contraseña de Aplicación de 16 letras en https://myaccount.google.com/apppasswords.",
  },
  {
    error: "No autorizado. Inicia sesión. (401)",
    cause: "La sesión venció o cambió la contraseña/clave secreta del servidor.",
    fix: "Presiona F5 para recargar la página e inicia sesión de nuevo con tu correo y contraseña.",
  },
];
