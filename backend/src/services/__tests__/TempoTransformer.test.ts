import assert from 'node:assert';
import { transformTempoData, parseSprintString, parseWorklogDate } from '../TempoTransformer.js';
import { RawTempoWorklog, RawJiraIssue } from '../JiraTempoClient.js';

export function runTempoTransformerTests(): void {
  // Test 1: Standard transformation
  {
    const mockWorklogs: RawTempoWorklog[] = [
      {
        id: 101,
        issue: { key: 'GTEP-42' },
        author: { displayName: 'Jean Dupont' },
        dateStarted: '2026-02-10',
        timeSpentSeconds: 28800, // 8 hours = 1 day
        comment: 'Developpement backend'
      }
    ];

    const issuesMap = new Map<string, RawJiraIssue>();
    issuesMap.set('GTEP-42', {
      key: 'GTEP-42',
      fields: {
        summary: 'Mise en place de l\'API',
        status: { name: 'En cours' },
        issuetype: { name: 'Story' },
        project: { key: 'GTEP', name: 'GTEP' },
        timetracking: { originalEstimateSeconds: 57600 }, // 2 days
        labels: ['backend', 'api'],
        fixVersions: [{ name: 'v2.1' }],
        parent: { key: 'GTEP-1' },
        customfield_10101: 'LIGNE-BUDGET-01',
        customfield_10102: 'EVO',
        customfield_10103: 'LOT-3',
        customfield_10104: 'FEATURE-99',
        customfield_10105: 'TRUE'
      }
    });

    const epicsMap = new Map<string, RawJiraIssue>();
    epicsMap.set('GTEP-1', {
      key: 'GTEP-1',
      fields: { summary: 'Epic Socle Technique' }
    });

    const collaborators = [
      { name: 'Jean Dupont', type: 'INT' as const, role: 'DEV Back' as const }
    ];

    const customFieldConfig = {
      budgetLine: 'customfield_10101',
      category: 'customfield_10102',
      lot: 'customfield_10103',
      featureId: 'customfield_10104',
      businessChange: 'customfield_10105'
    };

    const { entries, anomalies } = transformTempoData(
      mockWorklogs,
      issuesMap,
      epicsMap,
      collaborators,
      customFieldConfig,
      'https://collabtools.boulanger.team'
    );

    assert.strictEqual(anomalies.length, 0);
    assert.strictEqual(entries.length, 1);

    const entry = entries[0];
    assert.strictEqual(entry.issueKey, 'GTEP-42');
    assert.strictEqual(entry.budgetLine, 'LIGNE-BUDGET-01');
    assert.strictEqual(entry.category, 'EVO');
    assert.strictEqual(entry.lot, 'LOT-3');
    assert.strictEqual(entry.entryTask, 'Mise en place de l\'API');
    assert.strictEqual(entry.collaborator, 'Jean Dupont');
    assert.strictEqual(entry.type, 'INT');
    assert.strictEqual(entry.role, 'DEV Back');
    assert.strictEqual(entry.timeInHours, 8);
    assert.strictEqual(entry.timeInDays, 1);
    assert.strictEqual(entry.estimatedInDays, 2);
    assert.strictEqual(entry.worklogDate, '2026-02-10');
    assert.strictEqual(entry.month, 2);
    assert.strictEqual(entry.year, 2026);
    assert.strictEqual(entry.epicSummary, 'Epic Socle Technique');
    assert.strictEqual(entry.featureId, 'FEATURE-99');
    assert.strictEqual(entry.labels, 'backend, api');
    assert.strictEqual(entry.businessChange, 'TRUE');
    assert.strictEqual(entry.ticketLink, 'https://collabtools.boulanger.team/browse/GTEP-42');
  }

  // Test 2: Unknown collaborator handling
  {
    const mockWorklogs: RawTempoWorklog[] = [
      {
        id: 102,
        issue: { key: 'GTEP-43' },
        author: { displayName: 'Inconnu Person' },
        dateStarted: '2026-02-11',
        timeSpentSeconds: 14400
      }
    ];

    const { entries } = transformTempoData(
      mockWorklogs,
      new Map(),
      new Map(),
      [],
      {
        budgetLine: 'customfield_10101',
        category: 'customfield_10102',
        lot: 'customfield_10103',
        featureId: 'customfield_10104',
        businessChange: 'customfield_10105'
      },
      'https://collabtools.boulanger.team'
    );

    assert.strictEqual(entries[0].type, 'Unknown');
    assert.strictEqual(entries[0].role, 'Unknown');
  }

  // Test 3: GreenHopper Sprint string parsing
  {
    const sprintRaw = 'com.atlassian.greenhopper.service.sprint.Sprint@7bee7383[activatedDate=2025-05-23T07:02:16.086Z,autoStartStop=false,completeDate=<null>,endDate=2025-11-28T09:01:00.000Z,goal=<null>,id=2317,incompleteIssuesDestinationId=<null>,name=Sprint en cours,rapidViewId=1299,sequence=2246,startDate=2025-05-23T09:01:00.000Z,state=ACTIVE,synced=false]';
    const parsed = parseSprintString(sprintRaw);
    assert.strictEqual(parsed, 'Sprint en cours');
  }

  // Test 4: Worklog Date & Month parsing for September (month 9)
  {
    const parsedSeptember = parseWorklogDate({ worklogDate: '2026-09-15' });
    assert.strictEqual(parsedSeptember.month, 9);
    assert.strictEqual(parsedSeptember.year, 2026);
    assert.strictEqual(parsedSeptember.worklogDate, '2026-09-15');
  }
}
