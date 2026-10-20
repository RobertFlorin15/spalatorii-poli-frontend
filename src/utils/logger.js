import { IS_DEV } from './config';

export function logError(context, error) {
  if (IS_DEV) {
    console.error(`[${context}]`, error);
    return;
  }
  console.error(`[${context}]`, error?.name ?? 'Error', error?.status ?? error?.code ?? '');
}