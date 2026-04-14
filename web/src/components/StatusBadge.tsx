const statusColors: Record<string, string> = {
  APPLYING: 'bg-yellow-100 text-yellow-800',
  APPLIED: 'bg-blue-100 text-blue-800',
  FAILED: 'bg-red-100 text-red-800',
  DOCUMENTS_REQUESTED: 'bg-orange-100 text-orange-800',
  DOCUMENTS_SENT: 'bg-teal-100 text-teal-800',
  VIEWING_INVITED: 'bg-purple-100 text-purple-800',
  VIEWING_SCHEDULED: 'bg-green-100 text-green-800',
  EXTERNAL_FORM_DETECTED: 'bg-indigo-100 text-indigo-800',
  EXTERNAL_FORM_FILLING: 'bg-indigo-100 text-indigo-800',
  AWAITING_USER_INPUT: 'bg-amber-100 text-amber-800',
  EXTERNAL_FORM_SENT: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
