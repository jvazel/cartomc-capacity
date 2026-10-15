import { RawTempoWorklog, RawJiraIssue } from './JiraTempoClient.js';
import { ICollaboratorDoc } from '../models/TempoConfig.js';

export interface TempoEntry {
  budgetLine: string;
  project: string;
  issueKey: string;
  category: string;
  lot: string;
  entryTask: string;
  comment: string;
  ticketLink: string;
  collaborator: string;
  type: 'INT' | 'EXT' | 'Unknown';
  timeInHours: number;
  timeInDays: number;
  estimatedInDays: number | null;
  status: string;
  issueType: string;
  worklogDate: string;
  month: number;
  year: number;
  epicSummary: string;
  featureId: string;
  role: 'DEV Back' | 'PIL' | 'QA' | 'BA' | 'Unknown';
  labels: string;
  businessChange: 'TRUE' | 'FALSE';
  fixVersions: string;
}

export interface CustomFieldConfig {
  budgetLine: string;
  category: string;
  lot: string;
  featureId: string;
  businessChange: string;
}

export interface TransformResult {
  entries: TempoEntry[];
  anomalies: string[];
}

export function extractEpicNumber(epicSummary: string): string {
  if (!epicSummary) return "-100";
  const match = epicSummary.match(/Feature\s*-\s*(\d+)/i);
  return match ? match[1] : "-100";
}

export function extractIssueFeatureNumber(issueSummary: string): string {
  if (!issueSummary) return "-100";
  const match = issueSummary.match(/\#(\d+)/);
  return match ? match[1] : "-100";
}

export function resolveFeatureId(
  epicSummary: string,
  issueSummary: string,
  lot: string,
  year: number
): string {
  let featureId = "-100";

  // Step 1: Epic Summary rule ("Feature - XXXX")
  featureId = extractEpicNumber(epicSummary);

  // Step 2: Fallback to Ticket Summary rule ("#XXXX")
  if (featureId === "-100") {
    featureId = extractIssueFeatureNumber(issueSummary);
  }

  // Step 3: Override for Lot 21P090 (Vente)
  if (lot === '[[21P090]-v1.0-Vente]' && (featureId === "-100" || featureId === "0")) {
    featureId = year === 2024 ? "-4" : "-3";
  }

  return featureId;
}

export function parseSprintString(val: string): string {
  if (typeof val !== 'string' || !val) return val;
  if (!val.includes('com.atlassian.')) {
    return val;
  }
  
  // Replace any com.atlassian...[...] string with its clean name= property
  return val.replace(/com\.atlassian\.[^\]]*\[([^\]]*)\]/g, (_, body) => {
    const nameMatch = /name=([^,\\]]+)/.exec(body);
    if (nameMatch && nameMatch[1] && nameMatch[1] !== '<null>') {
      return nameMatch[1].trim();
    }
    return '';
  }).trim();
}

export function extractFieldValue(fieldVal: any): string {
  if (fieldVal === null || fieldVal === undefined) return '';
  if (typeof fieldVal === 'string') return parseSprintString(fieldVal);
  if (typeof fieldVal === 'number' || typeof fieldVal === 'boolean') return String(fieldVal);
  if (Array.isArray(fieldVal)) {
    return fieldVal.map((item) => extractFieldValue(item)).filter(Boolean).join(', ');
  }
  if (typeof fieldVal === 'object') {
    if (fieldVal.name) return parseSprintString(String(fieldVal.name));
    if (fieldVal.value) return parseSprintString(String(fieldVal.value));
    if (fieldVal.label) return parseSprintString(String(fieldVal.label));
    if (fieldVal.key) return parseSprintString(String(fieldVal.key));
    return parseSprintString(JSON.stringify(fieldVal));
  }
  return parseSprintString(String(fieldVal));
}

export function getCleanTokens(name: string): string[] {
  if (!name) return [];
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')   // Replace hyphens/special chars with space
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function findCollaborator(authorObj: any, collaborators: ICollaboratorDoc[]): ICollaboratorDoc | undefined {
  if (!authorObj) return undefined;

  let displayName = '';
  let keyOrUsername = '';

  if (typeof authorObj === 'string') {
    displayName = authorObj;
    keyOrUsername = authorObj;
  } else if (typeof authorObj === 'object' && authorObj !== null) {
    displayName = authorObj.displayName || authorObj.name || authorObj.username || '';
    keyOrUsername = authorObj.key || authorObj.accountId || authorObj.name || authorObj.username || '';
  }

  const cleanDisplayName = displayName.trim();
  const cleanKey = keyOrUsername.trim().toLowerCase();

  // 0. Direct match against matricule (e.g. if DB has matricule JIRAUSER16746 or 16746 or a matricule contained in key)
  if (cleanKey) {
    const keyDigitsMatch = cleanKey.match(/\d+/);
    const keyDigits = keyDigitsMatch ? keyDigitsMatch[0] : '';

    for (const c of collaborators) {
      if (c.matricule) {
        const cleanMatricule = c.matricule.trim().toLowerCase();
        const matDigitsMatch = cleanMatricule.match(/\d+/);
        const matDigits = matDigitsMatch ? matDigitsMatch[0] : '';

        if (cleanMatricule && (
          cleanKey === cleanMatricule ||
          cleanKey.includes(cleanMatricule) ||
          cleanMatricule.includes(cleanKey) ||
          (keyDigits && matDigits && keyDigits === matDigits)
        )) {
          return c;
        }
      }
    }
  }

  if (!cleanDisplayName) return undefined;

  const authorTokens = getCleanTokens(cleanDisplayName);
  if (authorTokens.length === 0) return undefined;

  const authorTokenSet = new Set(authorTokens);

  // 1. Exact token set match (e.g. "Jean DUPONT" vs "DUPONT Jean")
  for (const c of collaborators) {
    const cTokens = getCleanTokens(c.name);
    if (cTokens.length === authorTokens.length && cTokens.every((t) => authorTokenSet.has(t))) {
      return c;
    }
  }

  // 2. Full inclusion match (e.g. if DB has "DUPONT Jean" and Jira author is "DUPONT Jean (Prestataire)")
  for (const c of collaborators) {
    const cTokens = getCleanTokens(c.name);
    if (cTokens.length === 0) continue;

    const overlapCount = cTokens.filter((t) => authorTokenSet.has(t)).length;
    if (overlapCount > 0 && (overlapCount >= cTokens.length || overlapCount >= authorTokens.length)) {
      return c;
    }
  }

  // 3. Multi-word overlap match (at least 2 matching name parts)
  for (const c of collaborators) {
    const cTokens = getCleanTokens(c.name);
    const overlapCount = cTokens.filter((t) => authorTokenSet.has(t)).length;
    if (overlapCount >= 2) {
      return c;
    }
  }

  // 4. Single token match if resource name has only 1 word
  for (const c of collaborators) {
    const cTokens = getCleanTokens(c.name);
    if (cTokens.length === 1 && authorTokenSet.has(cTokens[0])) {
      return c;
    }
  }

  return undefined;
}

export function parseWorklogDate(wl: any): { worklogDate: string; month: number; year: number } {
  let rawDate = wl.worklogDate || wl.dateStarted || wl.started || wl.startDate;
  
  if (typeof rawDate === 'object' && rawDate !== null) {
    rawDate = rawDate.date || rawDate.iso || rawDate.value || String(rawDate);
  }

  let strDate = String(rawDate || '').trim();

  // Numeric timestamp in milliseconds
  if (/^\d{10,13}$/.test(strDate)) {
    const d = new Date(parseInt(strDate, 10));
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = String(d.getDate()).padStart(2, '0');
      const isoMonth = String(month).padStart(2, '0');
      return { worklogDate: `${year}-${isoMonth}-${day}`, month, year };
    }
  }

  // YYYY-MM-DD pattern match (e.g. "2026-09-15" or "2026-09-15T08:00:00")
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(strDate);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const isoMonth = String(month).padStart(2, '0');
    const isoDay = String(day).padStart(2, '0');
    return { worklogDate: `${year}-${isoMonth}-${isoDay}`, month, year };
  }

  // Fallback to JS Date
  if (strDate) {
    const d = new Date(strDate);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = String(d.getDate()).padStart(2, '0');
      const isoMonth = String(month).padStart(2, '0');
      return { worklogDate: `${year}-${isoMonth}-${day}`, month, year };
    }
  }

  const now = new Date();
  return {
    worklogDate: now.toISOString().slice(0, 10),
    month: now.getMonth() + 1,
    year: now.getFullYear()
  };
}

export function transformTempoData(
  worklogs: RawTempoWorklog[],
  issuesMap: Map<string, RawJiraIssue>,
  epicsMap: Map<string, RawJiraIssue>,
  collaborators: ICollaboratorDoc[],
  customFieldConfig: CustomFieldConfig,
  baseUrl: string,
  userNamesMap?: Map<string, string>
): TransformResult {
  const entries: TempoEntry[] = [];
  const anomalies: string[] = [];

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const authorDiagnostic = new Map<string, { type: string; count: number; matchedName?: string }>();

  for (const wl of worklogs) {
    const issueKey = wl.issue?.key || '';
    if (!issueKey) {
      anomalies.push(`Worklog sans issueKey (ID: ${wl.id || 'inconnu'})`);
      continue;
    }

    const ticket = issuesMap.get(issueKey);
    if (!ticket) {
      anomalies.push(`Ticket Jira introuvable pour la clé ${issueKey} (Worklog ID: ${wl.id || 'inconnu'})`);
    }

    const authorObj = wl.author || (wl as any).authorKey || (wl as any).worker || 'Inconnu';
    let rawAuthorName = typeof authorObj === 'object'
      ? (authorObj.displayName || authorObj.name || 'Inconnu')
      : String(authorObj);

    const authorKey = typeof authorObj === 'object'
      ? (authorObj.key || authorObj.name || authorObj.username || rawAuthorName)
      : rawAuthorName;

    // Use resolved real name from Jira User API if available
    const resolvedJiraName = userNamesMap?.get(authorKey) || userNamesMap?.get(rawAuthorName);
    const authorName = resolvedJiraName || rawAuthorName;

    const matchedCollab = findCollaborator(authorObj, collaborators) || (resolvedJiraName ? findCollaborator(resolvedJiraName, collaborators) : undefined);

    const type: 'INT' | 'EXT' | 'Unknown' = matchedCollab ? matchedCollab.type : 'Unknown';
    const role: 'DEV Back' | 'PIL' | 'QA' | 'BA' | 'Unknown' = matchedCollab ? matchedCollab.role : 'Unknown';

    // Collect diagnostic stats per author
    const diagKey = authorName;
    const currentDiag = authorDiagnostic.get(diagKey) || {
      type,
      count: 0,
      matchedName: matchedCollab?.name
    };
    currentDiag.count++;
    authorDiagnostic.set(diagKey, currentDiag);

    const rawTimeSeconds = wl.timeSpentSeconds || 0;
    const timeInHours = Number((rawTimeSeconds / 3600).toFixed(2));
    const timeInDays = Number((timeInHours / 8).toFixed(2));

    const origEstSec = ticket?.fields?.timetracking?.originalEstimateSeconds;
    const estimatedInDays = typeof origEstSec === 'number' && origEstSec > 0
      ? Number((origEstSec / 28800).toFixed(2))
      : null;

    // Parse worklog date, month (1-12), and year
    const { worklogDate, month, year } = parseWorklogDate(wl);

    // Epic parent resolution
    let epicKey = '';
    if (ticket?.fields?.parent?.key) {
      epicKey = ticket.fields.parent.key;
    }
    const epicTicket = epicKey ? epicsMap.get(epicKey) : null;
    const epicSummary = epicTicket?.fields?.summary || (epicKey ? epicKey : '');

    // Customfields extraction
    const fields = ticket?.fields || {};
    const budgetLine = extractFieldValue(fields[customFieldConfig.budgetLine]);
    const category = extractFieldValue(fields[customFieldConfig.category]);
    const lot = extractFieldValue(fields[customFieldConfig.lot]);
    
    // Resolve featureId based on Epic Summary -> Issue Summary -> Lot 21P090 override
    const rawFeatureIdField = extractFieldValue(fields[customFieldConfig.featureId]);
    const calculatedFeatureId = resolveFeatureId(epicSummary, fields.summary || '', lot, year);
    const featureId = calculatedFeatureId !== "-100" ? calculatedFeatureId : (rawFeatureIdField || "-100");

    const rawBusinessChange = extractFieldValue(fields[customFieldConfig.businessChange]);

    let businessChange: 'TRUE' | 'FALSE' = 'FALSE';
    if (rawBusinessChange && ['true', 'oui', 'yes', '1'].includes(rawBusinessChange.toLowerCase().trim())) {
      businessChange = 'TRUE';
    }

    // Labels & FixVersions
    const labels = Array.isArray(fields.labels) ? fields.labels.join(', ') : '';
    const fixVersions = Array.isArray(fields.fixVersions)
      ? fields.fixVersions.map((fv: any) => fv.name || fv).join(', ')
      : '';

    entries.push({
      budgetLine: budgetLine || 'NC',
      project: fields.project?.key || ticket?.key?.split('-')[0] || '',
      issueKey,
      category: category || 'NC',
      lot: lot || 'NC',
      entryTask: fields.summary || '',
      comment: wl.comment || '',
      ticketLink: `${cleanBaseUrl}/browse/${issueKey}`,
      collaborator: matchedCollab ? matchedCollab.name : authorName,
      type,
      timeInHours,
      timeInDays,
      estimatedInDays,
      status: fields.status?.name || 'Inconnu',
      issueType: fields.issuetype?.name || 'Inconnu',
      worklogDate,
      month,
      year,
      epicSummary,
      featureId: featureId || 'NC',
      role,
      labels,
      businessChange,
      fixVersions
    });
  }

  // Print diagnostic log for author categorization
  console.log(`\n👥 [TempoTransformer] Bilan de la catégorisation par Prénom & Nom (${worklogs.length} worklogs) :`);
  authorDiagnostic.forEach((info, author) => {
    if (info.type === 'Unknown') {
      console.warn(`   ⚠️ "${author}" -> Type: Unknown (Aucune correspondance prénom/nom dans la BDD !)`);
    } else {
      console.log(`   ✅ "${author}" -> Type: ${info.type} (Associé à "${info.matchedName}") [${info.count} worklogs]`);
    }
  });

  return { entries, anomalies };
}
