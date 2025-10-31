import * as jwt from 'jsonwebtoken';

export interface RescheduleTokenPayload {
  appointmentId: number;
  orderId: number;
  itemId: number;
}

interface InternalTokenPayload extends RescheduleTokenPayload {
  iat?: number;
  exp?: number;
}

const getPrivateKey = (): string => {
  const base64 = process.env.JWT_PRIVATE_KEY_BASE64;
  if (!base64) {
    throw new Error('JWT private key not configured');
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

const getPublicKey = (): string => {
  const base64 = process.env.JWT_PUBLIC_KEY_BASE64;
  if (!base64) {
    throw new Error('JWT public key not configured');
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

const getTtlMinutes = (): number => {
  const raw = process.env.RESCHEDULE_TOKEN_TTL_MINUTES;
  const ttl = raw ? parseInt(raw, 10) : 60 * 24 * 3; // default 3 days
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 60 * 24 * 3;
};

export function signRescheduleToken(payload: RescheduleTokenPayload): string {
  const privateKey = getPrivateKey();
  const ttlMinutes = getTtlMinutes();
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: `${ttlMinutes}m`,
  });
}

export function verifyRescheduleToken(token: string): RescheduleTokenPayload {
  const publicKey = getPublicKey();
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
  }) as InternalTokenPayload;
  return {
    appointmentId: Number(decoded.appointmentId),
    orderId: Number(decoded.orderId),
    itemId: Number(decoded.itemId),
  };
}
