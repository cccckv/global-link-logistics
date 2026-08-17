import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react';
import { uploadV2Api } from '../../lib/v2-api';

interface LocalFileUploadProps {
  label?: string;
  value: string;
  fileName?: string;
  onChange: (url: string, fileName?: string) => void;
  accept?: string;
  helperText?: string;
  required?: boolean;
}

export const LocalFileUpload: React.FC<LocalFileUploadProps> = ({
  label,
  value,
  fileName,
  onChange,
  accept = 'image/*,application/pdf,.xlsx,.xls,.docx,.doc',
  helperText = '支持直接从本地电脑选择图片、PDF、Excel或Word单据 (最大 20MB)',
  required = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlMode, setShowUrlMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image');
  };

  const isPdf = (url: string) => {
    return /\.pdf(\?.*)?$/i.test(url);
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('文件过大，单文件限制 20MB 以内');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadV2Api.upload(file);
      if (res.data.success) {
        toast.success(`文件【${file.name}】上传成功！`);
        onChange(res.data.data.fileUrl, file.name);
      } else {
        toast.error('上传失败，请重试');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '本地文件上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <button
            type="button"
            onClick={() => setShowUrlMode(!showUrlMode)}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            {showUrlMode ? '切换为本地选文件' : '或输入网络链接'}
          </button>
        </div>
      )}

      {showUrlMode ? (
        <div className="space-y-1">
          <input
            type="text"
            placeholder="http://... 或输入网络图片/文件 URL"
            value={value}
            onChange={(e) => onChange(e.target.value, fileName)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : value ? (
        /* File Uploaded Preview Card */
        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {isImage(value) ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-blue-200 bg-white flex-shrink-0 relative group">
                <img
                  src={value.startsWith('http') ? value : `http://localhost:3000${value}`}
                  alt="preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to icon if load fails
                    (e.target as any).style.display = 'none';
                  }}
                />
              </div>
            ) : isPdf(value) ? (
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                PDF
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate" title={fileName || value}>
                {fileName || value.split('/').pop()}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> 本地上传就绪
                </span>
                <a
                  href={value.startsWith('http') ? value : `http://localhost:3000${value}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> 预览原件
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs"
            >
              更换
            </button>
            <button
              type="button"
              onClick={() => onChange('', '')}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
              title="移除附件"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Empty Upload Drop Area */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-white'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xs font-semibold text-blue-700">正在上传本地文件中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1 space-y-1">
              <div className="p-2 bg-blue-100/60 text-blue-600 rounded-full mb-1">
                <Upload className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                点击选择本地文件 <span className="text-slate-400 font-normal">或拖拽文件至此</span>
              </p>
              <p className="text-[11px] text-slate-400 font-normal">
                {helperText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileChange(e.target.files[0]);
          }
        }}
        className="hidden"
      />
    </div>
  );
};
