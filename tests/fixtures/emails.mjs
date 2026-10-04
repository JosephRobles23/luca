/**
 * Fixtures SINTÉTICOS de correos BCP/Yape, modelados a partir de capturas reales
 * (docs/discovery/formatos-correos-bcp-yape.md). Se reemplazarán por .eml reales anonimizados.
 * Nombres y números son ficticios.
 */

const BCP_FROM = 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>';
const YAPE_FROM = 'YAPE Notificaciones <notificaciones@yape.pe>';

const row = (k, v) => `<tr><td style="color:#666">${k}</td><td align="right"><b>${v}</b></td></tr>`;

/** Plantilla BCP: cabecera, frase destacada, secciones con tablas de 2 columnas. */
function bcpHtml(headline, sections) {
  return `<html><head><style>.x{color:red}</style></head><body>
  <table><tr><td><img src="logo.png" alt="BCP"></td></tr></table>
  <p>Hola <b>Nombre Apellido</b>,</p>
  <p style="font-size:18px">${headline}</p>
  <p>Por tu seguridad, te enviamos los <b>datos de tu operaci&oacute;n.</b></p>
  ${sections.map(([title, rows]) => `<h4>${title}</h4><table>${rows.map(([k, v]) => row(k, v)).join('')}</table>`).join('')}
  <table><tr><td>¡Tú decides qué te avisa! Configura tus notificaciones.</td></tr></table>
  </body></html>`;
}

/** Plantilla Yape: monto grande y tabla etiqueta/valor. */
function yapeHtml(title, amountLabel, amount, rows, extra = []) {
  return `<html><body>
  <div><img alt="yape"></div>
  <h2>Hola NOMBRE,</h2><h3>${title}</h3>
  <p>${amountLabel}</p><p><span>S/</span> <span style="font-size:40px">${amount}</span></p>
  <table>${rows.map(([k, v]) => row(k, v)).join('')}</table>
  ${extra.length ? `<h4>Detalle del servicio:</h4><table>${extra.map(([k, v]) => row(k, v)).join('')}</table>` : ''}
  <p>*Por tu seguridad, te notificaremos por cada yapeo que realices.</p>
  </body></html>`;
}

export const emails = {
  bcp_card_purchase_pen: {
    id: 'm-bcp-1', from: BCP_FROM, date: new Date('2026-10-03T02:06:00Z'),
    subject: 'Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP',
    html: bcpHtml('Realizaste un consumo de <b>S/ 53.30</b> con tu <b>Tarjeta de D&eacute;bito BCP</b> en <b>CA012 AVIACION.</b>', [
      ['Monto', [['Total del consumo', 'S/ 53.30']]],
      ['Datos de la operaci&oacute;n', [
        ['Operaci&oacute;n realizada', 'Consumo Tarjeta de D&eacute;bito'],
        ['Fecha y hora', '02 de octubre de 2026 - 09:06 PM'],
        ['N&uacute;mero de Tarjeta de D&eacute;bito', '************1816'],
        ['Empresa', 'CA012 AVIACION'],
        ['N&uacute;mero de operaci&oacute;n', '176424']
      ]]
    ])
  },
  bcp_card_purchase_usd: {
    id: 'm-bcp-2', from: BCP_FROM, date: new Date('2026-10-03T12:54:00Z'),
    subject: 'Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP',
    html: bcpHtml('Realizaste un consumo de <b>$ 3.86</b> con tu <b>Tarjeta de D&eacute;bito BCP</b> en <b>APPLE.COM/BILL.</b>', [
      ['Monto', [['Total del consumo', '$ 3.86']]],
      ['Datos de la operaci&oacute;n', [
        ['Operaci&oacute;n realizada', 'Consumo Tarjeta de D&eacute;bito'],
        ['Fecha y hora', '03 de octubre de 2026 - 07:54 AM'],
        ['N&uacute;mero de Tarjeta de D&eacute;bito', '************1816'],
        ['Empresa', 'APPLE.COM/BILL'],
        ['N&uacute;mero de operaci&oacute;n', '265272']
      ]]
    ])
  },
  bcp_internal_transfer: {
    id: 'm-bcp-3', from: BCP_FROM, date: new Date('2026-10-02T19:58:00Z'),
    subject: 'Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP',
    html: bcpHtml('Realizaste una transferencia de <b>S/ 57.95</b> desde tu <b>Clasica.</b>', [
      ['Montos', [['Monto transferido', 'S/ 57.95'], ['Tipo de cambio', 'S/ 3.4090'], ['Total cobrado al tipo de cambio', '$ 17.00']]],
      ['Datos de la operaci&oacute;n', [
        ['Operaci&oacute;n realizada', 'Transferencia entre mis cuentas'],
        ['Fecha y hora', '02 de Octubre de 2026 - 02:58 PM'],
        ['Desde', 'Clasica<br>**** 7119'],
        ['Enviado a', 'Clasica<br>**** 2230'],
        ['N&uacute;mero de operaci&oacute;n', '554433']
      ]]
    ])
  },
  bcp_wardadito: {
    id: 'm-bcp-4', from: BCP_FROM, date: new Date('2026-10-02T15:00:00Z'),
    subject: 'Realizaste un retiro de tu wardadito.',
    html: bcpHtml('Realizaste un retiro de <b>S/ 10.00</b> en tu wardadito <b>Ahorro libre.</b>', [
      ['Montos', [['Total retirado', 'S/ 10.00']]],
      ['Datos de la operaci&oacute;n', [['Fecha y hora', '02 de octubre de 2026 - 10:00 AM'], ['N&uacute;mero de operaci&oacute;n', '778899']]]
    ])
  },
  bcp_qr_payment: {
    id: 'm-bcp-5', from: BCP_FROM, date: new Date('2026-09-29T01:10:00Z'),
    subject: 'Constancia de Pago con QR - Servicios de Notificaciones BCP',
    html: bcpHtml('Realizaste un yapeo a celular de <b>S/ 2.00</b> desde tu <b>Clasica Soles.</b>', [
      ['Montos', [['Monto total', 'S/ 2.00']]],
      ['Datos de la operaci&oacute;n', [
        ['Fecha y hora', '28 de setiembre de 2026 - 08:10 PM'],
        ['Nombre del beneficiario', 'Maria Lop*'],
        ['Celular del beneficiario', 'XXXXXXXXX261'],
        ['N&uacute;mero de operaci&oacute;n', '990011']
      ]]
    ])
  },
  bcp_rejected: {
    id: 'm-bcp-6', from: BCP_FROM, date: new Date('2026-09-29T20:00:00Z'),
    subject: 'Se rechazó tu compra por fondos insuficientes - Servicio de Notificaciones BCP',
    html: bcpHtml('Lo sentimos, tu compra fue rechazada debido a que tu cuenta no tiene saldo suficiente.', [
      ['Datos', [['Monto', 'S/ 120.00'], ['Empresa', 'TIENDA X']]]
    ])
  },
  yape_p2p_sent: {
    id: 'm-yape-1', from: YAPE_FROM, date: new Date('2026-10-04T07:35:00Z'),
    subject: 'Por tu seguridad, te notificaremos por cada yapeo que realices',
    html: yapeHtml('&iexcl;Acabas de yapear exitosamente!', 'Monto de yapeo*', '10.00', [
      ['Yapero', 'Nombre Ape*'],
      ['Tu n&uacute;mero de celular', 'XXXXXXXXX623'],
      ['Fecha y Hora de la operaci&oacute;n', '04 octubre 2026 - 02:35 a. m.'],
      ['Celular del Beneficiario', 'XXXXXXXXX261'],
      ['Nombre del Beneficiario', 'Carlos Roj*'],
      ['N&ordm; de operaci&oacute;n', '3316121']
    ])
  },
  yape_service: {
    id: 'm-yape-2', from: YAPE_FROM, date: new Date('2026-09-16T01:20:00Z'),
    subject: 'Tu yapeo de servicio ha sido confirmado',
    html: yapeHtml('&iexcl;Tu servicio fue yapeado con &eacute;xito!', 'Monto total', '10.00', [
      ['Yapero(a) :', 'NOMBRE APELLIDO'],
      ['N&uacute;mero de celular:', '*** *** 623'],
      ['Fecha y hora:', '15 Set, 2026 - 08:20 pm'],
      ['N&ordm; de operaci&oacute;n Yape:', '05388814']
    ], [
      ['Empresa:', 'Metropolitano y Corredores'],
      ['Servicio:', 'Recarga de Tarjetas'],
      ['C&oacute;digo de usuario:', '2628687378']
    ])
  },
  yape_topup: {
    id: 'm-yape-3', from: YAPE_FROM, date: new Date('2026-08-08T15:00:00Z'),
    subject: 'Tu recarga en Yape ha sido confirmada',
    html: `<html><body><p>N&ordm; de operaci&oacute;n Yape: 00624363.</p><p>AMERICA MOVIL PERU S.A.C. RUC: 20467534026.</p>
      <p>Nro Control: 00415040.</p><p>Recarga Efectiva : S/ 6.0</p><p>Fecha y hora: 08 ago. 2026 - 10:00 a. m.</p></body></html>`
  },
  yape_auto_transfer: {
    id: 'm-yape-4', from: YAPE_FROM, date: new Date('2026-05-24T19:41:00Z'),
    subject: 'Envío Automático - Constancia de Transferencia - Yape',
    html: `<html><body><p>Hola NOMBRE,. &iexcl;Tu pago en Yape Promos fue exitoso!</p>
      <table>${row('Monto total', 'S/ 27.80')}${row('Fecha y hora', '24 may. 2026 - 02:41 p. m.')}${row('N&ordm; de operaci&oacute;n', '8812233')}</table></body></html>`
  },
  // Layout REAL de Yape (verificado con .eml el 2026-10-04): una celda por fila, monto partido en "S/" + número.
  yape_p2p_sent_real: {
    id: 'm-yape-real-1', from: YAPE_FROM, date: new Date('2026-10-04T07:35:46Z'),
    subject: 'Por tu seguridad, te notificaremos por cada yapeo que realices',
    html: `<html><body><table>
      <tr><td>&iexcl;Hola, Nombre Ape*!</td></tr><tr><td>&iexcl;Acabas de yapear exitosamente!</td></tr>
      <tr><td>Monto de yapeo*</td></tr><tr><td>S/</td></tr><tr><td>10.00</td></tr>
      <tr><td>Yapero</td></tr><tr><td>Nombre Ape*</td></tr>
      <tr><td>Tu n&uacute;mero de celular</td></tr><tr><td>XXXXXXXXX623</td></tr>
      <tr><td>Fecha y Hora de la operaci&oacute;n</td></tr><tr><td>04 octubre 2026 - 02:35 a. m.</td></tr>
      <tr><td>Celular del Beneficiario</td></tr><tr><td>XXXXXXXXX261</td></tr>
      <tr><td>Nombre del Beneficiario</td></tr><tr><td>Carlos Roj*</td></tr>
      <tr><td>N&ordm; de operaci&oacute;n</td></tr><tr><td>3316121</td></tr>
      <tr><td>*Por tu seguridad, te notificaremos por cada yapeo que realices.</td></tr>
      <tr><td>Juntos somos m&aacute;s seguros En nuestras comunicaciones nunca incluiremos links…</td></tr>
    </table></body></html>`
  },
  bcp_card_plin: {
    id: 'm-bcp-plin', from: BCP_FROM, date: new Date('2026-10-04T13:47:25Z'),
    subject: 'Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP',
    html: bcpHtml('Realizaste un consumo de <b>$ 0.96</b> con tu <b>Tarjeta de D&eacute;bito BCP</b> en <b>PLIN-MARIA LOPEZ.</b>', [
      ['Monto', [['Total del consumo', '$ 0.96']]],
      ['Datos de la operaci&oacute;n', [
        ['Fecha y hora', '04 de octubre de 2026 - 08:47 AM'],
        ['N&uacute;mero de Tarjeta de D&eacute;bito', '************1816'],
        ['Empresa', 'PLIN-MARIA LOPEZ'],
        ['N&uacute;mero de operaci&oacute;n', '907786']
      ]]
    ])
  },
  yape_login_notice: {
    id: 'm-yape-notice', from: YAPE_FROM, date: new Date('2026-10-04T13:01:07Z'),
    subject: 'Ingresaste a Yape de forma segura',
    html: '<html><body><p>Detectamos un ingreso a tu cuenta Yape desde un nuevo dispositivo.</p></body></html>'
  },
  bcp_wardadito_real: {
    id: 'm-bcp-ward-real', from: BCP_FROM, date: new Date('2026-10-03T02:05:54Z'),
    subject: 'Realizaste un retiro de tu wardadito.',
    html: `<html><body><p>Hola Nombre,</p><p>Realizaste un retiro de S/ 10.00 en tu wardadito Ahorro libre.</p>
      <h4>Montos</h4><table><tr><td>Total retirado</td></tr><tr><td>S/ 10.00</td></tr></table>
      <h4>Datos de la operaci&oacute;n</h4><table><tr><td>Operaci&oacute;n realizada</td></tr><tr><td>Retiro</td></tr>
      <tr><td>Fecha y hora</td></tr><tr><td>02 de octubre de 2026 - 21:05:53</td></tr>
      <tr><td>Origen</td></tr><tr><td>Wardadito Ahorro libre</td></tr><tr><td>Destino</td></tr><tr><td>AHOR. *************022</td></tr></table></body></html>`
  },
  yape_marketing: {
    id: 'm-yape-5', from: 'Yape <promos@yape.pe>', date: new Date('2026-09-10T15:00:00Z'),
    subject: '¡Tienes S/100 DSCTO. en iPad, Apple Watch y AirPods! Clic aquí 👇',
    html: '<html><body><p>Cambiar Dólares · Tienda Yape · Entradas</p></body></html>'
  },
  steam_other: {
    id: 'm-other-1', from: 'Steam <noreply@steampowered.com>', date: new Date('2026-10-02T10:00:00Z'),
    subject: 'Ya están aquí las rebajas de otoño',
    html: '<html><body><p>Ofertas</p></body></html>'
  }
};

/** Convierte un fixture al formato de la Gmail API (format=full) para el mock del servicio avanzado. */
export function toGmailApi(e) {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
  return {
    id: e.id, threadId: 't-' + e.id, internalDate: String(e.date.getTime()),
    payload: {
      mimeType: 'multipart/alternative',
      headers: [{ name: 'From', value: e.from }, { name: 'Subject', value: e.subject }, { name: 'Date', value: e.date.toUTCString() }],
      parts: [
        { mimeType: 'text/plain', body: { data: b64('(versión texto)') } },
        { mimeType: 'text/html', body: { data: b64(e.html) } }
      ]
    }
  };
}
