/**
 * 健壮的跨环境剪贴板复制工具函数
 * 支持 localhost、HTTPS 以及局域网 HTTP IP 访问等非安全上下文环境，
 * 自动在 navigator.clipboard 与 document.execCommand 之间平滑回退，杜绝 TypeError。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. 优先尝试现代 Navigator Clipboard API (仅在 Secure Context 下有效)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
    }
  }

  // 2. 传统 DOM 回退方案 (创建临时 textarea 执行 document.execCommand('copy'))
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 避免移动端滚动与视觉闪烁
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}
