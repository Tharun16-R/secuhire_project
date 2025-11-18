import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Start from './pages/Start';
import Round from './pages/Round';
import Final from './pages/Final';

export default function AptitudeApp() {
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname === '/aptitude') navigate('start', { replace: true });
  }, [navigate]);

  return (
    <Routes>
      <Route path="start" element={<Start />} />
      <Route path="round/:roundId" element={<Round />} />
      <Route path="final/:sessionId" element={<Final />} />
    </Routes>
  );
}
