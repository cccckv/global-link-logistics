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
  Plus,
} from 'lucide-react';
import { uploadV2Api } from '../../lib/v2-api';

export interface UploadedFileItem {
  url: string;
  name: string;
  size?: number;
}

interface LocalFileUploadProps {
  label?: string;
  // Single-file mode
  value?: string;
  fileName?: string;
  onChange?: (url: string, fileName?: string) => void;
  // Multi-file mode
  multiple?: boolean;
  multipleFiles?: UploadedFileItem[];
  onMultipleChange?: (files: UploadedFileItem[]) => void;
  accept?: string;
  helperText?: string;
  required?: boolean;
}

export const LocalFileUpload: React.FC<LocalFileUploadProps> = ({
  label,
  value = '',
  fileName = '',
  onChange,
  multiple = false,
  multipleFiles = [],
  onMultipleChange,
  accept = 'image/*,application/pdf,.xlsx,.xls,.docx,.doc',
  helperText,
  required = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlMode, setShowUrlMode] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image');
  };

  const isPdf = (url: string) => {
    return /\.pdf(\?.*)?$/i.test(url);
  };

  // Upload a single file
  const uploadSingleFile = async (file: File): Promise<UploadedFileItem | null> => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`文件【${file.name}】过大，单文件限制 20MB 以内`);
      return null;
    }
    const res = await uploadV2Api.upload(file);
    if (res.data.success) {
      return {
        url: res.data.data.fileUrl,
        name: file.name,
        size: file.size,
      };
    }
    return null;
  };

  // Handle file(s) selected via input or drop
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    if (!multiple) {
      // Single Mode
      const file = files[0];
      if (file.size > 20 * 1024 * 1024) {
        toast.error('文件过大，单文件限制 20MB 以内');
        return;
      }

      setIsUploading(true);
      try {
        const item = await uploadSingleFile(file);
        if (item && onChange) {
          toast.success(`文件【${file.name}】上传成功！`);
          onChange(item.url, item.name);
        } else {
          toast.error('上传失败，请重试');
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error || '本地文件上传失败');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Multi Mode
      const fileArray = Array.from(files);
      setIsUploading(true);
      setUploadProgressText(`正在上传 0 / ${fileArray.length}...`);

      const uploaded: UploadedFileItem[] = [];
      let successCount = 0;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgressText(`正在上传 (${i + 1}/${fileArray.length}): ${file.name}`);
        try {
          const item = await uploadSingleFile(file);
          if (item) {
            uploaded.push(item);
            successCount++;
          }
        } catch (err) {
          console.error('File upload failed:', file.name, err);
        }
      }

      setIsUploading(false);
      setUploadProgressText('');

      if (uploaded.length > 0) {
        toast.success(`成功批量上传 ${successCount} 个文件！`);
        if (onMultipleChange) {
          onMultipleChange([...multipleFiles, ...uploaded]);
        }
      } else {
        toast.error('批量上传失败，请检查文件格式后重试');
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleAddManualUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrlInput.trim()) return;
    const cleanUrl = manualUrlInput.trim();
    const guessedName = cleanUrl.split('/').pop()?.split('?')[0] || '网络凭证图片';

    if (multiple) {
      if (onMultipleChange) {
        onMultipleChange([...multipleFiles, { url: cleanUrl, name: guessedName }]);
      }
      setManualUrlInput('');
      toast.success('已追加网络链接凭单');
    } else {
      if (onChange) {
        onChange(cleanUrl, guessedName);
      }
      setShowUrlMode(false);
    }
  };

  const removeMultiFile = (idxToRemove: number) => {
    if (onMultipleChange) {
      onMultipleChange(multipleFiles.filter((_, idx) => idx !== idxToRemove));
    }
  };

  const defaultHelper = multiple
    ? '支持同时按住 Ctrl / Shift 批量选择多张照片、PDF或拖拽多个文件'
    : '支持直接从本地电脑选择图片、PDF、Excel或Word单据 (最大 20MB)';

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
            {multiple && multipleFiles.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                已选 {multipleFiles.length} 个
              </span>
            )}
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

      {/* Manual URL Input Box */}
      {showUrlMode && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-300 rounded-lg">
          <input
            type="text"
            placeholder="http://... 输入网络图片或文档 URL 后按回车添加"
            value={manualUrlInput}
            onChange={(e) => setManualUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualUrl(e);
              }
            }}
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddManualUrl}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
          >
            添加
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MULTIPLE MODE RENDER */}
      {/* ========================================================= */}
      {multiple ? (
        <div className="space-y-3">
          {/* Uploaded Files Grid */}
          {multipleFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-2 bg-slate-50/70 border border-slate-200 rounded-xl">
              {multipleFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-blue-300 transition flex flex-col"
                >
                  <div className="h-20 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {isImage(file.url) ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : isPdf(file.url) ? (
                      <div className="w-8 h-8 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}

                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMultiFile(idx);
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition shadow-xs"
                      title="删除此文件"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-1.5 flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-semibold text-slate-700 truncate" title={file.name}>
                      {file.name}
                    </span>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                      title="在新窗口预览"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Drop Zone / Add More Button */}
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
                <span className="text-xs font-semibold text-blue-700">
                  {uploadProgressText || '正在并发批量上传中...'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-1 space-y-1">
                <div className="p-2 bg-blue-100/60 text-blue-600 rounded-full mb-0.5">
                  {multipleFiles.length > 0 ? <Plus className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {multipleFiles.length > 0 ? (
                    <>点击继续选择或拖入更多图片/文件</>
                  ) : (
                    <>
                      点击批量选择图片/文件 <span className="text-slate-400 font-normal">或拖拽多张图片至此</span>
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-400 font-normal">
                  {helperText || defaultHelper}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* SINGLE MODE RENDER */
        /* ========================================================= */
        <div>
          {value ? (
            /* Single File Uploaded Preview Card */
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {isImage(value) ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-blue-200 bg-white flex-shrink-0 relative group">
                    <img
                      src={value}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.style.display = 'none';
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
                      <CheckCircle2 className="w-3 h-3" /> 上传就绪
                    </span>
                    <a
                      href={value}
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
                  onClick={() => onChange && onChange('', '')}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  title="移除附件"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Single Empty Drop Zone */
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
                    {helperText || defaultHelper}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset input so re-selecting same file triggers onChange
            e.target.value = '';
          }
        }}
        className="hidden"
      />
    </div>
  );
};
