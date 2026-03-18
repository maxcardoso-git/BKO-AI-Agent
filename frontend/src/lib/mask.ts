const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_REGEX = /\(\d{2}\)\s?\d{4,5}-\d{4}/g;

/**
 * Masks CPF patterns in a string.
 * Input: "CPF: 123.456.789-00" → "CPF: ***.***.***-**"
 */
export function maskCpf(text: string): string {
  return text.replace(CPF_REGEX, '***.***.***-**');
}

/**
 * Masks Brazilian phone number patterns in a string.
 * Input: "(11) 98765-4321" → "(**) *****-****"
 */
export function maskPhone(text: string): string {
  return text.replace(PHONE_REGEX, '(**) *****-****');
}

/**
 * Applies both CPF and phone masking to a string.
 */
export function maskSensitive(text: string): string {
  return maskPhone(maskCpf(text));
}
