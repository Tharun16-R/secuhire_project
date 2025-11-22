import React, { useState } from "react";
import { storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import axios from "axios";

// Props: candidateId, candidateEmail, fullName, jobId (optional), onUploaded(url)
export default function VideoUpload({ candidateId, candidateEmail, fullName, jobId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }
    const maxBytes = 200 * 1024 * 1024; // 200MB
    if (f.size > maxBytes) {
      setError("File too large. Max 200MB");
      return;
    }
    setError("");
    setFile(f);
  };

  const startUpload = async () => {
    if (!file || !candidateId) {
      setError("Missing file or candidateId");
      return;
    }
    try {
      setUploading(true);
      const path = `videos/${candidateId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

      task.on("state_changed", (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setProgress(pct);
      });

      await task;
      const url = await getDownloadURL(storageRef);

      // Save metadata to backend
      await axios.post(`${backendUrl}/api/video-submissions`, {
        candidateId,
        candidateEmail,
        fullName,
        jobId,
        videoUrl: url,
        sizeBytes: file.size,
      });

      if (onUploaded) onUploaded(url);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", padding: 16, borderRadius: 8 }}>
      <h3 style={{ marginBottom: 8 }}>Upload Interview Video</h3>
      <input type="file" accept="video/*" onChange={onFileChange} />
      {file && <div style={{ marginTop: 8 }}>Selected: {file.name}</div>}
      {uploading && <div style={{ marginTop: 8 }}>Uploading: {progress}%</div>}
      {error && <div style={{ marginTop: 8, color: "#dc2626" }}>{error}</div>}
      <button onClick={startUpload} disabled={!file || uploading} style={{ marginTop: 8 }}>
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}
