import React from 'react';
import { ExternalLink } from 'lucide-react';

const ExternalTracking: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">外部物流查询</h1>
        <a
          href="https://flytrack.zq-zn.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition"
        >
          <ExternalLink className="w-4 h-4" />
          在新窗口打开
        </a>
      </div>
      
      <iframe
        src="https://flytrack.zq-zn.com/"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 64px)' }}
        title="FlyTrack 物流查询"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};

export default ExternalTracking;
