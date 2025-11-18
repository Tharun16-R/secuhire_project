import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRForPhoneJoin({ phoneJoinToken }) {
  const canvasRef = useRef(null);
  const [manualIp, setManualIp] = useState('');
  const [connectivity, setConnectivity] = useState('idle'); // idle | loading | ok | fail

  const base = useMemo(() => {
    // A) Explicit public base URL from env
    const envBase = process.env.REACT_APP_PUBLIC_BASE_URL && process.env.REACT_APP_PUBLIC_BASE_URL.trim();
    if (envBase) return envBase;

    // B) Explicit laptop IP from env
    const envIp = process.env.REACT_APP_LAPTOP_IP && process.env.REACT_APP_LAPTOP_IP.trim();
    if (envIp) return `http://${envIp}:3000`;

    // C) Detect from current origin/hostname (works when dev server is bound to 0.0.0.0)
    try {
      if (typeof window !== 'undefined' && window.location) {
        const { hostname, port, protocol } = window.location;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          const p = port || '3000';
          const scheme = protocol || 'http:';
          return `${scheme}//${hostname}:${p}`;
        }
      }
    } catch {
      // ignore
    }

    // D) No detection possible; rely on manual input
    return manualIp ? `http://${manualIp}:3000` : null;
  }, [manualIp]);

  const url = base && phoneJoinToken
    ? `${base.replace(/\/$/, '')}/phone-join?token=${encodeURIComponent(phoneJoinToken)}`
    : '';

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 240 });
  }, [url]);

  const handleTestConnectivity = async () => {
    if (!base) return;
    setConnectivity('loading');
    try {
      const healthUrl = `${base.replace(/\/$/, '')}/health`;
      const res = await fetch(healthUrl, { method: 'GET' });
      setConnectivity(res.ok ? 'ok' : 'fail');
    } catch {
      setConnectivity('fail');
    }
  };

  const showManualInput = !base || (!process.env.REACT_APP_PUBLIC_BASE_URL && !process.env.REACT_APP_LAPTOP_IP && !manualIp);

  return (
    <div style={{ textAlign: 'center', fontSize: 12, color: '#111827' }}>
      <canvas ref={canvasRef} />
      {showManualInput && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 4 }}>Please enter your laptop IP manually:</div>
          <input
            type="text"
            placeholder="e.g. 10.0.0.5"
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value.trim())}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              width: '100%',
              fontSize: 12,
            }}
          />
        </div>
      )}

      <div style={{ marginTop: 8, wordBreak: 'break-all', color: '#667085' }}>
        {url || 'Base URL not set yet.'}
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={handleTestConnectivity}
          disabled={!base || connectivity === 'loading'}
          style={{
            padding: '4px 10px',
            borderRadius: 9999,
            border: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            fontSize: 11,
            cursor: base ? 'pointer' : 'not-allowed',
          }}
        >
          {connectivity === 'loading' ? 'Testing...' : 'Test Connectivity'}
        </button>
        {connectivity === 'ok' && (
          <span style={{ marginLeft: 8, color: '#16a34a' }}>● OK</span>
        )}
        {connectivity === 'fail' && (
          <span style={{ marginLeft: 8, color: '#dc2626' }}>● Fail</span>
        )}
      </div>
    </div>
  );
}
