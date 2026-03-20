import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Plane, Ship, Zap } from 'lucide-react';
import Globe3D from '../components/Globe3D';

export default function Home() {
  const navigate = useNavigate();
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      navigate(`/tracking?number=${encodeURIComponent(trackingNumber.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="relative h-[600px] bg-primary-dark overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <Globe3D />
        </div>

        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center">
          <h1 className="text-5xl font-bold text-white mb-4 animate-fade-in">
            连接全球，物流无界
          </h1>
          <p className="text-xl text-gray-300 mb-8 animate-slide-up">
            实时追踪您的国际物流，安全可靠
          </p>

          <form
            onSubmit={handleSearch}
            className="w-full max-w-2xl glass-effect rounded-2xl p-2 flex items-center space-x-2 animate-slide-up"
          >
            <Search className="w-6 h-6 text-gray-400 ml-4" />
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="输入运单号查询物流信息..."
              className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-lg"
            />
            <button
              type="submit"
              className="bg-primary text-white px-8 py-3 rounded-xl hover:bg-primary-light transition font-semibold"
            >
              查询
            </button>
          </form>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            我们的服务
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-neutral-gray rounded-2xl p-8 hover:shadow-xl transition">
              <div className="w-16 h-16 bg-accent-cyan/10 rounded-full flex items-center justify-center mb-4">
                <Ship className="w-8 h-8 text-accent-cyan" />
              </div>
              <h3 className="text-xl font-semibold mb-3">海运物流</h3>
              <p className="text-gray-600">
                成本最优的大宗货物运输方案，覆盖全球主要港口
              </p>
            </div>

            <div className="bg-neutral-gray rounded-2xl p-8 hover:shadow-xl transition">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Plane className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">空运物流</h3>
              <p className="text-gray-600">
                快速安全的航空运输服务，时效性强
              </p>
            </div>

            <div className="bg-neutral-gray rounded-2xl p-8 hover:shadow-xl transition">
              <div className="w-16 h-16 bg-accent-coral/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-accent-coral" />
              </div>
              <h3 className="text-xl font-semibold mb-3">快递服务</h3>
              <p className="text-gray-600">
                门到门的快递服务，3-7天直达全球
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-primary-dark to-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            开始使用 Global Link Logistics
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            注册账号，立即体验专业的国际物流服务
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-white text-primary px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition inline-flex items-center space-x-2"
          >
            <Package className="w-6 h-6" />
            <span>免费注册</span>
          </button>
        </div>
      </section>
    </div>
  );
}
