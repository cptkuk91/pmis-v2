"use client";

import { useState, type ChangeEvent } from "react";

type FileUploadProps = {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export function FileUpload({
  label = "첨부파일",
  accept,
  multiple = false,
  onFilesChange,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setFiles(nextFiles);
    onFilesChange?.(nextFiles);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="block w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
      />
      {files.length > 0 ? (
        <ul className="space-y-1 text-xs text-foreground-muted">
          {files.map((file) => (
            <li key={file.name}>
              {file.name} ({Math.ceil(file.size / 1024)} KB)
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-foreground-muted">선택된 파일 없음</p>
      )}
    </div>
  );
}
