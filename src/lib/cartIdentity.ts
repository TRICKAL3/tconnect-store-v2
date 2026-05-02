/** Match backend normalization for cart/profile sync */
export function cartAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}
