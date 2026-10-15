import { TempoEntry } from '../types/tempo';

export function exportTempoToCSV(entries: TempoEntry[], filename = 'detail_worklogs_tempo.csv'): void {
  if (!entries || entries.length === 0) return;

  const headers = [
    'budgetLine',
    'project',
    'issueKey',
    'category',
    'lot',
    'entryTask',
    'comment',
    'ticketLink',
    'collaborator',
    'type',
    'timeInHours',
    'timeInDays',
    'estimatedInDays',
    'status',
    'issueType',
    'worklogDate',
    'month',
    'year',
    'epicSummary',
    'featureId',
    'role',
    'labels',
    'businessChange',
    'fixVersions'
  ];

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(';'));

  for (const entry of entries) {
    const row = [
      entry.budgetLine,
      entry.project,
      entry.issueKey,
      entry.category,
      entry.lot,
      entry.entryTask,
      entry.comment,
      entry.ticketLink,
      entry.collaborator,
      entry.type,
      entry.timeInHours != null ? String(Number(entry.timeInHours.toFixed(2))).replace('.', ',') : '',
      entry.timeInDays != null ? String(Number(entry.timeInDays.toFixed(2))).replace('.', ',') : '',
      entry.estimatedInDays != null ? String(Number(entry.estimatedInDays.toFixed(2))).replace('.', ',') : '',
      entry.status,
      entry.issueType,
      entry.worklogDate,
      entry.month,
      entry.year,
      entry.epicSummary,
      entry.featureId,
      entry.role,
      entry.labels,
      entry.businessChange,
      entry.fixVersions
    ];
    rows.push(row.map(escapeCSV).join(';'));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n'); // UTF-8 BOM
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
