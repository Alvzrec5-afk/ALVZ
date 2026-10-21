/** Limites des envois proposées dans le studio (Go). 20 = partie gratuite d'Oracle ; au-delà, paiement à l'utilisation. */
export const STORAGE_LIMIT_CHOICES = [20, 50, 100, 200, 500] as const;

/** Prix indicatif d'Oracle (stockage « Standard ») au-delà de la partie gratuite, en dollars par Go et par mois. */
export const ORACLE_PRICE_PER_GB_MONTH = 0.0255;
