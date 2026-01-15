import { NextResponse } from 'next/server';
import { getAgreementById } from '@/lib/db-supabase';
import { runCalculation, type CalculationInput } from '@/lib/calculator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const loanId = searchParams.get('loan_id');

  if (!loanId) {
    return NextResponse.json({ error: 'loan_id required' }, { status: 400 });
  }

  const agreement = await getAgreementById(loanId);
  if (!agreement) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  }

  // Build calculation input
  const calculationInput: CalculationInput = {
    principal: agreement.amount_cents,
    annualInterestRate: agreement.interest_rate || 0,
    repaymentType: agreement.repayment_type === 'one_time' ? 'one_time' : 'installments',
    numInstallments: agreement.installment_count || 1,
    paymentFrequency: agreement.payment_frequency || 'monthly',
    loanStartMode: (agreement as any).loan_start_mode || 'upon_acceptance',
    loanStartDate: (agreement as any).money_sent_date || (agreement as any).money_transfer_date || null,
    firstPaymentOffsetDays: (agreement as any).first_payment_offset_days || 30,
  };

  const computedResult = runCalculation(calculationInput);

  const exportData = {
    loan_id: agreement.id,
    exported_at: new Date().toISOString(),
    stored: {
      inputs: {
        principal_cents: agreement.amount_cents,
        interest_rate: agreement.interest_rate,
        repayment_type: agreement.repayment_type,
        installment_count: agreement.installment_count,
        payment_frequency: agreement.payment_frequency,
        calc_version: agreement.calc_version,
      },
      outputs: {
        planned_total_cents: (agreement as any).planned_total_cents,
      },
    },
    recomputed: computedResult || { error: 'Calculation failed' },
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="debug-${loanId}.json"`,
    },
  });
}
