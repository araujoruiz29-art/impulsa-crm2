import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_BANK_ACCOUNTS = [
  {
    bank: "Banco Nacional de Costa Rica (BN)",
    accountNumber: "100-01-012-009956-0",
    iban: "CR93015101210010099565",
  },
  {
    bank: "Banco de Costa Rica (BCR)",
    accountNumber: "215-0009236-3",
    iban: "CR82015201215000923631",
  },
  {
    bank: "Banco BAC",
    accountNumber: "917581761",
    iban: "CR19010200009175817612",
  },
  {
    bank: "Banco Davivienda",
    accountNumber: "",
    iban: "CR65010406940300320211",
  },
];

const DEFAULT_AI_SYSTEM_PROMPT = `Eres el asistente comercial de Caminante Corporativo (Esquivel y Alfaro El Caminante S.A), ubicados en San Carlos, Alajuela, Costa Rica.
Nos especializamos en:
1. Uniformes (corporativos, escolares, industriales)
2. Bordados computarizados y personalización
3. Artículos promocionales
4. Artículos deportivos
5. Zapatos y botas de seguridad

Reglas de atención:
- Responde en español de Costa Rica, con tono cordial, profesional y ágil.
- Todos los precios se manejan en Colones costarricenses (₡) con IVA 13% incluido (también podemos generar proforma con IVA 13% desglosado si el cliente lo solicita).
- Cuando un cliente quiera cotizar, solicita: producto, cantidad aproximada, tallas o especificaciones, si requiere bordado/logo, nombre de empresa/contacto y correo para enviar la Factura Proforma PDF.
- Si preguntan por métodos de pago: aceptamos SINPE Móvil (8691-1975) y transferencias en BN, BCR, BAC y Davivienda.`;

const DEFAULT_AI_KNOWLEDGE_BASE = `Empresa: Esquivel y Alfaro El Caminante S.A (Caminante Corporativo)
Cédula Jurídica: 3-101-260251
Dirección: 200 m. este de la Escuela Juan Chaves, San Carlos, Alajuela, Costa Rica
Teléfono: 2460-1975 | WhatsApp: 8449-1975 | SINPE Móvil: 8691-1975
Correos: ventas@elcaminantecr.com | uniformes@elcaminantecr.com | Factura Electrónica: fe@elcaminantecr.com
Moneda: Colones (₡) con IVA 13% incluido (opción de IVA desglosado disponible).
Condiciones de pago habituales: Contado, 50% adelanto para pedidos personalizados/bordados, o Crédito 30 días para instituciones/clientes corporativos autorizados.
Tiempos de entrega: Artículos en stock 1-3 días hábiles; uniformes con bordado 5-10 días hábiles según cantidad.`;

async function main() {
  // 1. Company Settings
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Esquivel y Alfaro El Caminante S.A",
      brandName: "Caminante Corporativo",
      legalId: "Cédula Jurídica N° 3-101-260251",
      address: "200 m. este de la Escuela Juan Chaves",
      phone: "2460-1975",
      whatsapp: "8449-1975",
      sinpePhone: "8691-1975",
      email: "ventas@elcaminantecr.com",
      secondaryEmail: "uniformes@elcaminantecr.com",
      billingEmail: "fe@elcaminantecr.com",
      defaultSeller: "Jelsing R.",
      defaultCurrency: "CRC",
      defaultTaxRate: 0.13,
      defaultTaxMode: "IVA_INCLUIDO",
      defaultPaymentTerms: "CONTADO",
      defaultValidity: "30 días",
      nextQuoteNumber: 1409,
      footerMotto: 'Gracias por preferirnos! "Jesús es mi Señor"',
      bankAccountsJson: JSON.stringify(DEFAULT_BANK_ACCOUNTS),
      logoPath: "/brand/image1.png",
      sinpeLogoPath: "/brand/image3.png",
    },
  });

  // 2. Integration Settings
  await prisma.integrationSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      smtpFromName: "Caminante Corporativo",
      smtpFromEmail: "ventas@elcaminantecr.com",
      metaVerifyToken: "caminante_meta_verify_2026",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      aiSystemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
      aiKnowledgeBase: DEFAULT_AI_KNOWLEDGE_BASE,
    },
  });

  // 3. Products (5 core business lines of Caminante Corporativo)
  const products = [
    {
      sku: "DEP-TAT-001",
      name: "COLCHONETA ARTES MARCIALES",
      category: "Artículos Deportivos",
      description: "TATAMI 1X1\nEspuma EVA de alta densidad encajable, ideal para artes marciales y gimnasio.",
      unit: "Unidad",
      price: 15950,
      cost: 10500,
      wholesaleMinQty: 10,
      wholesalePrice: 14800,
    },
    {
      sku: "SEG-BOT-KAY",
      name: "BOTA DE HULE MARCA KAYMAN",
      category: "Zapatos de Seguridad",
      description: "MATERIAL PVC NORMAL\nSUELA AMARILLA\nCAÑA NEGRA\nDiseñada para alta resistencia, confort y durabilidad en ambientes húmedos.",
      unit: "Par",
      price: 5876,
      cost: 3800,
      wholesaleMinQty: 12,
      wholesalePrice: 5200,
    },
    {
      sku: "SEG-BOT-DIN",
      name: "BOTA DE HULE MARCA DINOSAURIO",
      category: "Zapatos de Seguridad",
      description: "MATERIAL PVC NORMAL\nSUELA ROJA\nCAÑA NEGRA\nAlta resistencia, confort y durabilidad en ambientes de trabajo predominantemente húmedos.",
      unit: "Par",
      price: 5876,
      cost: 3800,
      wholesaleMinQty: 12,
      wholesalePrice: 5200,
    },
    {
      sku: "SEG-ZAP-001",
      name: "ZAPATO DE SEGURIDAD PUNTA COMPOSITE",
      category: "Zapatos de Seguridad",
      description: "Cuero hidrofugado, suela antideslizante dieléctrica, plantilla ergonómica.\nTallas disponibles: 36 a 46.",
      unit: "Par",
      price: 34500,
      cost: 23000,
      wholesaleMinQty: 6,
      wholesalePrice: 31900,
    },
    {
      sku: "UNI-POL-001",
      name: "CAMISA POLO CORPORATIVA DRY-FIT",
      category: "Uniformes",
      description: "Tela fresca anti-transpirante 100% poliéster.\nIncluye bordado de logotipo en pecho izquierdo.\nTallas S a XXL.",
      unit: "Unidad",
      price: 9800,
      cost: 5900,
      wholesaleMinQty: 12,
      wholesalePrice: 8900,
    },
    {
      sku: "UNI-ESC-001",
      name: "UNIFORME ESCOLAR COMPLETO",
      category: "Uniformes",
      description: "Camisa institucional con escudo bordado + pantalón/enagua en tela resistente.\nTallas juveniles y adulto.",
      unit: "Juego",
      price: 14500,
      cost: 9200,
      wholesaleMinQty: 20,
      wholesalePrice: 13200,
    },
    {
      sku: "BOR-LOG-001",
      name: "SERVICIO DE BORDADO COMPUTARIZADO (PECHO)",
      category: "Bordados",
      description: "Bordado de alta definición hasta 10cm x 10cm.\nHilos resistentes al lavado industrial. Ponchado incluido en pedidos mayores a 12 prendas.",
      unit: "Unidad",
      price: 2500,
      cost: 900,
      wholesaleMinQty: 24,
      wholesalePrice: 1950,
    },
    {
      sku: "PRO-GOR-001",
      name: "GORRA PROMOCIONAL CON BORDADO",
      category: "Artículos Promocionales",
      description: "Gorra acrílica/algodón 6 paneles con broche ajustable.\nIncluye bordado frontal personalizado.",
      unit: "Unidad",
      price: 4200,
      cost: 2300,
      wholesaleMinQty: 25,
      wholesalePrice: 3650,
    },
    {
      sku: "PRO-TER-001",
      name: "TERMO ACERO INOXIDABLE 20 OZ PERSONALIZADO",
      category: "Artículos Promocionales",
      description: "Doble pared térmica frío/calor con grabado láser de logotipo corporativo.",
      unit: "Unidad",
      price: 8500,
      cost: 4900,
      wholesaleMinQty: 20,
      wholesalePrice: 7600,
    },
    {
      sku: "DEP-UNI-001",
      name: "UNIFORME DEPORTIVO SUBLIMADO FULL PRINT",
      category: "Artículos Deportivos",
      description: "Camiseta + pantaloneta en tela microperforada.\nDiseño, números, nombres y patrocinadores incluidos.",
      unit: "Juego",
      price: 13500,
      cost: 8100,
      wholesaleMinQty: 12,
      wholesalePrice: 12200,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { workspaceId_sku: { workspaceId: "default", sku: prod.sku } },
      update: {},
      create: { ...prod, workspaceId: "default" },
    });
  }

  // 4. Sample Clients (including MEP & TICO FRUT from user's Excel)
  const existingClients = await prisma.client.count();
  if (existingClients === 0) {
    const mep = await prisma.client.create({
      data: {
        code: "MEP-SC",
        company: "MEP",
        contactName: "BRAULIO VILLEGAS",
        phone: "8679-1284",
        whatsapp: "50686791284",
        email: "braulio.villegas.artavia@mep.go.cr",
        address: "SAN CARLOS, ALAJUELA",
        stage: "COTIZADO",
        source: "CORREO",
        tags: "institucional,uniformes,deportivo",
        estimatedValue: 15950,
        notes: "Cliente institucional MEP San Carlos. Trabaja a crédito 30 días.",
        assignedTo: "Jelsing R.",
      },
    });

    const ticofrut = await prisma.client.create({
      data: {
        code: "TF-AZ",
        company: "TICO FRUT",
        contactName: "Milton Martínez Obregón",
        phone: "6333-5195",
        whatsapp: "50663335195",
        email: "mmartinez@ticofrut.com",
        address: "AGUAS ZARCAS, SAN CARLOS",
        stage: "SEGUIMIENTO",
        source: "WHATSAPP",
        tags: "agroindustria,botas,seguridad",
        estimatedValue: 117520,
        notes: "Interesado en botas PVC Kayman y Dinosaurio para cuadrillas en Aguas Zarcas. Crédito 30 días.",
        assignedTo: "Jelsing R.",
      },
    });

    const coop = await prisma.client.create({
      data: {
        code: "CS-01",
        company: "Coopelesca Contratistas",
        contactName: "Andrea Rojas",
        phone: "8821-4510",
        whatsapp: "50688214510",
        email: "compras@contratistassc.cr",
        address: "CIUDAD QUESADA, SAN CARLOS",
        stage: "NUEVO",
        source: "META_ADS",
        tags: "uniformes,bordados,zapatos",
        estimatedValue: 485000,
        notes: "Consultó por 30 camisas polo bordadas y 10 pares de zapatos de seguridad.",
        assignedTo: "Jelsing R.",
        metaCampaign: "Campaña Uniformes Corporativos SC",
      },
    });

    const acad = await prisma.client.create({
      data: {
        code: "AD-09",
        company: "Academia Deportiva Norte",
        contactName: "Carlos Solís",
        phone: "8710-3322",
        whatsapp: "50687103322",
        email: "direccion@academianorte.cr",
        address: "LA FORTUNA, SAN CARLOS",
        stage: "NEGOCIACION",
        source: "WHATSAPP",
        tags: "deportivo,promocionales",
        estimatedValue: 324000,
        notes: "Requiere 24 uniformes deportivos sublimados y 24 termos promocionales.",
        assignedTo: "Jelsing R.",
      },
    });

    // 5. Initial Quote #1408 matching user's exact Excel proforma
    const q1408 = await prisma.quote.create({
      data: {
        number: 1408,
        clientId: mep.id,
        clientCode: mep.code,
        clientCompany: mep.company,
        clientContact: mep.contactName,
        clientAddress: mep.address,
        clientPhone: mep.phone,
        clientEmail: mep.email,
        seller: "Jelsing R.",
        jobTitle: "UNIFORMES ESCOLARES",
        paymentTerms: "CREDITO",
        validity: "30 días",
        currency: "CRC",
        taxMode: "IVA_INCLUIDO",
        taxRate: 0.13,
        subtotal: 15950,
        discountAmount: 0,
        taxAmount: 0,
        total: 15950,
        status: "ENVIADA",
        sentAt: new Date(),
        sentVia: "CORREO",
        items: {
          create: [
            {
              sortOrder: 0,
              quantity: 1,
              title: "COLCHONETA ARTES MARCIALES",
              description: "TATAMI 1X1",
              unitPrice: 15950,
              lineTotal: 15950,
            },
          ],
        },
      },
    });

    // 6. Initial Conversations
    await prisma.conversation.create({
      data: {
        channel: "WHATSAPP",
        externalId: "50688214510",
        subject: "Consulta Uniformes y Zapatos de Seguridad",
        clientId: coop.id,
        status: "ABIERTA",
        aiEnabled: true,
        unreadCount: 1,
        lastMessagePreview: "Buenas tardes, ocupo cotizar 30 polos bordadas y 10 pares de zapatos de seguridad punta composite.",
        messages: {
          create: [
            {
              direction: "INBOUND",
              senderName: "Andrea Rojas",
              senderRole: "CLIENT",
              body: "Buenas tardes, ocupo cotizar 30 camisas polo dry-fit bordadas con nuestro logo y 10 pares de zapatos de seguridad punta composite. ¿Me pueden enviar proforma con IVA incluido?",
              status: "DELIVERED",
            },
          ],
        },
      },
    });

    await prisma.conversation.create({
      data: {
        channel: "EMAIL",
        externalId: "braulio.villegas.artavia@mep.go.cr",
        subject: "Proforma 1408 - MEP (Colchoneta Artes Marciales)",
        clientId: mep.id,
        status: "ABIERTA",
        aiEnabled: true,
        unreadCount: 0,
        lastMessagePreview: "Adjunto proforma solicitada #1408 para su revisión.",
        messages: {
          create: [
            {
              direction: "OUTBOUND",
              senderName: "Jelsing R.",
              senderRole: "AGENT",
              subject: "Proforma 1408 - MEP",
              body: "Estimado Braulio,\n\nAdjunto proforma solicitada #1408 correspondiente a la colchoneta de artes marciales Tatami 1x1.\n\nQuedamos atentos a cualquier consulta.\nSaludos,\nCaminante Corporativo",
              attachmentName: "1408-MEP.pdf",
              attachmentUrl: `/api/quotes/${q1408.id}/pdf`,
              status: "SENT",
            },
          ],
        },
      },
    });

    // 7. Initial Activities
    await prisma.activity.createMany({
      data: [
        {
          clientId: mep.id,
          quoteId: q1408.id,
          type: "COTIZACION",
          title: "Proforma #1408 generada (₡15 950,00)",
          description: "Importada del formato base 1408-MEP.xlsm con IVA incluido.",
          completed: true,
        },
        {
          clientId: ticofrut.id,
          type: "TAREA",
          title: "Dar seguimiento a cotización de botas Kayman / Dinosaurio",
          description: "Confirmar cantidades por talla con Milton Martínez.",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          completed: false,
        },
        {
          clientId: coop.id,
          type: "TAREA",
          title: "Preparar proforma de 30 polos bordadas + 10 zapatos",
          description: "Solicitar arte del logotipo para ponchado.",
          dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000),
          completed: false,
        },
        {
          clientId: acad.id,
          type: "NOTA",
          title: "Cliente revisando propuesta de uniformes deportivos",
          description: "Interesado en pago 50% adelanto por SINPE Móvil.",
          completed: true,
        },
      ],
    });
  }

  // 8. Default Automation Rules
  const existingRules = await prisma.automationRule.count();
  if (existingRules === 0) {
    await prisma.automationRule.createMany({
      data: [
        {
          name: "Bienvenida instantánea a Leads de Meta Ads",
          description: "Cuando entra un prospecto desde Facebook/Instagram Lead Ads, crea su ficha, lo coloca en 'Nuevo' y envía bienvenida por WhatsApp.",
          trigger: "NEW_META_LEAD",
          channel: "WHATSAPP",
          delayHours: 0,
          actionType: "SEND_TEMPLATE",
          templateText: "¡Hola {{contacto}}! Gracias por escribir a Caminante Corporativo. Recibimos tu solicitud desde Meta. ¿En qué podemos cotizarte hoy (uniformes, bordados, promocionales, deportivos o zapatos de seguridad)?",
          targetStage: "CONTACTADO",
          active: true,
        },
        {
          name: "Respuesta inteligente de IA en WhatsApp",
          description: "El Agente de IA responde automáticamente consultas nuevas de WhatsApp usando tu catálogo en colones (IVA 13% incluido).",
          trigger: "NEW_WHATSAPP_MESSAGE",
          channel: "WHATSAPP",
          delayHours: 0,
          actionType: "AI_REPLY",
          templateText: "",
          active: true,
        },
        {
          name: "Seguimiento automático a proformas sin respuesta (48h)",
          description: "Si una Factura Proforma enviada lleva más de 48 horas sin respuesta, envía recordatorio cordial y crea tarea de seguimiento.",
          trigger: "QUOTE_NO_RESPONSE",
          channel: "WHATSAPP",
          delayHours: 48,
          actionType: "SEND_FOLLOWUP",
          templateText: "Hola {{contacto}}, le saludamos de Caminante Corporativo. Pasamos a consultar si pudo revisar la Factura Proforma #{{numero}} por {{total}} y si requiere algún ajuste en tallas, bordado o cantidades.",
          targetStage: "SEGUIMIENTO",
          active: true,
        },
        {
          name: "Mover cliente a 'Cotizado' y programar recordatorio",
          description: "Al enviar una proforma por correo o WhatsApp, mueve automáticamente al cliente a la etapa Cotizado y agenda seguimiento.",
          trigger: "QUOTE_SENT",
          channel: "ALL",
          delayHours: 0,
          actionType: "MOVE_STAGE",
          templateText: "Seguimiento automático programado para revisar aprobación de proforma.",
          targetStage: "COTIZADO",
          active: true,
        },
      ],
    });
  }

  // 9. Default Business Knowledge Documents (for AI Agent context)
  const existingDocs = await prisma.knowledgeDocument.count();
  if (existingDocs === 0) {
    await prisma.knowledgeDocument.createMany({
      data: [
        {
          title: "Políticas de Bordado, Ponchado y Tiempos de Entrega",
          category: "Producción y Bordado",
          fileName: "politicas-bordado.txt",
          content:
            "En Caminante Corporativo realizamos bordado computarizado de alta definición. El ponchado (digitalización del logo) es gratuito en pedidos de 12 o más prendas; para cantidades menores tiene un costo único de ₡6 000 IVA incluido. Tiempos de entrega: artículos en stock 1 a 3 días hábiles; pedidos con bordado o sublimación 5 a 10 días hábiles posterior a la aprobación del arte y adelanto del 50%.",
        },
        {
          title: "Condiciones de Pago, Crédito y Cuentas Bancarias CR",
          category: "Pagos y Facturación",
          fileName: "condiciones-pago.txt",
          content:
            "Todos los precios se cotizan en Colones costarricenses (₡) con IVA 13% incluido (también emitimos Factura Proforma con IVA 13% desglosado o exonerado para instituciones como el MEP). Métodos de pago: SINPE Móvil al 8691-1975, transferencias a BN, BCR, BAC y Davivienda. Facturación electrónica a fe@elcaminantecr.com. Crédito a 30 días disponible para clientes corporativos e instituciones aprobadas.",
        },
        {
          title: "Guía de Tallas y Zapatos de Seguridad",
          category: "Catálogo Técnico",
          fileName: "guia-tallas-calzado.txt",
          content:
            "Camisas polo y uniformes disponibles de talla XS a 3XL (corte caballero, dama y juvenil). Botas de PVC Kayman (suela amarilla) y Dinosaurio (suela roja) ideales para agroindustria y ambientes húmedos (tallas 36 a 46). Zapatos de seguridad punta composite dieléctricos en cuero hidrofugado con garantía contra defecto de fábrica.",
        },
      ],
    });
  }

  // 10. Example Seller Alert (ready-to-buy lead)
  const existingAlerts = await prisma.sellerAlert.count();
  if (existingAlerts === 0) {
    const coopClient = await prisma.client.findFirst({ where: { company: "Coopelesca Contratistas" } });
    if (coopClient) {
      await prisma.client.update({
        where: { id: coopClient.id },
        data: { qualificationScore: 85, qualificationStatus: "LISTO_PARA_COMPRAR" },
      });
      await prisma.sellerAlert.create({
        data: {
          clientId: coopClient.id,
          priority: "ALTA",
          title: "🔥 Coopelesca Contratistas está listo para comprar (85/100)",
          buyingSignals: "Indicó cantidades específicas (30 polos + 10 zapatos) · Solicita proforma con IVA incluido",
          suggestedNextStep: "Generar Factura Proforma PDF en colones (IVA 13% incluido) y enviarla por WhatsApp/Correo.",
          score: 85,
        },
      });
    }
  }

  // 11. Pre-seed both Caminante corporate email accounts (SMTP 465 / IMAP 993 ready for password)
  const defaultAccounts = [
    {
      label: "Ventas",
      email: "ventas@elcaminantecr.com",
      fromName: "Caminante Corporativo · Ventas",
      smtpHost: "mail.elcaminantecr.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "ventas@elcaminantecr.com",
      imapHost: "mail.elcaminantecr.com",
      imapPort: 993,
      imapSecure: true,
      imapUser: "ventas@elcaminantecr.com",
      isDefault: true,
    },
    {
      label: "Uniformes",
      email: "uniformes@elcaminantecr.com",
      fromName: "Caminante Corporativo · Uniformes",
      smtpHost: "mail.elcaminantecr.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "uniformes@elcaminantecr.com",
      imapHost: "mail.elcaminantecr.com",
      imapPort: 993,
      imapSecure: true,
      imapUser: "uniformes@elcaminantecr.com",
      isDefault: false,
    },
  ];

  for (const acc of defaultAccounts) {
    await prisma.emailAccount.upsert({
      where: { workspaceId_email: { workspaceId: "default", email: acc.email } },
      update: {},
      create: { ...acc, workspaceId: "default" },
    });
  }

  console.log("Seed completado correctamente para Caminante Corporativo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
