import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { quickOrderApi, contactApi, userApi, uploadApi, type QuickOrderType, type ContactAddress } from '../lib/api';

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
  quantity: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  cnyUnitPrice: string;
  phpUnitPrice: string;
  channelUnitPricePhp: string;
  channelUnitPriceCny: string;
  receivableCurrency: 'CNY' | 'PHP';
  payableCurrency: 'CNY' | 'PHP';
}

interface ContainerItem {
  id: number;
  containerType: string;
  quantity: string;
  weight: string;
  products: string;
  productName: string;
  cnyUnitPrice: string;
  phpUnitPrice: string;
  channelUnitPricePhp: string;
  channelUnitPriceCny: string;
}

interface FormData {
  warehouse: string;
  destination: string;
  note: string;
  userMark: string;
  userMarkId: string;
  mark: string;
  voyageNumber: string;
  recipientContact: string;
  recipientName: string;
  recipientCompany: string;
  recipientPhone: string;
  recipientRegion: string;
  recipientAddress: string;
  recipientReceivedAt: string;
  receiptUrl: string;
  receiptFileName: string;
  receiptPreviewUrl: string;
  receiptFile?: File;
  carPickupReceivable: string;
  carPickupActual: string;
  overseasContact: string;
  overseasName: string;
  overseasCompany: string;
  overseasPhone: string;
  overseasRegion: string;
  overseasAddress: string;
  packages: PackageItem[];
  originPort: string;
  destinationPort: string;
  containers: ContainerItem[];
}

const SHIPMENT_TABS = [
  { key: 'SEA_LCL', label: '海运拼柜', type: 'standard' },
  { key: 'AIR', label: '空运快递', type: 'standard' },
  { key: 'BATCH', label: '批量导入拼柜', type: 'batch' },
  { key: 'SEA_FCL', label: '海运整柜', type: 'fcl' },
] as const;

const initialFormData: FormData = {
  warehouse: '',
  destination: '',
  note: '',
  userMark: '',
  userMarkId: '',
  mark: '',
  voyageNumber: '',
  recipientContact: '',
  recipientName: '',
  recipientCompany: '',
  recipientPhone: '',
  recipientRegion: '',
  recipientAddress: '',
  recipientReceivedAt: '',
  receiptUrl: '',
  receiptFileName: '',
  receiptPreviewUrl: '',
  carPickupReceivable: '',
  carPickupActual: '',
  overseasContact: '',
  overseasName: '',
  overseasCompany: '',
  overseasPhone: '',
  overseasRegion: '',
  overseasAddress: '',
  packages: [
    {
      id: 1,
      trackingNumber: '',
      productName: '',
      quantity: '1',
      length: '',
      width: '',
      height: '',
      weight: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
      channelUnitPriceCny: '',
      receivableCurrency: 'CNY' as const,
      payableCurrency: 'CNY' as const,
    },
  ],
  originPort: '',
  destinationPort: '',
  containers: [
    {
      id: 1,
      containerType: 'GP_20',
      quantity: '0',
      weight: '0',
      products: '',
      productName: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
      channelUnitPriceCny: '',
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

  const [recipientAddresses, setRecipientAddresses] = useState<ContactAddress[]>([]);
  const [overseasAddresses, setOverseasAddresses] = useState<ContactAddress[]>([]);
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
      const [recipientRes, overseasRes] = await Promise.all([
        contactApi.getRecipientAddresses(),
        contactApi.getOverseasAddresses(),
      ]);
      setRecipientAddresses(recipientRes.data.data);
      setOverseasAddresses(overseasRes.data.data);
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

  const handleOverseasAddressSelect = (addressId: string) => {
    const selected = overseasAddresses.find(a => a.id === addressId);
    if (selected) {
      updateFormData('overseasContact', addressId);
      updateFormData('overseasName', selected.name);
      updateFormData('overseasCompany', selected.company || '');
      updateFormData('overseasPhone', selected.phone);
      updateFormData('overseasRegion', selected.region || '');
      updateFormData('overseasAddress', selected.address);
    }
  };

  const handleUserMarkSelect = async (userId: string) => {
    if (!userId) {
      updateFormData('userMark', '');
      updateFormData('userMarkId', '');
      return;
    }
    const user = regularUsers.find(u => u.id === userId);
    if (user) {
      updateFormData('userMark', user.name);
      updateFormData('userMarkId', userId);
    }
    try {
      const res = await contactApi.getOverseasAddressesByUserId(userId);
      const addrs = res.data.data;
      if (addrs.length === 0) {
        toast.info('该用户暂无海外收件地址');
        updateFormData('overseasContact', '');
        updateFormData('overseasName', '');
        updateFormData('overseasCompany', '');
        updateFormData('overseasPhone', '');
        updateFormData('overseasRegion', '');
        updateFormData('overseasAddress', '');
      } else {
        const defaultAddr = addrs.find(a => a.isDefault) || addrs[0];
        updateFormData('overseasContact', defaultAddr.id);
        updateFormData('overseasName', defaultAddr.name);
        updateFormData('overseasCompany', defaultAddr.company || '');
        updateFormData('overseasPhone', defaultAddr.phone);
        updateFormData('overseasRegion', defaultAddr.region || '');
        updateFormData('overseasAddress', defaultAddr.address);
        setOverseasAddresses(addrs);
      }
    } catch {
      toast.error('获取海外收件地址失败');
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
      quantity: '1',
      length: '',
      width: '',
      height: '',
      weight: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
      channelUnitPriceCny: '',
      receivableCurrency: 'CNY' as const,
      payableCurrency: 'CNY' as const,
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

  const updatePackageFields = (id: number, fields: Partial<PackageItem>) => {
    const updatedPackages = currentData.packages.map(p =>
      p.id === id ? { ...p, ...fields } : p
    );
    updateFormData('packages', updatedPackages);
  };

  const addContainer = () => {
    const newId = Math.max(...currentData.containers.map(c => c.id), 0) + 1;
    updateFormData('containers', [...currentData.containers, {
      id: newId,
      containerType: 'GP_20',
      quantity: '0',
      weight: '0',
      products: '',
      productName: '',
      cnyUnitPrice: '',
      phpUnitPrice: '',
      channelUnitPricePhp: '',
      channelUnitPriceCny: '',
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (currentTabType === 'batch') {
      if (!currentData.warehouse) {
        toast.error('请选择渠道');
        return;
      }
      if (!currentData.destination) {
        toast.error('请选择目的地');
        return;
      }
      toast.info('批量导入功能待实现');
      return;
    }

    if (!currentData.destination) {
      toast.error('请选择目的地');
      return;
    }
    if (!currentData.recipientName) {
      toast.error('请输入收件人');
      return;
    }
    if (!currentData.recipientAddress) {
      toast.error('请输入详细地址');
      return;
    }
    if (!currentData.recipientPhone) {
      toast.error('请输入收件人电话');
      return;
    }

    if (currentTabType === 'fcl') {
      if (!currentData.originPort) {
        toast.error('请选择起运港');
        return;
      }
      if (!currentData.destinationPort) {
        toast.error('请选择目的港');
        return;
      }
      
      const hasEmptyContainer = currentData.containers.some(c => 
        !c.quantity || !c.weight || !c.productName || !c.channelUnitPricePhp
      );
      if (hasEmptyContainer) {
        toast.error('请填写所有集装箱的件数、重量、产品名称和应付单价');
        return;
      }
      
      const invalidQuantity = currentData.containers.some(c => 
        parseInt(c.quantity) <= 0
      );
      if (invalidQuantity) {
        toast.error('集装箱件数必须大于0');
        return;
      }
      
      const invalidWeight = currentData.containers.some(c => 
        parseFloat(c.weight) <= 0
      );
      if (invalidWeight) {
        toast.error('集装箱重量必须大于0');
        return;
      }

      const invalidChannelPrice = currentData.containers.some(c => 
        parseFloat(c.channelUnitPricePhp) <= 0
      );
      if (invalidChannelPrice) {
        toast.error('应付单价必须大于0');
        return;
      }
    }

    if (currentTabType === 'standard') {
      const missingChannelUnitPrice = currentData.packages.some(p =>
        p.productName && p.weight && !p.channelUnitPricePhp
      );
      if (missingChannelUnitPrice) {
        toast.error('请填写每条申报信息的应付单价(₱)');
        return;
      }
    }

    if (currentTabType === 'standard' && !currentData.warehouse) {
      toast.error('请选择渠道');
      return;
    }

    if (currentTabType === 'standard') {
      const filledPackages = currentData.packages.filter(p => p.productName && p.weight);
      const receivableHasCny = filledPackages.some(p => p.cnyUnitPrice && !p.phpUnitPrice);
      const receivableHasPhp = filledPackages.some(p => p.phpUnitPrice);
      if (receivableHasCny && receivableHasPhp) {
        toast.error('应收单价请统一使用同一货币（CNY 或 PHP），不能混填');
        return;
      }
      const payableHasCny = filledPackages.some(p => p.channelUnitPriceCny && !p.channelUnitPricePhp);
      const payableHasPhp = filledPackages.some(p => p.channelUnitPricePhp);
      if (payableHasCny && payableHasPhp) {
        toast.error('应付单价请统一使用同一货币（CNY 或 PHP），不能混填');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let receiptUrl: string | undefined;
      let receiptFileName: string | undefined;

      if (currentData.receiptFile) {
        toast.loading('上传收件凭证...', { id: 'upload-receipt' });
        const { data } = await uploadApi.uploadReceipt(currentData.receiptFile);
        toast.dismiss('upload-receipt');
        receiptUrl = data.fileUrl;
        receiptFileName = data.fileName;
      }

      const orderData: any = {
        orderType: activeTab as QuickOrderType,
        destination: currentData.destination,
        note: currentData.note || undefined,
        userMark: currentData.userMark || undefined,
        markUserId: currentData.userMarkId || undefined,
        receivedAt: currentData.recipientReceivedAt || undefined,
        receiptUrl: receiptUrl || undefined,
        receiptFileName: receiptFileName || undefined,
        mark: currentData.mark || undefined,
        voyageNumber: currentData.voyageNumber || undefined,
        carPickupReceivable: currentData.carPickupReceivable ? parseFloat(currentData.carPickupReceivable) : undefined,
        carPickupActual: currentData.carPickupActual ? parseFloat(currentData.carPickupActual) : undefined,
        recipientAddress: {
          name: currentData.recipientName,
          company: currentData.recipientCompany || undefined,
          phone: currentData.recipientPhone,
          region: currentData.recipientRegion || undefined,
          address: currentData.recipientAddress,
        },
      };

      if (currentData.overseasName && currentData.overseasPhone && currentData.overseasAddress) {
        orderData.overseasAddress = {
          name: currentData.overseasName,
          company: currentData.overseasCompany || undefined,
          phone: currentData.overseasPhone,
          region: currentData.overseasRegion || undefined,
          address: currentData.overseasAddress,
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
        // 海运整柜：每个集装箱对应一条申报信息
        orderData.declarations = currentData.containers.map(c => ({
          productName: c.productName,
          weight: c.weight ? parseFloat(c.weight) : 0,
          cnyUnitPrice: c.cnyUnitPrice ? parseFloat(c.cnyUnitPrice) : undefined,
          phpUnitPrice: c.phpUnitPrice ? parseFloat(c.phpUnitPrice) : undefined,
          channelUnitPricePhp: parseFloat(c.channelUnitPricePhp),
        }));
      } else if (currentTabType === 'standard') {
        orderData.warehouse = currentData.warehouse;
        orderData.declarations = currentData.packages.map(p => ({
          trackingNumber: p.trackingNumber || undefined,
          productName: p.productName,
          quantity: parseInt(p.quantity) || 1,
          length: p.length ? parseFloat(p.length) : undefined,
          width: p.width ? parseFloat(p.width) : undefined,
          height: p.height ? parseFloat(p.height) : undefined,
          weight: parseFloat(p.weight),
          cnyUnitPrice: p.cnyUnitPrice ? parseFloat(p.cnyUnitPrice) : undefined,
          phpUnitPrice: p.phpUnitPrice ? parseFloat(p.phpUnitPrice) : undefined,
          channelUnitPricePhp: p.channelUnitPricePhp ? parseFloat(p.channelUnitPricePhp) : undefined,
          channelUnitPriceCny: p.channelUnitPriceCny ? parseFloat(p.channelUnitPriceCny) : undefined,
        })).filter(d => d.productName && d.weight);
      }

      const response = await quickOrderApi.create(orderData);
      
      if (currentData.receiptPreviewUrl) {
        URL.revokeObjectURL(currentData.receiptPreviewUrl);
      }

      toast.success(`订单创建成功！订单号: ${response.data.orderNumber}`);
      
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
      toast.error(`创建订单失败: ${errorMessage}`);
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

  const handleResetRecipientInfo = () => {
    updateFormData('recipientContact', '');
    updateFormData('recipientName', '');
    updateFormData('recipientCompany', '');
    updateFormData('recipientPhone', '');
    updateFormData('recipientRegion', '');
    updateFormData('recipientAddress', '');
  };

  const handleResetOverseasInfo = () => {
    updateFormData('overseasContact', '');
    updateFormData('overseasName', '');
    updateFormData('overseasCompany', '');
    updateFormData('overseasPhone', '');
    updateFormData('overseasRegion', '');
    updateFormData('overseasAddress', '');
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
                      <span className="text-red-500">*</span>渠道
                    </label>
                    <select
                      value={currentData.warehouse}
                      onChange={(e) => updateFormData('warehouse', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择渠道</option>
                      <option value="yiwu">义乌</option>
                      <option value="longyan">龙岩</option>
                      <option value="guangzhou">广州</option>
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
                      <option value="vietnam">越南</option>
                      <option value="thailand">泰国</option>
                      <option value="malaysia">马来西亚</option>
                      <option value="singapore">新加坡</option>
                      <option value="indonesia">印度尼西亚</option>
                      <option value="philippines">菲律宾</option>
                      <option value="myanmar">缅甸</option>
                      <option value="cambodia">柬埔寨</option>
                      <option value="laos">老挝</option>
                      <option value="brunei">文莱</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      起运港口 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={currentData.originPort}
                      onChange={(e) => updateFormData('originPort', e.target.value)}
                      required
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
                    <label className="block text-sm font-medium text-gray-700">
                      目的港口 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={currentData.destinationPort}
                      onChange={(e) => updateFormData('destinationPort', e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择目的港口</option>
                      <option value="hongkong">香港港</option>
                      <option value="singapore">新加坡港</option>
                      <option value="losangeles">洛杉矶港</option>
                      <option value="rotterdam">鹿特丹港</option>
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
                      value={currentData.userMarkId}
                      onChange={(e) => handleUserMarkSelect(e.target.value)}
                      disabled={isLoadingUsers}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">请选择用户唛头</option>
                      {regularUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.phone})
                        </option>
                      ))}
                    </select>
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

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">签收时间</label>
                      <input
                        type="date"
                        value={currentData.recipientReceivedAt}
                        onChange={(e) => updateFormData('recipientReceivedAt', e.target.value)}
                        onClick={(e) => { const el = e.currentTarget; if ('showPicker' in el) (el as HTMLInputElement).showPicker(); }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-8 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写海外收件人信息</h2>
                    <button
                      type="button"
                      onClick={handleResetOverseasInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置海外收件信息
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">海外收件人管理</label>
                      <select
                        value={currentData.overseasContact}
                        onChange={(e) => handleOverseasAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择海外收件人</option>
                        {overseasAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">海外收件人</label>
                      <input
                        type="text"
                        placeholder="请输入海外收件人"
                        value={currentData.overseasName}
                        onChange={(e) => updateFormData('overseasName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.overseasCompany}
                        onChange={(e) => updateFormData('overseasCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">手机号码</label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.overseasPhone}
                        onChange={(e) => updateFormData('overseasPhone', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.overseasRegion}
                        onChange={(e) => updateFormData('overseasRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择国家/地区</option>
                        <option value="philippines">菲律宾</option>
                        <option value="malaysia">马来西亚</option>
                        <option value="singapore">新加坡</option>
                        <option value="vietnam">越南</option>
                        <option value="thailand">泰国</option>
                        <option value="indonesia">印度尼西亚</option>
                        <option value="usa">美国</option>
                        <option value="canada">加拿大</option>
                        <option value="australia">澳大利亚</option>
                        <option value="uk">英国</option>
                        <option value="germany">德国</option>
                        <option value="france">法国</option>
                        <option value="japan">日本</option>
                        <option value="korea">韩国</option>
                        <option value="hongkong">香港</option>
                        <option value="taiwan">台湾</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">详细地址</label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.overseasAddress}
                        onChange={(e) => updateFormData('overseasAddress', e.target.value)}
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
                      onClick={() => toast.info('批量申报功能待实现')}
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
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">单件重量(kg)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center min-w-[150px]">产品名称 <span className="text-red-500">*</span></th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">应收单价(￥)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">应收单价(₱)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">应付单价(₱) <span className="text-red-500">*</span></th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">应付单价(￥)</th>
                          <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">操作</th>
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
                                <option value="GP_20">20GP</option>
                                <option value="GP_40">40GP</option>
                                <option value="HQ_40">40HQ</option>
                                <option value="HQ_45">45HQ</option>
                              </select>
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.quantity}
                                onChange={(e) => updateContainer(container.id, 'quantity', e.target.value)}
                                placeholder="请输入件数"
                                min="1"
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.weight}
                                onChange={(e) => updateContainer(container.id, 'weight', e.target.value)}
                                placeholder="请输入单件重量"
                                min="0.01"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="text"
                                value={container.productName}
                                onChange={(e) => updateContainer(container.id, 'productName', e.target.value)}
                                placeholder="请输入产品名称"
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.cnyUnitPrice}
                                onChange={(e) => updateContainer(container.id, 'cnyUnitPrice', e.target.value)}
                                placeholder="应收单价￥"
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.phpUnitPrice}
                                onChange={(e) => updateContainer(container.id, 'phpUnitPrice', e.target.value)}
                                placeholder="应收单价₱"
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.channelUnitPricePhp}
                                onChange={(e) => updateContainer(container.id, 'channelUnitPricePhp', e.target.value)}
                                placeholder="应付单价₱"
                                min="0"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>

                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                value={container.channelUnitPriceCny}
                                onChange={(e) => updateContainer(container.id, 'channelUnitPriceCny', e.target.value)}
                                placeholder="应付单价￥"
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              />
                            </td>
                            
                            <td className="border-b border-gray-300 px-3 py-2">
                              <div className="flex items-center justify-center gap-2">
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
                            <td colSpan={9} className="border-b border-gray-300 px-4 py-3">
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
                      <span className="text-red-500">*</span>渠道
                    </label>
                    <select
                      value={currentData.warehouse}
                      onChange={(e) => updateFormData('warehouse', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择渠道</option>
                      <option value="yiwu">义乌</option>
                      <option value="longyan">龙岩</option>
                      <option value="guangzhou">广州</option>
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
                      <option value="vietnam">越南</option>
                      <option value="thailand">泰国</option>
                      <option value="malaysia">马来西亚</option>
                      <option value="singapore">新加坡</option>
                      <option value="indonesia">印度尼西亚</option>
                      <option value="philippines">菲律宾</option>
                      <option value="myanmar">缅甸</option>
                      <option value="cambodia">柬埔寨</option>
                      <option value="laos">老挝</option>
                      <option value="brunei">文莱</option>
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
                      <span className="text-red-500">*</span>渠道
                    </label>
                    <select
                      value={currentData.warehouse}
                      onChange={(e) => updateFormData('warehouse', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择渠道</option>
                      <option value="yiwu">义乌</option>
                      <option value="longyan">龙岩</option>
                      <option value="guangzhou">广州</option>
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
                      <option value="vietnam">越南</option>
                      <option value="thailand">泰国</option>
                      <option value="malaysia">马来西亚</option>
                      <option value="singapore">新加坡</option>
                      <option value="indonesia">印度尼西亚</option>
                      <option value="philippines">菲律宾</option>
                      <option value="myanmar">缅甸</option>
                      <option value="cambodia">柬埔寨</option>
                      <option value="laos">老挝</option>
                      <option value="brunei">文莱</option>
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
                    <label className="block text-sm font-medium text-gray-700">船号/航次</label>
                    <input
                      type="text"
                      placeholder="请输入船号/航次"
                      value={currentData.voyageNumber}
                      onChange={(e) => updateFormData('voyageNumber', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">用户唛头</label>
                      <select
                        value={currentData.userMarkId}
                        onChange={(e) => handleUserMarkSelect(e.target.value)}
                        disabled={isLoadingUsers}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">请选择用户唛头</option>
                        {regularUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.phone})
                          </option>
                        ))}
                      </select>
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

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">签收时间</label>
                      <input
                        type="date"
                        value={currentData.recipientReceivedAt}
                        onChange={(e) => updateFormData('recipientReceivedAt', e.target.value)}
                        onClick={(e) => { const el = e.currentTarget; if ('showPicker' in el) (el as HTMLInputElement).showPicker(); }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">收件凭证</label>
                      <div className="relative">
                        {currentData.receiptUrl ? (
                          <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
                            <img 
                              src={currentData.receiptPreviewUrl || currentData.receiptUrl} 
                              alt="收件凭证"
                              className="w-16 h-16 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{currentData.receiptFileName}</p>
                              <p className="text-xs text-gray-500 mt-1">已上传</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (currentData.receiptPreviewUrl) {
                                  URL.revokeObjectURL(currentData.receiptPreviewUrl);
                                }
                                updateFormData('receiptUrl', '');
                                updateFormData('receiptFileName', '');
                                updateFormData('receiptPreviewUrl', '');
                                updateFormData('receiptFile', undefined);
                              }}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              删除
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">点击上传</span> 或拖拽图片到此处
                              </p>
                              <p className="text-xs text-gray-500">支持 JPG、PNG、GIF、WEBP，最大10MB</p>
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                if (file.size > 10 * 1024 * 1024) {
                                  toast.error('文件大小不能超过10MB');
                                  return;
                                }

                                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                                if (!allowedTypes.includes(file.type)) {
                                  toast.error('不支持的文件类型');
                                  return;
                                }

                                try {
                                  const previewUrl = URL.createObjectURL(file);
                                  updateFormData('receiptFile', file);
                                  updateFormData('receiptFileName', file.name);
                                  updateFormData('receiptPreviewUrl', previewUrl);
                                  updateFormData('receiptUrl', previewUrl);
                                } catch (error: any) {
                                  toast.error('读取文件失败，请重试');
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-8 border-b">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">填写海外收件人信息</h2>
                    <button
                      type="button"
                      onClick={handleResetOverseasInfo}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      重置海外收件信息
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">海外收件人管理</label>
                      <select
                        value={currentData.overseasContact}
                        onChange={(e) => handleOverseasAddressSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoadingAddresses}
                      >
                        <option value="">请选择海外收件人</option>
                        {overseasAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.name} - {addr.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">海外收件人</label>
                      <input
                        type="text"
                        placeholder="请输入海外收件人"
                        value={currentData.overseasName}
                        onChange={(e) => updateFormData('overseasName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">公司</label>
                      <input
                        type="text"
                        placeholder="请输入公司名称"
                        value={currentData.overseasCompany}
                        onChange={(e) => updateFormData('overseasCompany', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">手机号码</label>
                      <input
                        type="text"
                        placeholder="请输入手机号码"
                        value={currentData.overseasPhone}
                        onChange={(e) => updateFormData('overseasPhone', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">所在地区</label>
                      <select
                        value={currentData.overseasRegion}
                        onChange={(e) => updateFormData('overseasRegion', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">请选择国家/地区</option>
                        <option value="philippines">菲律宾</option>
                        <option value="malaysia">马来西亚</option>
                        <option value="singapore">新加坡</option>
                        <option value="vietnam">越南</option>
                        <option value="thailand">泰国</option>
                        <option value="indonesia">印度尼西亚</option>
                        <option value="usa">美国</option>
                        <option value="canada">加拿大</option>
                        <option value="australia">澳大利亚</option>
                        <option value="uk">英国</option>
                        <option value="germany">德国</option>
                        <option value="france">法国</option>
                        <option value="japan">日本</option>
                        <option value="korea">韩国</option>
                        <option value="hongkong">香港</option>
                        <option value="taiwan">台湾</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">详细地址</label>
                      <input
                        type="text"
                        placeholder="请输入详细地址"
                        value={currentData.overseasAddress}
                        onChange={(e) => updateFormData('overseasAddress', e.target.value)}
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
                      onClick={() => toast.info('批量申报功能待实现')}
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
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-24">数量 <span className="text-red-500">*</span></th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">长(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">宽(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">高(cm)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-32">体积(m³)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-28">单件重量(kg)</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-40">应收单价</th>
                          <th className="border-b border-r border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center w-40">应付单价</th>
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
                                placeholder="数量"
                                value={pkg.quantity}
                                onChange={(e) => updatePackage(pkg.id, 'quantity', e.target.value)}
                                min="1"
                                required
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
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

                            <td className="border-b border-r border-gray-300 px-3 py-2 text-center text-sm text-gray-700 bg-gray-50">
                              {pkg.length && pkg.width && pkg.height && pkg.quantity
                                ? (parseFloat(pkg.length) * parseFloat(pkg.width) * parseFloat(pkg.height) / 1_000_000 * parseInt(pkg.quantity)).toFixed(4)
                                : '-'}
                            </td>
                            
                            <td className="border-b border-r border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                placeholder="单件重量"
                                value={pkg.weight}
                                onChange={(e) => updatePackage(pkg.id, 'weight', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            
                             <td className="border-b border-r border-gray-300 px-3 py-2">
                               <div className="flex gap-1">
                                 <select
                                   value={pkg.receivableCurrency}
                                   onChange={(e) => {
                                     const cur = e.target.value as 'CNY' | 'PHP';
                                     updatePackageFields(pkg.id, { receivableCurrency: cur, cnyUnitPrice: '', phpUnitPrice: '' });
                                   }}
                                   className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-16"
                                 >
                                   <option value="CNY">¥</option>
                                   <option value="PHP">₱</option>
                                 </select>
                                 <input
                                   type="number"
                                   placeholder="单价"
                                   value={pkg.receivableCurrency === 'CNY' ? pkg.cnyUnitPrice : pkg.phpUnitPrice}
                                   onChange={(e) => {
                                     if (pkg.receivableCurrency === 'CNY') {
                                       updatePackage(pkg.id, 'cnyUnitPrice', e.target.value);
                                     } else {
                                       updatePackage(pkg.id, 'phpUnitPrice', e.target.value);
                                     }
                                   }}
                                   className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                 />
                               </div>
                             </td>

                             <td className="border-b border-r border-gray-300 px-3 py-2">
                               <div className="flex gap-1">
                                 <select
                                   value={pkg.payableCurrency}
                                   onChange={(e) => {
                                     const cur = e.target.value as 'CNY' | 'PHP';
                                     updatePackageFields(pkg.id, { payableCurrency: cur, channelUnitPricePhp: '', channelUnitPriceCny: '' });
                                   }}
                                   className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-16"
                                 >
                                   <option value="CNY">¥</option>
                                   <option value="PHP">₱</option>
                                 </select>
                                 <input
                                   type="number"
                                   placeholder="单价"
                                   value={pkg.payableCurrency === 'CNY' ? pkg.channelUnitPriceCny : pkg.channelUnitPricePhp}
                                   onChange={(e) => {
                                     if (pkg.payableCurrency === 'CNY') {
                                       updatePackage(pkg.id, 'channelUnitPriceCny', e.target.value);
                                     } else {
                                       updatePackage(pkg.id, 'channelUnitPricePhp', e.target.value);
                                     }
                                   }}
                                   className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                 />
                               </div>
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
                          <td colSpan={10} className="border-b border-gray-300 px-4 py-3">
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

                  {activeTab === 'AIR' && (
                    <div className="mt-6 p-6 border border-gray-200 rounded-lg">
                      <h3 className="text-base font-medium text-gray-900 mb-4">其他费用</h3>
                      <div className="grid grid-cols-2 gap-6 max-w-xl">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">应收叫车费 (¥)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={currentData.carPickupReceivable}
                            onChange={(e) => updateFormData('carPickupReceivable', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">应付叫车费 (¥)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={currentData.carPickupActual}
                            onChange={(e) => updateFormData('carPickupActual', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const pkgs = currentData.packages;
                    const totalPieces = pkgs.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);

                    const calcLine = (p: PackageItem, priceField: 'phpUnitPrice' | 'cnyUnitPrice' | 'channelUnitPricePhp' | 'channelUnitPriceCny') => {
                      const price = parseFloat(p[priceField]);
                      if (!price) return 0;
                      if (activeTab === 'SEA_LCL') {
                        const l = parseFloat(p.length), w = parseFloat(p.width), h = parseFloat(p.height);
                        const qty = parseInt(p.quantity) || 0;
                        if (!l || !w || !h || !qty) return 0;
                        return price * (l * w * h / 1_000_000) * qty;
                      } else {
                        const weight = parseFloat(p.weight);
                        const qty = parseInt(p.quantity) || 0;
                        if (!weight || !qty) return 0;
                        return price * weight * qty;
                      }
                    };

                    const receivableUsePhp = pkgs.some(p => !!p.phpUnitPrice);
                    const payableUsePhp = pkgs.some(p => !!p.channelUnitPricePhp);

                    const totalReceivable = pkgs.reduce((sum, p) => sum + calcLine(p, receivableUsePhp ? 'phpUnitPrice' : 'cnyUnitPrice'), 0);
                    const totalPayable = pkgs.reduce((sum, p) => sum + calcLine(p, payableUsePhp ? 'channelUnitPricePhp' : 'channelUnitPriceCny'), 0);

                    const receivableSymbol = receivableUsePhp ? '₱' : '¥';
                    const payableSymbol = payableUsePhp ? '₱' : '¥';

                    const totalVolM3 = pkgs.reduce((sum, p) => {
                      const l = parseFloat(p.length), w = parseFloat(p.width), h = parseFloat(p.height);
                      const qty = parseInt(p.quantity) || 0;
                      if (!l || !w || !h || !qty) return sum;
                      return sum + (l * w * h / 1_000_000) * qty;
                    }, 0);

                    const totalWeight = pkgs.reduce((sum, p) => sum + (parseFloat(p.weight) || 0) * (parseInt(p.quantity) || 0), 0);

                    const carPickupReceivable = parseFloat(currentData.carPickupReceivable) || 0;
                    const carPickupActual = parseFloat(currentData.carPickupActual) || 0;

                    return (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="grid grid-cols-4 gap-6 text-sm">
                          <div>
                            <span className="text-gray-500">总件数</span>
                            <p className="text-lg font-semibold text-gray-900 mt-1">{totalPieces} 件</p>
                          </div>
                          <div>
                            <span className="text-gray-500">总重量</span>
                            <p className="text-lg font-semibold text-gray-900 mt-1">
                              {totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">应收总价{activeTab === 'AIR' && carPickupReceivable > 0 ? `（含叫车费 ¥${carPickupReceivable.toFixed(2)}）` : ''}</span>
                            <p className="text-lg font-semibold text-blue-600 mt-1">
                              {totalReceivable > 0 || carPickupReceivable > 0
                                ? `${receivableSymbol}${(totalReceivable + (receivableUsePhp ? 0 : carPickupReceivable)).toFixed(2)}${receivableUsePhp && carPickupReceivable > 0 ? ` + ¥${carPickupReceivable.toFixed(2)}` : ''}`
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">应付总价{activeTab === 'AIR' && carPickupActual > 0 ? `（含叫车费 ¥${carPickupActual.toFixed(2)}）` : ''}</span>
                            <p className="text-lg font-semibold text-orange-600 mt-1">
                              {totalPayable > 0 || carPickupActual > 0
                                ? `${payableSymbol}${(totalPayable + (payableUsePhp ? 0 : carPickupActual)).toFixed(2)}${payableUsePhp && carPickupActual > 0 ? ` + ¥${carPickupActual.toFixed(2)}` : ''}`
                                : '-'}
                            </p>
                          </div>
                        </div>
                        {activeTab === 'AIR' && totalVolM3 > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-gray-500">
                            总体积：{totalVolM3.toFixed(4)} m³
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
