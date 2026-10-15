export interface JiraTempoOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxConcurrency?: number;
}

export interface RawTempoWorklog {
  id?: number | string;
  issue?: {
    key: string;
    id?: number | string;
  };
  author?: {
    name?: string;
    displayName?: string;
  };
  dateStarted?: string;
  worklogDate?: string;
  timeSpentSeconds?: number;
  comment?: string;
}

export interface JiraVersionInfo {
  id?: string;
  name: string;
  released?: boolean;
  archived?: boolean;
  releaseDate?: string;
  description?: string;
}

export interface RawJiraIssue {
  key: string;
  fields: {
    summary?: string;
    status?: { name: string };
    issuetype?: { name: string };
    project?: { key: string; name: string };
    timetracking?: { originalEstimateSeconds?: number };
    labels?: string[];
    fixVersions?: JiraVersionInfo[];
    parent?: { key: string };
    [key: string]: any;
  };
}

// Allow internal enterprise HTTPS self-signed / enterprise CA certificates if needed
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export class JiraTempoClient {
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;
  private maxConcurrency: number;
  private activeRequests = 0;
  private queue: Array<() => void> = [];

  constructor(options: JiraTempoOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs || 60000;
    this.maxConcurrency = options.maxConcurrency || 5;
  }

  private async acquireTokenSlot(abortSignal?: AbortSignal): Promise<void> {
    if (this.activeRequests < this.maxConcurrency) {
      this.activeRequests++;
      return;
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new Error('Operation cancelled'));
      };
      if (abortSignal?.aborted) {
        return reject(new Error('Operation cancelled'));
      }
      abortSignal?.addEventListener('abort', onAbort, { once: true });

      this.queue.push(() => {
        abortSignal?.removeEventListener('abort', onAbort);
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseTokenSlot(): void {
    this.activeRequests--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit, abortSignal?: AbortSignal, maxRetries = 2): Promise<Response> {
    let attempt = 0;
    let delay = 1000;

    const method = init.method || 'GET';
    console.log(`\n📡 [JiraTempoClient] ${method} ${url}`);
    if (init.body) {
      console.log(`   Payload: ${init.body}`);
    }

    while (true) {
      attempt++;
      await this.acquireTokenSlot(abortSignal);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      
      const onExternalAbort = () => controller.abort();
      if (abortSignal) {
        abortSignal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal
        });
        clearTimeout(timer);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onExternalAbort);
        }

        console.log(`✅ [JiraTempoClient] ${method} ${url} -> HTTP ${res.status} ${res.statusText}`);

        if (res.ok) {
          this.releaseTokenSlot();
          return res;
        }

        // Handle HTTP error responses
        const errText = await res.text().catch(() => '');
        console.error(`❌ [JiraTempoClient] HTTP ${res.status} sur ${url}:`, errText.slice(0, 400));

        // Retry on 429 Rate Limit or 5xx Server Errors
        if ((res.status === 429 || res.status >= 500) && attempt <= maxRetries) {
          this.releaseTokenSlot();
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
          console.warn(`⏳ [JiraTempoClient] Retry ${attempt}/${maxRetries} dans ${waitMs}ms...`);
          await new Promise((r) => setTimeout(r, waitMs));
          delay *= 2;
          continue;
        }

        this.releaseTokenSlot();
        throw new Error(`HTTP ${res.status} (${res.statusText}) sur ${url}: ${errText.slice(0, 300)}`);
      } catch (err: any) {
        clearTimeout(timer);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onExternalAbort);
        }
        this.releaseTokenSlot();

        if (abortSignal?.aborted || err.name === 'AbortError') {
          if (abortSignal?.aborted) {
            throw new Error('Operation annulée par l\'utilisateur');
          }
          if (attempt <= maxRetries) {
            console.warn(`⏳ [JiraTempoClient] Retry ${attempt}/${maxRetries} après timeout...`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
            continue;
          }
          throw new Error(`Timeout après ${this.timeoutMs}ms sur ${url}`);
        }

        if (attempt <= maxRetries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
          console.warn(`⏳ [JiraTempoClient] Retry ${attempt}/${maxRetries} après erreur réseau...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        throw err;
      }
    }
  }

  /**
   * Fetch Tempo worklogs using Tempo Data Center REST endpoints with fallback to XML Servlet
   */
  async getTempoWorklogs(dateFrom: string, dateTo: string, projectKey: string, abortSignal?: AbortSignal): Promise<RawTempoWorklog[]> {
    const attempts = [
      // Format 1: Legacy Servlet XML format (includes addUserDetails=true for full name / user details)
      {
        url: `${this.baseUrl}/plugins/servlet/tempo-getWorklog/?tempoApiToken=${encodeURIComponent(this.token)}&dateFrom=${dateFrom}&dateTo=${dateTo}&format=xml&projectKey=${projectKey}&addWorklogDetails=true&addIssueDetails=true&addUserDetails=true&addIssueSummary=true`,
        method: 'GET',
        headers: { 'Accept': 'application/xml, text/xml, */*' }
      },
      // Format 2: REST GET /rest/tempo-timesheets/4/worklogs?dateFrom=...&dateTo=...&projectKey=...
      {
        url: `${this.baseUrl}/rest/tempo-timesheets/4/worklogs?dateFrom=${dateFrom}&dateTo=${dateTo}&projectKey=${projectKey}`,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      },
      // Format 3: REST GET /rest/tempo-timesheets/4/worklogs?from=...&to=...&projectKey=...
      {
        url: `${this.baseUrl}/rest/tempo-timesheets/4/worklogs?from=${dateFrom}&to=${dateTo}&projectKey=${projectKey}`,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      },
      // Format 4: POST /rest/tempo-timesheets/4/worklogs/search with "projectKey": ["GTEP"]
      {
        url: `${this.baseUrl}/rest/tempo-timesheets/4/worklogs/search`,
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: JSON.stringify({ from: dateFrom, to: dateTo, projectKey: [projectKey] })
      }
    ];

    let lastError: Error | null = null;

    for (const config of attempts) {
      try {
        const init: RequestInit = {
          method: config.method,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...(config.headers || {})
          }
        };
        if (config.body) {
          init.body = config.body;
        }

        const res = await this.fetchWithRetry(config.url, init, abortSignal, 1);
        const text = await res.text();

        // Handle XML Response from Servlet
        if (text.trim().startsWith('<')) {
          const parsedXmlWorklogs = this.parseXmlWorklogs(text);
          console.log(`🎉 [JiraTempoClient] Tempo Worklogs XML récupérés avec succès (${parsedXmlWorklogs.length} éléments).`);
          return parsedXmlWorklogs;
        }

        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : (data.worklogs || data.values || []);
        console.log(`🎉 [JiraTempoClient] Tempo Worklogs récupérés avec succès (${list.length} éléments).`);
        return list;
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ [JiraTempoClient] Tentative endpoint Tempo échouée: ${err.message}`);
      }
    }

    throw lastError || new Error('Aucun endpoint Tempo Timesheets n\'a répondu avec succès.');
  }

  /**
   * Helper to parse XML worklogs from legacy Tempo Servlet endpoint
   */
  private parseXmlWorklogs(xmlText: string): RawTempoWorklog[] {
    const worklogs: RawTempoWorklog[] = [];
    const worklogMatches = xmlText.match(/<worklog[\s\S]*?<\/worklog>/g) || [];

    for (const wlXml of worklogMatches) {
      const getTag = (tag: string) => {
        const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(wlXml);
        return m ? m[1].trim() : '';
      };

      const issueKey = getTag('issue_key') || getTag('issue_id');
      const worklogDate = getTag('work_date') || getTag('date_started');
      const timeSpentSeconds = parseFloat(getTag('hours') || '0') * 3600 || parseInt(getTag('billing_seconds') || getTag('seconds') || '0', 10);
      const comment = getTag('work_description') || getTag('comment');
      const id = getTag('worklog_id') || getTag('id');

      // User details extraction from XML <user_details> or <user>
      const userFullName = getTag('display_name') || getTag('user_full_name') || getTag('full_name');
      const username = getTag('user_name') || getTag('username') || getTag('user') || getTag('author_netid');

      worklogs.push({
        id,
        issue: { key: issueKey },
        author: {
          name: username || 'Inconnu',
          displayName: userFullName || username || 'Inconnu'
        },
        worklogDate,
        dateStarted: worklogDate,
        timeSpentSeconds,
        comment
      });
    }

    return worklogs;
  }

  /**
   * Search Jira Issues using JQL with pagination (startAt / maxResults)
   */
  async searchJiraIssues(
    jql: string,
    fields: string[],
    onProgress?: (fetched: number, total: number) => void,
    abortSignal?: AbortSignal
  ): Promise<RawJiraIssue[]> {
    const issues: RawJiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;
    let total = 0;

    console.log(`🔍 [JiraTempoClient] Recherche des tickets Jira via JQL: "${jql}"`);

    do {
      const url = `${this.baseUrl}/rest/api/2/search`;
      const res = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jql,
          startAt,
          maxResults,
          fields
        })
      }, abortSignal);

      const data = await res.json();
      const pageIssues: RawJiraIssue[] = data.issues || [];
      total = data.total || pageIssues.length;
      issues.push(...pageIssues);
      startAt += pageIssues.length;

      console.log(`📦 [JiraTempoClient] Page Jira récupérée: ${issues.length} / ${total} tickets.`);

      if (onProgress) {
        onProgress(issues.length, total);
      }

      if (pageIssues.length === 0) break;
    } while (startAt < total);

    return issues;
  }

  /**
   * Get single Jira issue (used for Epic summary deduplicated fetch)
   */
  async getJiraIssue(issueKey: string, fields: string[] = ['summary'], abortSignal?: AbortSignal): Promise<RawJiraIssue | null> {
    try {
      const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}?fields=${fields.join(',')}`;
      const res = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        }
      }, abortSignal);

      return await res.json();
    } catch (err: any) {
      console.warn(`⚠️ [JiraTempoClient] Impossible de récupérer le détail du ticket ${issueKey}: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch real Jira User details (displayName, emailAddress, etc.) by key or username
   */
  async getUserDetails(userKeyOrName: string, abortSignal?: AbortSignal): Promise<{ displayName?: string; name?: string; emailAddress?: string } | null> {
    try {
      const url = `${this.baseUrl}/rest/api/2/user?username=${encodeURIComponent(userKeyOrName)}`;
      const res = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        }
      }, abortSignal);

      const userObj = await res.json();
      return userObj;
    } catch (err: any) {
      // Try alternative endpoint parameter key=
      try {
        const altUrl = `${this.baseUrl}/rest/api/2/user?key=${encodeURIComponent(userKeyOrName)}`;
        const altRes = await this.fetchWithRetry(altUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json'
          }
        }, abortSignal);
        return await altRes.json();
      } catch (altErr) {
        return null;
      }
    }
  }

  /**
   * Batch resolve unique user keys to real Jira display names
   */
  async batchResolveUsers(userKeys: string[], abortSignal?: AbortSignal): Promise<Map<string, string>> {
    const userMap = new Map<string, string>();
    const uniqueKeys = Array.from(new Set(userKeys.filter(Boolean)));

    console.log(`👤 [JiraTempoClient] Résolution des profils utilisateurs Jira (${uniqueKeys.length} utilisateurs uniques)...`);

    for (const key of uniqueKeys) {
      if (!key.startsWith('JIRAUSER') && !/^\d+$/.test(key) && key.includes(' ')) {
        // Already a real display name
        userMap.set(key, key);
        continue;
      }

      const userDetails = await this.getUserDetails(key, abortSignal);
      if (userDetails && userDetails.displayName) {
        userMap.set(key, userDetails.displayName);
        console.log(`   ✅ Profil Jira résolu: ${key} -> "${userDetails.displayName}"`);
      }
    }

    return userMap;
  }

  /**
   * Fetch worklogs directly for a single Jira Issue key (e.g. HP-26)
   */
  async getIssueWorklogsDirect(issueKey: string, abortSignal?: AbortSignal): Promise<RawTempoWorklog[]> {
    try {
      const url = `${this.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog`;
      console.log(`🎫 [JiraTempoClient] Interrogation directe des worklogs pour le ticket ${issueKey}...`);

      const res = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        }
      }, abortSignal);

      const data = await res.json();
      const rawList: any[] = data.worklogs || [];

      console.log(`✅ [JiraTempoClient] ${rawList.length} worklogs bruts récupérés sur Jira pour ${issueKey}.`);

      const formatted: RawTempoWorklog[] = rawList.map((wl) => ({
        id: wl.id,
        issue: { key: issueKey },
        author: {
          name: wl.author?.name || wl.author?.key || wl.author?.displayName || 'Inconnu',
          displayName: wl.author?.displayName || wl.author?.name || wl.author?.key || 'Inconnu'
        },
        worklogDate: wl.started || wl.dateStarted,
        dateStarted: wl.started || wl.dateStarted,
        timeSpentSeconds: wl.timeSpentSeconds || 0,
        comment: wl.comment || ''
      }));

      return formatted;
    } catch (err: any) {
      console.warn(`⚠️ [JiraTempoClient] Erreur lors de la récupération directe des worklogs pour ${issueKey}: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetch all project versions directly from Jira Project endpoint
   */
  async getProjectVersions(projectKey: string, abortSignal?: AbortSignal): Promise<JiraVersionInfo[]> {
    try {
      const url = `${this.baseUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}/versions`;
      console.log(`🏷️ [JiraTempoClient] Récupération des versions Jira pour le projet ${projectKey}...`);

      const res = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        }
      }, abortSignal);

      const versions: any[] = await res.json();
      if (!Array.isArray(versions)) {
        return [];
      }

      console.log(`✅ [JiraTempoClient] ${versions.length} versions récupérées pour ${projectKey}.`);
      return versions.map((v) => ({
        id: String(v.id || ''),
        name: v.name,
        released: Boolean(v.released),
        archived: Boolean(v.archived),
        releaseDate: v.releaseDate,
        description: v.description
      }));
    } catch (err: any) {
      console.warn(`⚠️ [JiraTempoClient] Erreur lors de la récupération des versions du projet ${projectKey}: ${err.message}`);
      return [];
    }
  }
}

