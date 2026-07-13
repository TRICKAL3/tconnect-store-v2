/** Service fee on utility bill payments (customer pays bill + fee; bill is paid at face value). */
export const UTILITY_BILL_SERVICE_FEE_RATE = 0.025;
export const UTILITY_BILL_SERVICE_FEE_PERCENT = 2.5;

export function utilityBillServiceFeeMwk(billAmountMwk: number): number {
  const bill = Math.max(0, Math.round(billAmountMwk));
  if (!bill) return 0;
  return Math.round(bill * UTILITY_BILL_SERVICE_FEE_RATE);
}

export function utilityBillChargeMwk(billAmountMwk: number): number {
  const bill = Math.max(0, Math.round(billAmountMwk));
  return bill + utilityBillServiceFeeMwk(bill);
}

export function utilityBillChargeFromMetadata(
  meta: Record<string, unknown> | null | undefined
): { billMwk: number; serviceFeeMwk: number; totalChargeMwk: number } {
  const billMwk = Math.max(0, Math.round(Number(meta?.amountMwk) || 0));
  const serviceFeeMwk =
    meta?.serviceFeeMwk != null
      ? Math.max(0, Math.round(Number(meta.serviceFeeMwk)))
      : utilityBillServiceFeeMwk(billMwk);
  const totalChargeMwk =
    meta?.totalChargeMwk != null
      ? Math.max(0, Math.round(Number(meta.totalChargeMwk)))
      : billMwk + serviceFeeMwk;
  return { billMwk, serviceFeeMwk, totalChargeMwk };
}
