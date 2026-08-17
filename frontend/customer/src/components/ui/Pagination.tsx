import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  showQuickJumper?: boolean;
  showSizeChanger?: boolean;
  showTotal?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  showQuickJumper = true,
  showSizeChanger = true,
  showTotal = true,
  className = '',
  disabled = false,
}: PaginationProps) {
  const [jumpPage, setJumpPage] = useState<string>('');

  const safeTotalPages = Math.max(1, totalPages || Math.ceil((totalItems || 0) / (pageSize || 10)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];

    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);

      if (safeCurrentPage > 4) {
        pages.push('ellipsis-start');
      }

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        if (i > 1 && i < safeTotalPages) {
          pages.push(i);
        }
      }

      if (safeCurrentPage < safeTotalPages - 3) {
        pages.push('ellipsis-end');
      }

      // Always show last page
      pages.push(safeTotalPages);
    }

    return pages;
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= safeTotalPages) {
      onPageChange(pageNum);
      setJumpPage('');
    } else if (pageNum > safeTotalPages) {
      onPageChange(safeTotalPages);
      setJumpPage('');
    } else if (pageNum < 1) {
      onPageChange(1);
      setJumpPage('');
    }
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left: Total Records Info */}
      {showTotal && (
        <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap">
          <span>
            共 <strong className="font-semibold text-slate-800">{totalItems}</strong> 条数据
          </span>
          {totalItems > 0 && (
            <span className="hidden md:inline text-slate-400">
              (显示第 {startItem}-{endItem} 条)
            </span>
          )}
          <span className="inline-block md:hidden text-slate-400">
            {safeCurrentPage}/{safeTotalPages} 页
          </span>
        </div>
      )}

      {/* Center / Right: Page Controls */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
        {/* Page Size Selector */}
        {showSizeChanger && onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2">
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="每页显示条数"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} 条/页
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Buttons: First & Prev */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="第一页"
            disabled={disabled || safeCurrentPage <= 1}
            onClick={() => onPageChange(1)}
            aria-label="跳转到第一页"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed transition-all"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="上一页"
            disabled={disabled || safeCurrentPage <= 1}
            onClick={() => onPageChange(safeCurrentPage - 1)}
            aria-label="上一页"
            className="flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 hover:border-slate-400 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:cursor-not-allowed shadow-2xs transition-all font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">上一页</span>
          </button>
        </div>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis-start' || p === 'ellipsis-end') {
              return (
                <span
                  key={`${p}-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-slate-400"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </span>
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(p)}
                aria-label={`第 ${p} 页`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                    : 'text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons: Next & Last */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="下一页"
            disabled={disabled || safeCurrentPage >= safeTotalPages}
            onClick={() => onPageChange(safeCurrentPage + 1)}
            aria-label="下一页"
            className="flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 hover:border-slate-400 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:cursor-not-allowed shadow-2xs transition-all font-medium"
          >
            <span className="hidden sm:inline">下一页</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="最后一页"
            disabled={disabled || safeCurrentPage >= safeTotalPages}
            onClick={() => onPageChange(safeTotalPages)}
            aria-label="跳转到最后一页"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed transition-all"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Jumper */}
        {showQuickJumper && safeTotalPages > 1 && (
          <form onSubmit={handleJump} className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400">跳至</span>
            <input
              type="number"
              min={1}
              max={safeTotalPages}
              value={jumpPage}
              disabled={disabled}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={String(safeCurrentPage)}
              aria-label="跳转目标页码"
              className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            />
            <span className="text-slate-400">页</span>
            {jumpPage && (
              <button
                type="submit"
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors"
              >
                确定
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default Pagination;
