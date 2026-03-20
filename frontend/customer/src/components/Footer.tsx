import { Package, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Package className="w-6 h-6 text-accent-cyan" />
              <span className="font-bold text-lg">GLL</span>
            </div>
            <p className="text-sm text-gray-400">
              全球领先的国际物流解决方案提供商
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">服务项目</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>海运物流</li>
              <li>空运物流</li>
              <li>快递服务</li>
              <li>仓储管理</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>关于我们</li>
              <li>服务条款</li>
              <li>隐私政策</li>
              <li>帮助中心</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">联系我们</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>support@gll.com</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span>+86 400-888-8888</span>
              </li>
              <li className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>上海市浦东新区</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm text-gray-400">
          <p>&copy; 2026 Global Link Logistics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
