import { DomainErrorCode, domainError } from '@app/domain/shared/model/app-error';

const STATUS: Record<DomainErrorCode, number> = {
  not_found: 404,
  unauthorized: 401,
  session_replaced: 401,
  forbidden: 403,
  invalid_credentials: 401,
  too_many_attempts: 429,
  invalid_invitation: 410,
  conflict: 409,
  validation: 400,
  network: 503,
  unknown: 500,
};

/**
 * Error que el BFF devuelve al cliente.
 *
 * El `code` es el mismo `DomainErrorCode` del front: el adapter HTTP lo
 * reconstruye sin traducir nada.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? domainError(code).message);
    this.status = STATUS[code];
  }
}

export const fail = (code: DomainErrorCode, message?: string): never => {
  throw new ApiError(code, message);
};

interface DbError {
  readonly code?: string;
  readonly message?: string;
}

/** Traduce un error de PostgREST o Postgres a ApiError. */
export function fromDbError(error: DbError): ApiError {
  switch (error.code) {
    case '23505':
      return new ApiError('conflict');
    case 'P0002':
    case 'PGRST116':
    case '22P02':
    case '23503':
      return new ApiError('not_found');
    case '23514':
      return new ApiError('validation', 'Algún dato está fuera de rango.');
    default:
      return new ApiError('unknown');
  }
}
