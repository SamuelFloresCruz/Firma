"use client";

import { File as FileIcon, FileUp, RefreshCw } from "lucide-react";
import { DragEvent, useState } from "react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileDropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
  label?: string;
  hint?: string;
  maxSizeMb?: number;
}

function acceptsFile(file: File, accept: string): boolean {
  const rules = accept.split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0 || rules.includes("*/*")) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export function FileDropzone({ file, onFile, accept, label = "Arrastra tu archivo aquí", hint, maxSizeMb = 20 }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function select(nextFile?: File) {
    if (!nextFile) return;
    if (nextFile.size === 0) {
      onFile(null);
      setError("El archivo está vacío.");
      return;
    }
    if (nextFile.size > maxSizeMb * 1024 * 1024) {
      onFile(null);
      setError(`El archivo supera el límite de ${maxSizeMb} MB.`);
      return;
    }
    if (!acceptsFile(nextFile, accept)) {
      onFile(null);
      setError("El tipo de archivo no corresponde al formato seleccionado.");
      return;
    }
    setError("");
    onFile(nextFile);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    select(event.dataTransfer.files[0]);
  }

  return (
    <>
      <label
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <input type="file" accept={accept} aria-label={label} onChange={(event) => { select(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        {file ? (
          <div className="file-selected">
            <span className="dropzone-icon"><FileIcon size={28} /></span>
            <strong>{file.name}</strong>
            <span>{formatSize(file.size)} · Haz clic para reemplazar</span>
            <small><RefreshCw size={11} /> Seleccionado y listo</small>
          </div>
        ) : (
          <div>
            <span className="dropzone-icon"><FileUp size={28} /></span>
            <h3>{label}</h3>
            <p>o haz clic para buscarlo en tu equipo</p>
            <small>{hint ?? `Máximo ${maxSizeMb} MB`}</small>
          </div>
        )}
      </label>
      {error && <div className="form-message" style={{ marginTop: 9 }}>{error}</div>}
    </>
  );
}
