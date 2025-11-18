import React, { useEffect, useState } from "react";
import axios from "axios";

// Props: filters { companyId?, jobId?, candidateId? }
export default function VideoList({ filters = {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filters.companyId) params.companyId = filters.companyId;
        if (filters.jobId) params.jobId = filters.jobId;
        if (filters.candidateId) params.candidateId = filters.candidateId;
        const { data } = await axios.get(`${backendUrl}/api/video-submissions`, { params });
        setItems(data?.items || []);
      } catch (e) {
        console.error(e);
        setError(e?.response?.data?.detail || e.message || "Failed to load videos");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [backendUrl, filters.companyId, filters.jobId, filters.candidateId]);

  if (loading) return <div>Loading videos...</div>;
  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;

  if (!items.length) return <div>No videos found.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {items.map((it) => (
        <div key={it.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{it.full_name || it.candidate_email || it.candidate_id}</strong>
            {it.job_id ? <span style={{ marginLeft: 8, color: "#6b7280" }}>Job: {it.job_id}</span> : null}
          </div>
          <video src={it.video_url} controls preload="metadata" style={{ width: "100%", maxHeight: 360 }} />
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
            Uploaded: {new Date(it.created_at).toLocaleString()} {it.size_bytes ? `• ${(it.size_bytes / (1024*1024)).toFixed(1)} MB` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
