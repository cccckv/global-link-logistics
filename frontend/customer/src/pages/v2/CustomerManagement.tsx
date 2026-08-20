import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Edit2,
  MapPin,
  Star,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import {
  customerV2Api,
  type Customer,
  type CustomerAddress,
} from '../../lib/v2-api';
import { BatchImportModal } from '../../components/v2/BatchImportModal';
import {
  DESTINATION_COUNTRIES,
  getPortsByCountry,
  getDefaultPortByCountry,
  ORIGIN_WAREHOUSES,
} from '../../lib/logistics-dictionary';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Expanded address book state for customers (which customer card has address book expanded)
  const [expandedAddressBooks, setExpandedAddressBooks] = useState<Record<string, boolean>>({});

  // Create / Edit Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [clientCode, setClientCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('菲律宾');
  const [destinationPort, setDestinationPort] = useState('马尼拉南港');
  const [defaultWarehouse, setDefaultWarehouse] = useState('广州仓');
  const [note, setNote] = useState('');

  // Initial address when creating customer
  const [initAddrName, setInitAddrName] = useState('');
  const [initAddrPhone, setInitAddrPhone] = useState('');
  const [initAddrCompany, setInitAddrCompany] = useState('');
  const [initAddrDetail, setInitAddrDetail] = useState('');

  // Add / Edit Single Address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState<string>('');
  const [targetCustomerName, setTargetCustomerName] = useState<string>('');
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [modalAddrName, setModalAddrName] = useState('');
  const [modalAddrPhone, setModalAddrPhone] = useState('');
  const [modalAddrCompany, setModalAddrCompany] = useState('');
  const [modalAddrCountry, setModalAddrCountry] = useState('');
  const [modalAddrRegion, setModalAddrRegion] = useState('');
  const [modalAddrDetail, setModalAddrDetail] = useState('');
  const [modalAddrIsDefault, setModalAddrIsDefault] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerV2Api.list({ search: search.trim() || undefined });
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (err: any) {
      toast.error('加载客户档案失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers();
  };

  const toggleAddressBook = (customerId: string) => {
    setExpandedAddressBooks((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  // Open Create Customer Modal
  const handleOpenCreateCustomer = () => {
    setEditingCustomer(null);
    setClientCode('');
    setName('');
    setPhone('');
    setCompany('');
    setDestinationCountry('菲律宾');
    setDestinationPort('马尼拉南港');
    setDefaultWarehouse('广州仓');
    setNote('');
    setInitAddrName('');
    setInitAddrPhone('');
    setInitAddrCompany('');
    setInitAddrDetail('');
    setShowCustomerModal(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setClientCode(c.clientCode);
    setName(c.name);
    setPhone(c.phone || '');
    setCompany(c.company || '');
    setDestinationCountry(c.destinationCountry || '菲律宾');
    setDestinationPort(c.destinationPort || '马尼拉南港');
    setDefaultWarehouse(c.defaultWarehouse || '广州仓');
    setNote(c.note || '');
    setShowCustomerModal(true);
  };

  // Save Customer (Create or Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientCode.trim() || !name.trim()) {
      toast.error('客户编码/唛头与客户名称为必填项');
      return;
    }

    try {
      if (editingCustomer) {
        await customerV2Api.update(editingCustomer.id, {
          clientCode: clientCode.trim(),
          name: name.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          destinationCountry,
          destinationPort,
          defaultWarehouse,
          note: note.trim() || undefined,
        });
        toast.success(`客户档案 [${clientCode}] 已成功更新！`);
      } else {
        await customerV2Api.create({
          clientCode: clientCode.trim(),
          name: name.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          destinationCountry,
          destinationPort,
          defaultWarehouse,
          note: note.trim() || undefined,
          addresses: initAddrName.trim()
            ? [
                {
                  name: initAddrName.trim(),
                  phone: initAddrPhone.trim() || phone.trim() || '-',
                  company: initAddrCompany.trim() || undefined,
                  country: destinationCountry,
                  region: destinationPort,
                  address: initAddrDetail.trim() || '默认目的港派送地址',
                  isDefault: true,
                },
              ]
            : undefined,
        });
        toast.success(`客户档案与唛头 [${clientCode}] 创建成功！`);
      }

      setShowCustomerModal(false);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '保存客户档案失败');
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string, code: string) => {
    if (!window.confirm(`确认删除客户档案【${name || code}】(${code}) 吗？\n删除后关联的所有海外收件人地址也将一并移除。`)) {
      return;
    }

    try {
      await customerV2Api.delete(id);
      toast.success(`客户档案 [${code}] 已成功删除`);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '删除客户失败');
    }
  };

  // Open Add Address Modal
  const handleOpenAddAddress = (c: Customer) => {
    setTargetCustomerId(c.id);
    setTargetCustomerName(`${c.name} (${c.clientCode})`);
    setEditingAddress(null);
    setModalAddrName('');
    setModalAddrPhone('');
    setModalAddrCompany('');
    setModalAddrCountry(c.destinationCountry || '菲律宾');
    setModalAddrRegion(c.destinationPort || '马尼拉南港');
    setModalAddrDetail('');
    setModalAddrIsDefault((c.addresses?.length || 0) === 0);
    setShowAddressModal(true);
  };

  // Open Edit Address Modal
  const handleOpenEditAddress = (c: Customer, addr: CustomerAddress) => {
    setTargetCustomerId(c.id);
    setTargetCustomerName(`${c.name} (${c.clientCode})`);
    setEditingAddress(addr);
    setModalAddrName(addr.name);
    setModalAddrPhone(addr.phone);
    setModalAddrCompany(addr.company || '');
    setModalAddrCountry(addr.country || c.destinationCountry || '菲律宾');
    setModalAddrRegion(addr.region || c.destinationPort || '马尼拉南港');
    setModalAddrDetail(addr.address);
    setModalAddrIsDefault(addr.isDefault);
    setShowAddressModal(true);
  };

  // Save Address (Add or Edit)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAddrName.trim() || !modalAddrPhone.trim() || !modalAddrDetail.trim()) {
      toast.error('收件人姓名、联系电话与详细地址为必填项');
      return;
    }

    setSubmittingAddress(true);
    try {
      if (editingAddress) {
        await customerV2Api.updateAddress(targetCustomerId, editingAddress.id, {
          name: modalAddrName.trim(),
          phone: modalAddrPhone.trim(),
          company: modalAddrCompany.trim() || undefined,
          country: modalAddrCountry.trim() || undefined,
          region: modalAddrRegion.trim() || undefined,
          address: modalAddrDetail.trim(),
          isDefault: modalAddrIsDefault,
        });
        toast.success(`海外收件人【${modalAddrName}】已更新！`);
      } else {
        await customerV2Api.addAddress(targetCustomerId, {
          name: modalAddrName.trim(),
          phone: modalAddrPhone.trim(),
          company: modalAddrCompany.trim() || undefined,
          country: modalAddrCountry.trim() || undefined,
          region: modalAddrRegion.trim() || undefined,
          address: modalAddrDetail.trim(),
          isDefault: modalAddrIsDefault,
        });
        toast.success(`已为【${targetCustomerName}】添加海外收件人！`);
      }

      setShowAddressModal(false);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '保存收件人地址失败');
    } finally {
      setSubmittingAddress(false);
    }
  };

  // Set Address as Default
  const handleSetDefaultAddress = async (customerId: string, addressId: string, addrName: string) => {
    try {
      await customerV2Api.setDefaultAddress(customerId, addressId);
      toast.success(`已将【${addrName}】设为该客户的默认收件人`);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '设置默认收件人失败');
    }
  };

  // Delete Address
  const handleDeleteAddress = async (customerId: string, addressId: string, addrName: string) => {
    if (!window.confirm(`确认删除收件人【${addrName}】吗？`)) return;
    try {
      await customerV2Api.deleteAddress(customerId, addressId);
      toast.success(`收件人【${addrName}】已删除`);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '删除收件人失败');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              基础主数据
            </span>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              客户档案与海外收件人地址簿
            </h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            认唛头不认发件人 · 维护客户编码/唛头 (如 WH-ZZY-FLB) 与其名下的多套海外收件人档案，开单秒级带出
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={loadCustomers}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            title="刷新数据"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            刷新
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            批量导入客户
          </button>

          <button
            onClick={handleOpenCreateCustomer}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            新建客户唛头
          </button>
        </div>
      </div>

      {/* 搜索与全局反查工具栏 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索唛头、客户名、电话、或输入海外收件人姓名/电话/地址进行反查..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
          >
            查询 / 反查
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                customerV2Api.list().then((res) => res.data.data && setCustomers(res.data.data));
              }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2"
            >
              清空
            </button>
          )}
        </form>

        <div className="text-xs text-slate-500 font-medium">
          共收录 <span className="font-bold text-blue-600">{customers.length}</span> 位客户档案
        </div>
      </div>

      {/* Grid of Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && customers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">正在加载客户档案与收件人地址簿...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无匹配的客户档案，请尝试更换搜索词或点击右上角新建。
          </div>
        ) : (
          customers.map((c) => {
            const addressList = (c.addresses || []) as CustomerAddress[];
            const defaultAddress = addressList.find((a) => a.isDefault) || addressList[0];
            const isExpanded = !!expandedAddressBooks[c.id];

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold">
                        {c.clientCode}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                        {c.name}
                        {c.company && (
                          <span className="text-xs font-normal text-slate-500">
                            ({c.company})
                          </span>
                        )}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCustomer(c)}
                        title="编辑客户档案"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(c.id, c.name, c.clientCode)}
                        title="删除客户档案"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Route & Contact info */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">常用路线:</span>
                      <span className="font-semibold text-slate-800">
                        {c.defaultWarehouse || '广州仓'} ➔ {c.destinationCountry || '菲律宾'} ({c.destinationPort || '马尼拉南港'})
                      </span>
                    </div>
                    {c.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">客户电话:</span>
                        <span className="font-mono font-medium">{c.phone}</span>
                      </div>
                    )}
                    {c.note && (
                      <div className="pt-1 border-t border-slate-200/60 text-[11px] text-amber-800">
                        💡 {c.note}
                      </div>
                    )}
                  </div>

                  {/* Overseas Consignee Address Book Box */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        海外收件人档案簿 ({addressList.length})
                      </span>
                      <button
                        onClick={() => handleOpenAddAddress(c)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        添加收件人
                      </button>
                    </div>

                    {addressList.length === 0 ? (
                      <div className="p-3 bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 text-center text-xs text-slate-400">
                        暂未绑定海外收件人，点击上方添加
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Default Address Highlight Card */}
                        {defaultAddress && (
                          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-1 relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                <span>{defaultAddress.name}</span>
                                <span className="font-mono text-emerald-800 text-[11px]">
                                  {defaultAddress.phone}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-200 rounded">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                默认收件人
                              </span>
                            </div>
                            {defaultAddress.company && (
                              <p className="text-slate-500 text-[11px]">{defaultAddress.company}</p>
                            )}
                            <p className="text-slate-700 text-[11px] leading-relaxed line-clamp-2">
                              {defaultAddress.country ? `${defaultAddress.country} · ` : ''}
                              {defaultAddress.region ? `${defaultAddress.region} · ` : ''}
                              {defaultAddress.address}
                            </p>
                          </div>
                        )}

                        {/* Expand/Collapse Additional Addresses */}
                        {addressList.length > 1 && (
                          <div className="space-y-2">
                            <button
                              onClick={() => toggleAddressBook(c.id)}
                              className="w-full py-1 text-center text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center justify-center gap-1 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  收起其他 {addressList.length - 1} 个收件人 <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  展开查看全部 {addressList.length} 个海外收件人 <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="space-y-2 pt-1 border-t border-slate-100 max-h-56 overflow-y-auto pr-1">
                                {addressList.map((addr) => (
                                  <div
                                    key={addr.id}
                                    className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                                      addr.isDefault
                                        ? 'bg-emerald-50/50 border-emerald-200'
                                        : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                        <span>{addr.name}</span>
                                        <span className="font-mono text-slate-600 text-[11px]">
                                          {addr.phone}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {!addr.isDefault && (
                                          <button
                                            onClick={() => handleSetDefaultAddress(c.id, addr.id, addr.name)}
                                            className="text-[10px] text-slate-400 hover:text-amber-600 font-bold px-1"
                                            title="设为默认"
                                          >
                                            设为默认
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleOpenEditAddress(c, addr)}
                                          className="text-slate-400 hover:text-blue-600 p-0.5"
                                          title="编辑"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAddress(c.id, addr.id, addr.name)}
                                          className="text-slate-400 hover:text-rose-600 p-0.5"
                                          title="删除"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed">
                                      {addr.company ? `[${addr.company}] ` : ''}
                                      {addr.country ? `${addr.country} ` : ''}
                                      {addr.address}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingCustomer ? `编辑客户档案 [${editingCustomer.clientCode}]` : '新建客户档案与专属唛头'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  客户唛头是集运分拣归集的核心依据，支持预设常用路线与海外收件人
                </p>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    客户唛头 / 编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 WH-ZZY-FLB / WH-10098"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold uppercase text-blue-900"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    客户姓名 / 负责人 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 张总 / 晨光外贸"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">国内联系电话 (选填)</label>
                  <input
                    type="text"
                    placeholder="如 138-0000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">所属公司 / 档口名称 (选填)</label>
                  <input
                    type="text"
                    placeholder="如 晨光进出口贸易有限公司"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">常用起运仓</label>
                  <select
                    value={defaultWarehouse}
                    onChange={(e) => setDefaultWarehouse(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {ORIGIN_WAREHOUSES.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">常用目的国</label>
                  <select
                    value={destinationCountry}
                    onChange={(e) => {
                      const c = e.target.value;
                      setDestinationCountry(c);
                      setDestinationPort(getDefaultPortByCountry(c));
                    }}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {DESTINATION_COUNTRIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">常用目的港</label>
                  <select
                    value={destinationPort}
                    onChange={(e) => setDestinationPort(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {getPortsByCountry(destinationCountry).map((port) => (
                      <option key={port} value={port}>
                        {port}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingCustomer && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      绑定初始海外收件人 (选填，支持后续添加多个)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="海外收件人姓名"
                      value={initAddrName}
                      onChange={(e) => setInitAddrName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    />
                    <input
                      type="text"
                      placeholder="海外联系电话"
                      value={initAddrPhone}
                      onChange={(e) => setInitAddrPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-medium"
                    />
                    <input
                      type="text"
                      placeholder="海外公司 (选填)"
                      value={initAddrCompany}
                      onChange={(e) => setInitAddrCompany(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="目的港详细送货/派送地址"
                    value={initAddrDetail}
                    onChange={(e) => setInitAddrDetail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">客户特约备注 (选填)</label>
                <input
                  type="text"
                  placeholder="如 特约单价客户、木架加固要求"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20"
                >
                  确认保存客户
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Overseas Consignee Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  {editingAddress ? '编辑海外收件人地址' : '添加海外收件人地址'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  归属客户: <span className="font-bold text-slate-800">{targetCustomerName}</span>
                </p>
              </div>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    海外收件人姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 Alex Johnson / 马尼拉档口A"
                    value={modalAddrName}
                    onChange={(e) => setModalAddrName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    联系电话 / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 +63 917 123 4567"
                    value={modalAddrPhone}
                    onChange={(e) => setModalAddrPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-blue-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">目的国家</label>
                  <input
                    type="text"
                    placeholder="如 菲律宾"
                    value={modalAddrCountry}
                    onChange={(e) => setModalAddrCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">城市 / 目的港</label>
                  <input
                    type="text"
                    placeholder="如 马尼拉南港"
                    value={modalAddrRegion}
                    onChange={(e) => setModalAddrRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">海外公司名称 (选填)</label>
                  <input
                    type="text"
                    placeholder="如 Trade Co Ltd"
                    value={modalAddrCompany}
                    onChange={(e) => setModalAddrCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  目的港详细派送 / 送货地址 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="如 Unit 802, BGC High Street, Taguig City, Metro Manila"
                  value={modalAddrDetail}
                  onChange={(e) => setModalAddrDetail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium leading-relaxed"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modalAddrIsDefault}
                  onChange={(e) => setModalAddrIsDefault(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-bold text-slate-800">设为该客户的默认收件人 (开单优先匹配)</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submittingAddress}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {submittingAddress ? '正在保存...' : '确认保存收件人'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showImportModal && (
        <BatchImportModal
          isOpen={showImportModal}
          importType="CUSTOMER"
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            loadCustomers();
          }}
        />
      )}
    </div>
  );
}
