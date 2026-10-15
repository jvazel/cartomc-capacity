import { aggregatePivotData } from '../aggregatePivotData';
import { TempoEntry } from '../../types/tempo';

export function runAggregatePivotDataTests(): void {
  // Test 1: Empty input
  {
    const res = aggregatePivotData([]);
    if (res.length !== 0) {
      throw new Error('Expected empty array for empty input');
    }
  }

  // Test 2: Aggregation calculation
  {
    const mockEntries: TempoEntry[] = [
      {
        budgetLine: 'BUD-01',
        project: 'GTEP',
        issueKey: 'GTEP-101',
        category: 'EVO',
        lot: 'LOT-1',
        entryTask: 'Tâche A',
        comment: 'Worklog 1',
        ticketLink: 'http://jira/browse/GTEP-101',
        collaborator: 'Alice',
        type: 'INT',
        timeInHours: 8,
        timeInDays: 1.0,
        estimatedInDays: 2.0,
        status: 'En cours',
        issueType: 'Story',
        worklogDate: '2026-01-15',
        month: 1,
        year: 2026,
        epicSummary: 'Epic 1',
        featureId: 'FEAT-A',
        role: 'DEV Back',
        labels: 'backend',
        businessChange: 'FALSE',
        fixVersions: 'v1.0'
      }
    ];

    const result = aggregatePivotData(mockEntries);
    if (result.length !== 1) {
      throw new Error('Expected 1 year node');
    }

    const yearNode = result[0];
    if (yearNode.key !== '2026' || yearNode.intDays !== 1.0 || yearNode.totalDays !== 1.0) {
      throw new Error('Incorrect year node totals');
    }
  }
}
