import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Extend window for Electron API
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getServerUrl: () => Promise<string>;
      saveServerUrl: (url: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      downloadFile: (url: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      printQuotationPdf: (pdfUrl: string) => Promise<boolean>;
    };
  }
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface ServerContextType {
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
  status: ConnectionStatus;
  latencyMs: number | null;
  lastSyncTime: Date | null;
  testConnection: (targetUrl?: string) => Promise<{ ok: boolean; message: string; latency: number }>;
  fetchApi: <T = any>(endpoint: string, options?: RequestInit) => Promise<T>;
  getPdfUrl: (quotationId: number) => string;
  getReceiptUrl: (paymentId: number) => string;
  subscribeToEvents: (callback: (event: any) => void) => () => void;
  openServerWizard: boolean;
  setOpenServerWizard: (open: boolean) => void;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    return localStorage.getItem('ama_server_url') || 'http://localhost:4000';
  });
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [openServerWizard, setOpenServerWizard] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Set<(event: any) => void>>(new Set());
  const reconnectTimeoutRef = useRef<any>(null);

  // Load persisted server URL from Electron preload if available
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServerUrl().then((savedUrl) => {
        if (savedUrl && savedUrl !== serverUrl) {
          setServerUrlState(savedUrl);
          localStorage.setItem('ama_server_url', savedUrl);
        }
      });
    }
  }, []);

  const saveUrl = async (newUrl: string) => {
    let cleanUrl = newUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    setServerUrlState(cleanUrl);
    localStorage.setItem('ama_server_url', cleanUrl);
    if (window.electronAPI) {
      await window.electronAPI.saveServerUrl(cleanUrl);
    }
    // Reconnect WebSocket to new server
    connectWebSocket(cleanUrl);
  };

  // Test connection to server
  const testConnection = async (targetUrl?: string): Promise<{ ok: boolean; message: string; latency: number }> => {
    const url = (targetUrl || serverUrl).trim().replace(/\/$/, '');
    const start = performance.now();
    try {
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const latency = Math.round(performance.now() - start);

      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          message: `Connected (${data.server || 'Server OK'}, DB: ${data.dbConnected ? 'Online' : 'Degraded'})`,
          latency,
        };
      } else {
        return { ok: false, message: `Server returned HTTP ${response.status}`, latency };
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      return { ok: false, message: err.message || 'Connection failed', latency };
    }
  };

  // Connect WebSocket for LAN real-time notifications
  const connectWebSocket = useCallback((urlToUse: string) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const wsUrl = urlToUse.replace(/^http/, 'ws') + '/ws';
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingStart = Date.now();
          ws.send(JSON.stringify({ type: 'PING' }));
          (ws as any)._lastPing = pingStart;
        }
      }, 15000);

      ws.onopen = () => {
        setStatus('connected');
        setLastSyncTime(new Date());
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PONG') {
            if ((ws as any)._lastPing) {
              setLatencyMs(Date.now() - (ws as any)._lastPing);
            }
          } else {
            setLastSyncTime(new Date());
            // Broadcast to subscribers
            subscribersRef.current.forEach((cb) => cb(data));
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setStatus('disconnected');
        // Auto-reconnect after 4 seconds
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(urlToUse);
        }, 4000);
      };

      ws.onerror = () => {
        setStatus('disconnected');
      };
    } catch (err) {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    connectWebSocket(serverUrl);
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [serverUrl, connectWebSocket]);

  // Subscribe to real-time events
  const subscribeToEvents = useCallback((callback: (event: any) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Central fetch wrapper with JWT token & error handling
  const fetchApi = useCallback(
    async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      const token = localStorage.getItem('ama_token');
      const headers = new Headers(options.headers || {});

      if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const fullUrl = `${serverUrl}${cleanEndpoint}`;

      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errMsg = `Request failed: HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }

      return response.json() as Promise<T>;
    },
    [serverUrl]
  );

  const getPdfUrl = useCallback(
    (quotationId: number) => {
      const token = localStorage.getItem('ama_token');
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      return `${serverUrl}/api/quotations/${quotationId}/pdf${query}`;
    },
    [serverUrl]
  );

  const getReceiptUrl = useCallback(
    (paymentId: number) => {
      const token = localStorage.getItem('ama_token');
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      return `${serverUrl}/api/payments/${paymentId}/receipt${query}`;
    },
    [serverUrl]
  );

  return (
    <ServerContext.Provider
      value={{
        serverUrl,
        setServerUrl: saveUrl,
        status,
        latencyMs,
        lastSyncTime,
        testConnection,
        fetchApi,
        getPdfUrl,
        getReceiptUrl,
        subscribeToEvents,
        openServerWizard,
        setOpenServerWizard,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
