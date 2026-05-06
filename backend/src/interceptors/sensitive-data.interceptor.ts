import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_REGEX = /\(\d{2}\)\s?\d{4,5}-\d{4}/g;

function redactSensitive(data: unknown): unknown {
  if (typeof data === 'string') {
    return data
      .replace(CPF_REGEX, '***.***.***-**')
      .replace(PHONE_REGEX, '(**) *****-****');
  }
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(redactSensitive);
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, redactSensitive(v)]),
    );
  }
  return data;
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => redactSensitive(data)));
  }
}
