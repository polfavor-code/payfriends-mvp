import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { formatCurrency0, formatDate } from '@/lib/formatters';
import { StatusBadge } from '@/components/StatusBadge';

interface Agreement {
  id: number;
  lender_name: string;
  borrower_email: string;
  amount_cents: number;
  status: string;
  created_at: string;
  due_date: string | null;
}

async function getAgreements(): Promise<Agreement[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('agreements')
      .select('id, lender_name, borrower_email, amount_cents, status, created_at, due_date')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching agreements:', error);
    return [];
  }
}

export default async function AdminLoansPage() {
  const agreements = await getAgreements();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Loans</h1>
        <span className="text-sm text-gray-400">{agreements.length} loans</span>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Lender</th>
              <th>Borrower</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => (
              <tr key={agreement.id}>
                <td className="font-mono text-xs">{agreement.id}</td>
                <td>{agreement.lender_name}</td>
                <td>{agreement.borrower_email}</td>
                <td className="font-medium">{formatCurrency0(agreement.amount_cents)}</td>
                <td>
                  <StatusBadge status={agreement.status} />
                </td>
                <td className="text-gray-400">
                  {agreement.due_date ? formatDate(agreement.due_date) : '—'}
                </td>
                <td className="text-gray-400">{formatDate(agreement.created_at)}</td>
                <td>
                  <Link
                    href={`/admin/loans/${agreement.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm no-underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {agreements.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No loans found
          </div>
        )}
      </div>
    </div>
  );
}
