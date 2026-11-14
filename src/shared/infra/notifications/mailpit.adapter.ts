import { Injectable, Logger } from '@nestjs/common';
import { Result } from '../../domain/result';
import { Money } from '../../domain/money.vo';
import { NotificationPort, PriceDropAlertEmailData } from '../../ports/notification.port';

@Injectable()
export class MailpitAdapter implements NotificationPort {
  private readonly logger = new Logger(MailpitAdapter.name);

  async sendPriceDropAlert(data: PriceDropAlertEmailData): Promise<Result<void, Error>> {
    const mailpitHttpUrl = process.env.MAILPIT_HTTP_URL || 'http://127.0.0.1:8025/api/v1/send';

    const oldMoney = Money.create(data.oldPriceMinorUnits, data.currency);
    const newMoney = Money.create(data.newPriceMinorUnits, data.currency);

    const oldPriceFormatted = oldMoney.isOk() ? oldMoney.value.format() : `${data.oldPriceMinorUnits} ${data.currency}`;
    const newPriceFormatted = newMoney.isOk() ? newMoney.value.format() : `${data.newPriceMinorUnits} ${data.currency}`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>¡Alerta de Caída de Precio en PricePulse!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e1e4e8; }
    .header { background: #0052cc; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .content { padding: 28px; }
    .badge { display: inline-block; background-color: #e3fcef; color: #006644; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 20px; margin-bottom: 16px; }
    .prices { margin: 20px 0; padding: 16px; background-color: #fafbfc; border-radius: 6px; border-left: 4px solid #0052cc; }
    .old-price { font-size: 15px; color: #6b778c; text-decoration: line-through; margin-bottom: 4px; }
    .new-price { font-size: 26px; font-weight: 800; color: #0052cc; }
    .btn { display: inline-block; background-color: #0052cc; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 16px; margin-top: 10px; }
    .footer { padding: 20px 28px; background-color: #fafbfc; border-top: 1px solid #e1e4e8; font-size: 12px; color: #6b778c; text-align: center; }
    .footer a { color: #6b778c; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📉 ¡El precio acaba de bajar!</h1>
    </div>
    <div class="content">
      <div class="badge">Ahorro detectado: -${data.dropPercentage}%</div>
      <h2 style="font-size: 18px; margin-top: 0;">${data.productTitle}</h2>
      
      <div class="prices">
        <div class="old-price">Precio anterior: ${oldPriceFormatted}</div>
        <div class="new-price">${newPriceFormatted}</div>
      </div>

      <p>Este producto ha alcanzado o superado tu precio objetivo monitoreado.</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${data.productUrl}" class="btn" target="_blank">Ver Oferta en la Tienda &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>Estás recibiendo este correo porque configuraste una alerta en PricePulse.</p>
      <p><a href="http://localhost:3333/api/alerts/unsubscribe?alertId=${data.alertId}">Desactivar esta alerta con un clic</a></p>
    </div>
  </div>
</body>
</html>
`;

    try {
      const payload = {
        From: {
          Email: process.env.EMAIL_FROM || 'alerts@pricepulse.dev',
          Name: 'PricePulse Alerts',
        },
        To: [{ Email: data.userEmail }],
        Subject: `📉 ¡Bajó un ${data.dropPercentage}%! ${data.productTitle}`,
        HTML: htmlBody,
      };

      const response = await fetch(mailpitHttpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Mailpit API responded with status ${response.status}: ${await response.text()}`);
      }

      this.logger.log(`Price drop email sent to ${data.userEmail} for product "${data.productTitle}"`);
      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to send email to ${data.userEmail}:`, error);
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
