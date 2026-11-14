import { Result } from '../domain/result';

export interface PriceDropAlertEmailData {
  userEmail: string;
  productTitle: string;
  productUrl: string;
  oldPriceMinorUnits: number;
  newPriceMinorUnits: number;
  dropPercentage: number;
  currency: string;
  alertId: string;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPort {
  sendPriceDropAlert(data: PriceDropAlertEmailData): Promise<Result<void, Error>>;
}
