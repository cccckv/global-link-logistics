import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { quickOrderApi, contactApi, userApi, type QuickOrderType, type ContactAddress } from '../lib/api';

interface User {
  id: string;
  name: string;
  phone: string;
  userRole: 'ADMIN' | 'USER';
}

type ShipmentType = 'SEA_LCL' | 'AIR' | 'LAND' | 'BATCH' | 'SEA_FCL' | 'PARCEL';

interface PackageItem {
  id: number;
  trackingNumber: string;
  productName: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  cnyUnitPrice: string;
  phpUnitPrice: string;
  channelUnitPricePhp: string;
}

interface ContainerItem {
  id: number;
  containerType: string;
  quantity: string;
  weight: string;
  products: string;
}

interface FormData {
  warehouse: string;
  destination: string;
  note: string;
  userMark: string;
  mark: string;
  pickupContact: string;
  pickupName: string;
  pickupCompany: string;
  pickupPhone: string;
  pickupRegion: string;
  pickupAddress: string;
  recipientContact: string;
  recipientName: string;
  recipientCompany: string;
  recipientPhone: string;
  recipientRegion: string;
  recipientAddress: string;
  packages: PackageItem[];
  originPort: string;
  destinationPort: string;
  containers: ContainerItem[];
}

const SHIPMENT_TABS = [
  { key: 'SEA_LCL', label: '海运拼柜', type: 'standard' },
  { key: 'AIR', label: '空运快递', type: 'standard' },
  { key: 'LAND', label: '陆运装车', type: 'standard' },
  { key: 'BATCH', label: '批量导入拼柜', type: 'batch' },
  { key: 'SEA_FCL', label: '海运整柜', type: 'fcl' },
  { key: 'PARCEL', label: '拼邮快递', type: 'standard' },
] as const;

const initialFormData: FormData = {
  warehouse: '',
  destination: '',
  note: '',
  userMark: '',
  mark: '',
  pickupContact: '',
  pickupName: '',
  pickupCompany: '',
  pickupPhone: '',
  pickupRegion: '',
  pickupAddress: '',
  recipientContact: '',
  recipientName: '',
  recipientCompany: '',
  recipientPhone: '',
  recipientRegion: '',
  recipientAddress: '',
  packages: [
    {
      id: 1,
      trackingNumber: '',
      productName: '',
      length: '',
      width: '',
      height: '',
      weight: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
    },
  ],
  originPort: '',
  destinationPort: '',
  containers: [
    {
      id: 1,
      containerType: '20GP',
      quantity: '0',
      weight: '0',
      products: '',
    },
  ],
};

export default function QuickOrder() {
  const [activeTab, setActiveTab] = useState<ShipmentType>('SEA_LCL');
  const [formDataMap, setFormDataMap] = useState<Record<ShipmentType, FormData>>({
    SEA_LCL: JSON.parse(JSON.stringify(initialFormData)),
    AIR: JSON.parse(JSON.stringify(initialFormData)),
    LAND: JSON.parse(JSON.stringify(initialFormData)),
    BATCH: JSON.parse(JSON.stringify(initialFormData)),
    SEA_FCL: JSON.parse(JSON.stringify(initialFormData)),
    PARCEL: JSON.parse(JSON.stringify(initialFormData)),
  });

  const [pickupAddresses, setPickupAddresses] = useState<ContactAddress[]>([]);
  const [recipientAddresses, setRecipientAddresses] = useState<ContactAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [regularUsers, setRegularUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    loadAddresses();
    loadRegularUsers();
  }, []);

  const loadAddresses = async () => {
    setIsLoadingAddresses(true);
    try {
      const [pickupRes, recipientRes] = await Promise.all([
        contactApi.getPickupAddresses(),
        contactApi.getRecipientAddresses(),
      ]);
      setPickupAddresses(pickupRes.data.data);
      setRecipientAddresses(recipientRes.data.data);
    } catch (error) {
      console.error('加载地址失败:', error);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const loadRegularUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await userApi.list({ limit: 1000 });
      const users = response.data.data.filter((user: User) => user.userRole === 'USER');
      setRegularUsers(users);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handlePickupAddressSelect = (addressId: string) => {
    const selected = pickupAddresses.find(a => a.id === addressId);
    if (selected) {
      updateFormData('pickupContact', addressId);
      updateFormData('pickupName', selected.name);
      updateFormData('pickupCompany', selected.company || '');
      updateFormData('pickupPhone', selected.phone);
      updateFormData('pickupRegion', selected.region || '');
      updateFormData('pickupAddress', selected.address);
    }
  };

  const handleRecipientAddressSelect = (addressId: string) => {
    const selected = recipientAddresses.find(a => a.id === addressId);
    if (selected) {
      updateFormData('recipientContact', addressId);
      updateFormData('recipientName', selected.name);
      updateFormData('recipientCompany', selected.company || '');
      updateFormData('recipientPhone', selected.phone);
      updateFormData('recipientRegion', selected.region || '');
      updateFormData('recipientAddress', selected.address);
    }
  };

  const handleUserMarkSelect = (userName: string) => {
    if (userName) {
      updateFormData('userMark', userName);
    }
  };

  const currentData = formDataMap[activeTab];

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormDataMap(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      },
    }));
  };

  const addPackage = () => {
    const newId = Math.max(...currentData.packages.map(p => p.id), 0) + 1;
    updateFormData('packages', [...currentData.packages, {
      id: newId,
      trackingNumber: '',
      productName: '',
      length: '',
      width: '',
      height: '',
      weight: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
    }]);
  };

  const removePackage = (id: number) => {
    if (currentData.packages.length > 1) {
      updateFormData('packages', currentData.packages.filter(p => p.id !== id));
    }
  };

  const updatePackage = (id: number, field: keyof PackageItem, value: string) => {
    const updatedPackages = currentData.packages.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateFormData('packages', updatedPackages);
  };

  const addContainer = () => {
    const newId = Math.max(...currentData.containers.map(c => c.id), 0) + 1;
    updateFormData('containers', [...currentData.containers, {
      id: newId,
      containerType: '20GP',
      quantity: '0',
      weight: '0',
      products: '',
    }]);
  };

  const removeContainer = (id: number) => {
    if (currentData.containers.length > 1) {
      updateFormData('containers', currentData.containers.filter(c => c.id !== id));
    }
  };

  const updateContainer = (id: number, field: keyof ContainerItem, value: string) => {
    const updatedContainers = currentData.containers.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    );
    updateFormData('containers', updatedContainers);
  };

  const handleEditContainerProducts = (_containerId: number) => {
    alert('编辑产品功能待实现');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (currentTabType === 'batch') {
      if (!currentData.warehouse) {
        alert('请选择国内仓库');
        return;
      }
      if (!currentData.destination) {
        alert('请选择目的地');
        return;
      }
      alert('批量导入功能待实现');
      return;
    }

    if (!currentData.destination) {
      alert('请选择目的地');
      return;
    }
    if (!currentData.recipientName) {
      alert('请输入收件人');
      return;
    }
    if (!currentData.recipientAddress) {
      alert('请输入详细地址');
      return;
    }
    if (!currentData.recipientPhone) {
      alert('请输入收件人电话');
      return;
    }
    if (!currentData.pickupName) {
      alert('请输入提货联系人');
      return;
    }
    if (!currentData.pickupPhone) {
      alert('请输入提货联系人电话');
      return;
    }
    if (!currentData.pickupAddress) {
      alert('请输入提货详细地址');
      return;
    }

    if (currentTabType === 'standard') {
      const missingChannelUnitPrice = currentData.packages.some(p =>
        p.productName && p.weight && !p.channelUnitPricePhp
      );
      if (missingChannelUnitPrice) {
        alert('请填写每条申报信息的渠道单价(₱)');
        return;
      }
    }

    if (currentTabType === 'standard' && !currentData.warehouse) {
      alert('请选择国内仓库');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData: any = {
        orderType: activeTab as QuickOrderType,
        destination: currentData.destination,
        note: currentData.note || undefined,
        userMark: currentData.userMark || undefined,
        mark: currentData.mark || undefined,
        recipientAddress: {
          name: currentData.recipientName,
          company: currentData.recipientCompany || undefined,
          phone: currentData.recipientPhone,
          region: currentData.recipientRegion || undefined,
          address: currentData.recipientAddress,
        },
      };

      if (currentData.pickupName && currentData.pickupPhone && currentData.pickupAddress) {
        orderData.pickupAddress = {
          name: currentData.pickupName,
          company: currentData.pickupCompany || undefined,
          phone: currentData.pickupPhone,
          region: currentData.pickupRegion || undefined,
          address: currentData.pickupAddress,
        };
      }

      if (currentTabType === 'fcl') {
        orderData.originPort = currentData.originPort || undefined;
        orderData.destinationPort = currentData.destinationPort || undefined;
        orderData.containers = currentData.containers.map(c => ({
          containerType: c.containerType,
          quantity: parseInt(c.quantity) || 0,
          weight: c.weight ? parseFloat(c.weight) : undefined,
          productsJson: c.products || undefined,
        }));
      } else if (currentTabType === 'standard') {
        orderData.warehouse = currentData.warehouse;
        orderData.declarations = currentData.packages.map(p => ({
          trackingNumber: p.trackingNumber || undefined,
          productName: p.productName,
          length: p.length ? parseFloat(p.length) : undefined,
          width: p.width ? parseFloat(p.width) : undefined,
          height: p.height ? parseFloat(p.height) : undefined,
          weight: parseFloat(p.weight),
          cnyUnitPrice: p.cnyUnitPrice ? parseFloat(p.cnyUnitPrice) : undefined,
          phpUnitPrice: p.phpUnitPrice ? parseFloat(p.phpUnitPrice) : undefined,
          channelUnitPricePhp: p.channelUnitPricePhp ? parseFloat(p.channelUnitPricePhp) : undefined,
        })).filter(d => d.productName && d.weight);
      }

      const response = await quickOrderApi.create(orderData);
      
      alert(`订单创建成功！\n订单号: ${response.data.orderNumber}`);
      
      await loadAddresses();
      
      setFormDataMap(prev => ({
        ...prev,
        [activeTab]: JSON.parse(JSON.stringify(initialFormData)),
      }));
      
        navigate(`/order/list`);
    } catch (error: any) {
      console.error('创建订单失败:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '创建订单失败，请重试';
      setSubmitError(errorMessage);
      alert(`创建订单失败: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormDataMap(prev => ({
      ...prev,
      [activeTab]: JSON.parse(JSON.stringify(initialFormData)),
    }));
  };

  const handleResetPickupInfo = () => {
    updateFormData('pickupContact', '');
    updateFormData('pickupName', '');
    updateFormData('pickupCompany', '');
    updateFormData('pickupPhone', '');
    updateFormData('pickupRegion', '');
    updateFormData('pickupAddress', '');
  };

  const handleResetRecipientInfo = () => {
    updateFormData('recipientContact', '');
    updateFormData('recipientName', '');
    updateFormData('recipientCompany', '');
    updateFormData('recipientPhone', '');
    updateFormData('recipientRegion', '');
    updateFormData('recipientAddress', '');
  };

  const handleTabChange = (tab: ShipmentType) => {
    setActiveTab(tab);
  };

  const currentTabType = SHIPMENT_TABS.find(t => t.key === activeTab)?.type || 'standard';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-8 py-6 border-b">
            <h1 className="text-2xl font-semibold text-gray-900">立即下单</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-8 py-6 border-b bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-4">订单类型</div>
              <div className="flex gap-3 flex-wrap">
                {SHIPMENT_TABS.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key as ShipmentType)}
                    className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.key
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {currentTabType === 'fcl' ? (
              <div className="px-8 py-8">
                <h2 className="text-lg font-medium text-gray-900 mb-6">添加运输信息</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-red-500">*</span>起运地
                    </label>
                    <select
                      value={currentData.warehouse}
                      onChange={(e) => updateFormData('warehouse', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择仓库</option>
                      <option value="yiwu">义乌仓库</option>
                      <option value="guangzhou">广州仓库</option>
                      <option value="shenzhen">深圳仓库</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-red-500">*</span>目的地
                    </label>
                    <select
                      value={currentData.destination}
                      onChange={(e) => updateFormData('destination', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择目的地</option>
                      <option value="hongkong">中国香港</option>
                      <option value="taiwan">中国台湾</option>
                      <option value="malaysia">马来西亚</option>
                      <option value="singapore">新加坡</option>
                      <option value="vietnam">越南</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">起运港口</label>
                    <select
                      value={currentData.originPort}
                      onChange={(e) => updateFormData('originPort', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择起运港口</option>
                      <option value="shanghai">上海港</option>
                      <option value="ningbo">宁波港</option>
                      <option value="shenzhen">深圳港</option>
                      <option value="guangzhou">广州港</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">目的港口</label>
                    <select
                      value={currentData.destinationPort}
                      onChange={(e) => updateFormData('destinationPort', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择目的港口</option>
                      <option value="hongkong">香港港</option>
                      <option value="singapore">新加坡港</option>
                      <option value="losangeles">洛杉矶港</option>
                      <option value="rotterdam">鹿特丹港</option>
                    </select>
                  </div>
                </div>

                <div className="border-b pb-8 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写提货信息</h2>
                    <button
                      type="button"
                      onClick={handleResetPickupInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置提货信息
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">提货人管理</label>
                      <select
                        value={currentData.pickupContact}
                        onChange={(e) => handlePickupAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择寄件人</option>
                        {pickupAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>提货联系人
                      </label>
                      <input
                        type="text"
                        placeholder="请输入提货联系人"
                        value={currentData.pickupName}
                        onChange={(e) => updateFormData('pickupName', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.pickupCompany}
                        onChange={(e) => updateFormData('pickupCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>手机号码
                      </label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.pickupPhone}
                        onChange={(e) => updateFormData('pickupPhone', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.pickupRegion}
                        onChange={(e) => updateFormData('pickupRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">请选择国家</option>
                        <option value="china">中国</option>
                        <option value="hongkong">香港</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>详细地址
                      </label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.pickupAddress}
                        onChange={(e) => updateFormData('pickupAddress', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-8 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写收货信息</h2>
                    <button
                      type="button"
                      onClick={handleResetRecipientInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置收件信息
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">收件人管理</label>
                      <select
                        value={currentData.recipientContact}
                        onChange={(e) => handleRecipientAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择收件人</option>
                        {recipientAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>收件人
                      </label>
                      <input
                        type="text"
                        placeholder="请输入收件人"
                        value={currentData.recipientName}
                        onChange={(e) => updateFormData('recipientName', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.recipientCompany}
                        onChange={(e) => updateFormData('recipientCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>手机号码
                      </label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.recipientPhone}
                        onChange={(e) => updateFormData('recipientPhone', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.recipientRegion}
                        onChange={(e) => updateFormData('recipientRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择国家</option>
                        <option value="china">中国</option>
                        <option value="hongkong">香港</option>
                        <option value="malaysia">马来西亚</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>详细地址
                      </label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.recipientAddress}
                        onChange={(e) => updateFormData('recipientAddress', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写申报信息</h2>
                    <button
                      type="button"
                      onClick={() => alert('批量申报功能待实现')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      批量申报
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-300 mb-8">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-16">序号</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center min-w-[150px]">订柜箱型</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">件数</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">重量(kg)</th>
                          <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-48">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {currentData.containers.map((container, index) => (
                          <tr key={container.id} className="hover:bg-gray-50">
                            <td className="border-b border-r border-gray-300 px-4 py-3 text-center text-sm">{index + 1}</td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <select
                                value={container.containerType}
                                onChange={(e) => updateContainer(container.id, 'containerType', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="20GP">20GP</option>
                                <option value="40GP">40GP</option>
                                <option value="40HQ">40HQ</option>
                                <option value="45HQ">45HQ</option>
                              </select>
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.quantity}
                                onChange={(e) => updateContainer(container.id, 'quantity', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.weight}
                                onChange={(e) => updateContainer(container.id, 'weight', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>
                            
                            <td className="border-b border-gray-300 px-3 py-2">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditContainerProducts(container.id)}
                                  className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 hover:bg-blue-50 rounded"
                                >
                                  编辑产品
                                </button>
                                {currentData.containers.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeContainer(container.id)}
                                    className="text-sm text-red-600 hover:text-red-700 px-3 py-1 hover:bg-red-50 rounded"
                                  >
                                    删除
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={addContainer}
                                    className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 hover:bg-blue-50 rounded"
                                  >
                                    增加
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        
                        {currentData.containers.length > 1 && (
                          <tr>
                            <td colSpan={5} className="border-b border-gray-300 px-4 py-3">
                              <button
                                type="button"
                                onClick={addContainer}
                                className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 font-medium"
                              >
                                + 添加一行
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {submitError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      {submitError}
                    </div>
                  )}
                  
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmitting ? '提交中...' : '提 交'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isSubmitting}
                      className="px-8 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ) : currentTabType === 'batch' ? (
              <div className="px-8 py-8">
                <h2 className="text-lg font-medium text-gray-900 mb-6">运输信息</h2>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <p className="text-sm text-gray-700 mb-3">
                    1、请下载
                    <a href="/xls/input_demo.xls" className="text-blue-600 hover:underline mx-1 font-medium">
                      《申报模板》
                    </a>
                    ，按模板格式填写相关资料；
                  </p>
                  <a
                    href="/xls/input_demo.xls"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    下载模板
                  </a>
                  <p className="text-sm text-gray-700 mt-4">
                    2. 上传填写好的文件，上传说明：正确选择要上传的文件，上传成功后，可以对上传的单号进行修改。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-red-500">*</span>国内仓库
                    </label>
                    <select
                      value={currentData.warehouse}
                      onChange={(e) => updateFormData('warehouse', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择仓库</option>
                      <option value="yiwu">义乌仓库</option>
                      <option value="guangzhou">广州仓库</option>
                      <option value="shenzhen">深圳仓库</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-red-500">*</span>目的地
                    </label>
                    <select
                      value={currentData.destination}
                      onChange={(e) => updateFormData('destination', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择目的地</option>
                      <option value="hongkong">中国香港</option>
                      <option value="taiwan">中国台湾</option>
                      <option value="malaysia">马来西亚</option>
                      <option value="singapore">新加坡</option>
                      <option value="vietnam">越南</option>
                    </select>
                  </div>

                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    提 交
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-8 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    重置表单
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-8 py-8 border-b">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">添加运输信息</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>国内仓库
                      </label>
                      <select
                        value={currentData.warehouse}
                        onChange={(e) => updateFormData('warehouse', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择仓库</option>
                        <option value="yiwu">义乌仓库</option>
                        <option value="guangzhou">广州仓库</option>
                        <option value="shenzhen">深圳仓库</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>目的地
                      </label>
                      <select
                        value={currentData.destination}
                        onChange={(e) => updateFormData('destination', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择目的地</option>
                        <option value="hongkong">中国香港</option>
                        <option value="taiwan">中国台湾</option>
                        <option value="malaysia">马来西亚</option>
                        <option value="singapore">新加坡</option>
                        <option value="vietnam">越南</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">备注</label>
                      <input
                        type="text"
                        placeholder="请输入订单备注"
                        value={currentData.note}
                        onChange={(e) => updateFormData('note', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">用户唛头</label>
                      <select
                        value={currentData.userMark}
                        onChange={(e) => handleUserMarkSelect(e.target.value)}
                        disabled={isLoadingUsers}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">请选择用户唛头</option>
                        {regularUsers.map((user) => (
                          <option key={user.id} value={user.name}>
                            {user.name} ({user.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                <div className="px-8 py-8 border-b bg-gray-50">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写提货信息</h2>
                    <button
                      type="button"
                      onClick={handleResetPickupInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置提货信息
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">提货人管理</label>
                      <select
                        value={currentData.pickupContact}
                        onChange={(e) => handlePickupAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择寄件人</option>
                        {pickupAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>提货联系人
                      </label>
                      <input
                        type="text"
                        placeholder="请输入提货联系人"
                        value={currentData.pickupName}
                        onChange={(e) => updateFormData('pickupName', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.pickupCompany}
                        onChange={(e) => updateFormData('pickupCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>手机号码
                      </label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.pickupPhone}
                        onChange={(e) => updateFormData('pickupPhone', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.pickupRegion}
                        onChange={(e) => updateFormData('pickupRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">请选择国家</option>
                        <option value="china">中国</option>
                        <option value="hongkong">香港</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>详细地址
                      </label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.pickupAddress}
                        onChange={(e) => updateFormData('pickupAddress', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-8 py-8 border-b">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写收件信息</h2>
                    <button
                      type="button"
                      onClick={handleResetRecipientInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置收件信息
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">收件人管理</label>
                      <select
                        value={currentData.recipientContact}
                        onChange={(e) => handleRecipientAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择收件人</option>
                        {recipientAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>收件人
                      </label>
                      <input
                        type="text"
                        placeholder="请输入收件人"
                        value={currentData.recipientName}
                        onChange={(e) => updateFormData('recipientName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.recipientCompany}
                        onChange={(e) => updateFormData('recipientCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>手机号码
                      </label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.recipientPhone}
                        onChange={(e) => updateFormData('recipientPhone', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.recipientRegion}
                        onChange={(e) => updateFormData('recipientRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择国家</option>
                        <option value="china">中国</option>
                        <option value="hongkong">香港</option>
                        <option value="malaysia">马来西亚</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="text-red-500">*</span>详细地址
                      </label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.recipientAddress}
                        onChange={(e) => updateFormData('recipientAddress', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-8 py-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写申报信息</h2>
                    <button
                      type="button"
                      onClick={() => alert('批量申报功能待实现')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      批量申报
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-300">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-16">序号</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center min-w-[140px]">快递单号</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center min-w-[140px]">品名</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">长(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">宽(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">高(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">重量(kg)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">单价(￥)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">单价(₱)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">渠道单价(₱)</th>
                          <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-24">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {currentData.packages.map((pkg, index) => (
                          <tr key={pkg.id} className="hover:bg-gray-50">
                            <td className="border-b border-r border-gray-300 px-4 py-3 text-center text-sm">{index + 1}</td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="text"
                                placeholder="请输入快递单号"
                                value={pkg.trackingNumber}
                                onChange={(e) => updatePackage(pkg.id, 'trackingNumber', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="text"
                                placeholder="请输入品名"
                                value={pkg.productName}
                                onChange={(e) => updatePackage(pkg.id, 'productName', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="长"
                                value={pkg.length}
                                onChange={(e) => updatePackage(pkg.id, 'length', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="宽"
                                value={pkg.width}
                                onChange={(e) => updatePackage(pkg.id, 'width', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="高"
                                value={pkg.height}
                                onChange={(e) => updatePackage(pkg.id, 'height', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="重量"
                                value={pkg.weight}
                                onChange={(e) => updatePackage(pkg.id, 'weight', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="单价￥"
                                value={pkg.cnyUnitPrice}
                                onChange={(e) => updatePackage(pkg.id, 'cnyUnitPrice', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="单价₱"
                                value={pkg.phpUnitPrice}
                                onChange={(e) => updatePackage(pkg.id, 'phpUnitPrice', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="渠道单价₱"
                                value={pkg.channelUnitPricePhp}
                                onChange={(e) => updatePackage(pkg.id, 'channelUnitPricePhp', e.target.value)}
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                            <td className="border-b border-gray-300 px-3 py-2">
                              {currentData.packages.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removePackage(pkg.id)}
                                  className="text-sm text-red-600 hover:text-red-700 px-3 py-1 hover:bg-red-50 rounded"
                                >
                                  删除
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={addPackage}
                                  className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 hover:bg-blue-50 rounded"
                                >
                                  添加
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        
                        {currentData.packages.length > 1 && (
                        <tr>
                          <td colSpan={12} className="border-b border-gray-300 px-4 py-3">
                              <button
                                type="button"
                                onClick={addPackage}
                                className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 font-medium"
                              >
                                + 添加一行
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button
                      type="submit"
                      className="px-8 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      提 交
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-8 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
