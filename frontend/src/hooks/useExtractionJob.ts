import { useState, useEffect, useRef, useCallback } from 'react';
import { TempoEntry, IExtractionJobStatus, IJobProgress, IExtractionRequest } from '../types/tempo';

const ACTIVE_JOB_KEY = 'active_tempo_job_id';

export interface UseExtractionJobReturn {
  jobId: string | null;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: IJobProgress | null;
  result: TempoEntry[] | null;
  anomalies: string[];
  error: string | null;
  elapsedSeconds: number;
  isConnectionLost: boolean;
  startJob: (request: IExtractionRequest) => Promise<void>;
  cancelJob: () => Promise<void>;
  resetJob: () => void;
}

export function useExtractionJob(): UseExtractionJobReturn {
  const [jobId, setJobId] = useState<string | null>(() => {
    return sessionStorage.getItem(ACTIVE_JOB_KEY);
  });
  const [status, setStatus] = useState<UseExtractionJobReturn['status']>('idle');
  const [progress, setProgress] = useState<IJobProgress | null>(null);
  const [result, setResult] = useState<TempoEntry[] | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitleRef = useRef<string>(document.title);

  // Tab title update helper
  const updateTabTitle = useCallback((percent: number | null, currentStatus: string) => {
    if (currentStatus === 'running' || currentStatus === 'queued') {
      if (percent !== null) {
        document.title = `(${percent}%) Extraction Tempo - CartOMC`;
      } else {
        document.title = `(⏳ En cours...) Extraction Tempo - CartOMC`;
      }
    } else {
      document.title = originalTitleRef.current || 'CartOMC - Capacity Planning';
    }
  }, []);

  // Clear all intervals and EventSource
  const cleanupConnections = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Fetch full status via polling
  const fetchJobStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/tempo/extractions/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          sessionStorage.removeItem(ACTIVE_JOB_KEY);
          setJobId(null);
          setStatus('idle');
        }
        return;
      }
      const data: IExtractionJobStatus = await res.json();
      setStatus(data.status);
      if (data.progress) setProgress(data.progress);
      if (data.anomalies) setAnomalies(data.anomalies);
      if (data.error) setError(data.error);

      if (data.status === 'completed' && data.result) {
        setResult(data.result);
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
        cleanupConnections();
        updateTabTitle(100, 'completed');
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
        cleanupConnections();
        updateTabTitle(null, data.status);
      }
    } catch (e) {
      // Polling network error
    }
  }, [cleanupConnections, updateTabTitle]);

  // Connect to SSE stream
  const connectSSE = useCallback((id: string) => {
    cleanupConnections();
    lastEventTimeRef.current = Date.now();
    setIsConnectionLost(false);

    // Client-side elapsed timer tick
    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const es = new EventSource(`http://localhost:4000/api/tempo/extractions/${id}/events`);
    eventSourceRef.current = es;

    const handleMessageOrProgress = () => {
      lastEventTimeRef.current = Date.now();
      setIsConnectionLost(false);
    };

    es.addEventListener('status', (e: MessageEvent) => {
      handleMessageOrProgress();
      const data = JSON.parse(e.data);
      setStatus(data.status);
      if (data.progress) setProgress(data.progress);
    });

    es.addEventListener('progress', (e: MessageEvent) => {
      handleMessageOrProgress();
      const data: IJobProgress = JSON.parse(e.data);
      setProgress(data);

      let pct: number | null = null;
      if (data.total && data.total > 0) {
        pct = Math.round((data.current / data.total) * 100);
      }
      updateTabTitle(pct, 'running');
    });

    es.addEventListener('heartbeat', () => {
      handleMessageOrProgress();
    });

    es.addEventListener('completed', () => {
      handleMessageOrProgress();
      fetchJobStatus(id);
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      handleMessageOrProgress();
      const data = JSON.parse(e.data);
      setStatus('failed');
      setError(data.error || 'Une erreur est survenue lors de l\'extraction.');
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      cleanupConnections();
      updateTabTitle(null, 'failed');
    });

    es.addEventListener('cancelled', () => {
      handleMessageOrProgress();
      setStatus('cancelled');
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      cleanupConnections();
      updateTabTitle(null, 'cancelled');
    });

    es.onerror = () => {
      setIsConnectionLost(true);
    };

    // Connection Health Monitor (check every 5 seconds, trigger polling if >30s silent)
    healthCheckIntervalRef.current = setInterval(() => {
      const silentMs = Date.now() - lastEventTimeRef.current;
      if (silentMs > 30000) {
        setIsConnectionLost(true);
        fetchJobStatus(id);
      }
    }, 5000);
  }, [cleanupConnections, fetchJobStatus, updateTabTitle]);

  // Restore existing job on load or when jobId changes
  useEffect(() => {
    if (jobId && (status === 'idle' || status === 'running' || status === 'queued')) {
      fetchJobStatus(jobId).then(() => {
        connectSSE(jobId);
      });
    }
    return () => {
      cleanupConnections();
    };
  }, [jobId]);

  // Launch job
  const startJob = async (reqData: IExtractionRequest) => {
    cleanupConnections();
    setResult(null);
    setAnomalies([]);
    setError(null);
    setElapsedSeconds(0);
    setStatus('queued');

    try {
      const res = await fetch('http://localhost:4000/api/tempo/extractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erreur HTTP ' + res.status }));
        throw new Error(errData.error || 'Échec du lancement du job');
      }

      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);
      sessionStorage.setItem(ACTIVE_JOB_KEY, newJobId);
      connectSSE(newJobId);
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Impossible de démarrer l\'extraction');
    }
  };

  // Cancel job
  const cancelJob = async () => {
    if (!jobId) return;
    try {
      await fetch(`http://localhost:4000/api/tempo/extractions/${jobId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      // Ignore network errors on cancel
    } finally {
      setStatus('cancelled');
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      cleanupConnections();
      updateTabTitle(null, 'cancelled');
    }
  };

  // Reset job
  const resetJob = () => {
    cleanupConnections();
    setJobId(null);
    setStatus('idle');
    setProgress(null);
    setResult(null);
    setAnomalies([]);
    setError(null);
    setElapsedSeconds(0);
    setIsConnectionLost(false);
    sessionStorage.removeItem(ACTIVE_JOB_KEY);
    updateTabTitle(null, 'idle');
  };

  return {
    jobId,
    status,
    progress,
    result,
    anomalies,
    error,
    elapsedSeconds,
    isConnectionLost,
    startJob,
    cancelJob,
    resetJob
  };
}
