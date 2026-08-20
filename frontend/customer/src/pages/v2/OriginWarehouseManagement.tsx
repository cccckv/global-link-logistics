import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  Search,
  RefreshCw,
  MapPin,
  Clock,
  Copy,
  Warehouse,
} from 'lucide-react';
import {
  originWarehouseV2Api,
  type OriginWarehouse,
} from '../../lib/v2-api';

export default function OriginWarehouseManagement() {
  const [warehouses, setWarehouses] = useState<OriginWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<OriginWarehouse | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [receivingHours, setReceivingHours] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const activeParam = filterActive === 'all' ? undefined : filterActive === 'true';
      const res = await originWarehouseV2Api.list({
        isActive: activeParam,
        search: search.trim() || undefined,
      });
      if (res.data.success) {
        setWarehouses(res.data.data);
      }
    } catch (err: any) {
      toast.error('加载起运仓数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, [filterActive]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadWarehouses();
  };

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setCode('');
    setName('');
    setShortName('');
    setContactName('');
    setContactPhone('');
    setProvince('广东省');
    setCity('广州市');
    setAddress('');
    setReceivingHours('09:00 - 21:00 (周一至周日)');
    setIsDefault(false);
    setIsActive(true);
    setSortOrder(warehouses.length + 1);
    setNote('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (w: OriginWarehouse) => {
    setEditingWarehouse(w);
    setCode(w.code);
    setName(w.name);
    setShortName(w.shortName);
    setContactName(w.contactName);
    setContactPhone(w.contactPhone);
    setProvince(w.province || '');
    setCity(w.city || '');
    setAddress(w.address);
    setReceivingHours(w.receivingHours || '');
    setIsDefault(w.isDefault);
    setIsActive(w.isActive);
    setSortOrder(w.sortOrder);
    setNote(w.note || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !contactName.trim() || !contactPhone.trim() || !address.trim()) {
      toast.error('仓库全称、简码、联系人、联系电话和详细地址均为必填项');
      return;
    }

    setSubmitting(true);
    try {
      if (editingWarehouse) {
        await originWarehouseV2Api.update(editingWarehouse.id, {
          code: code.trim(),
          name: name.trim(),
          shortName: shortName.trim() || name.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          province: province.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim(),
          receivingHours: receivingHours.trim() || undefined,
          isDefault,
          isActive,
          sortOrder: Number(sortOrder) || 0,
          note: note.trim() || undefined,
        });
        toast.success(`起运仓【${name}】已成功更新`);
      } else {
        await originWarehouseV2Api.create({
          code: code.trim(),
          name: name.trim(),
          shortName: shortName.trim() || name.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          province: province.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim(),
          receivingHours: receivingHours.trim() || undefined,
          isDefault,
          isActive,
          sortOrder: Number(sortOrder) || 0,
          note: note.trim() || undefined,
        });
        toast.success(`起运仓【${name}】创建成功！`);
      }

      setIsModalOpen(false);
      loadWarehouses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '保存起运仓失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (w: OriginWarehouse) => {
    if (w.isDefault) return;
    try {
      await originWarehouseV2Api.setDefault(w.id);
      toast.success(`已将【${w.name}】设为系统默认起运仓`);
      loadWarehouses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '设置默认仓失败');
    }
  };

  const handleDelete = async (w: OriginWarehouse) => {
    if (!window.confirm(`确认删除起运仓【${w.name}】(${w.code}) 吗？\n注意：如果已有运单以此仓作为起运点，删除后历史运单将保留文本记录。`)) {
      return;
    }
    try {
      await originWarehouseV2Api.delete(w.id);
      toast.success(`起运仓【${w.name}】已成功删除`);
      loadWarehouses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '删除起运仓失败');
    }
  };

  const handleCopyGuide = (w: OriginWarehouse) => {
    const fullAddr = `${w.province || ''}${w.city || ''}${w.address}`;
    const text = `【送仓指引】${w.name} (${w.shortName})\n收货联系人: ${w.contactName}\n联系电话: ${w.contactPhone}\n详细仓址: ${fullAddr}\n营业收货时间: ${w.receivingHours || '工作日正常收货'}\n⚠️ 重要提示: 外箱醒目处请务必贴牢客户唛头！`;

    navigator.clipboard.writeText(text);
    toast.success(`已复制【${w.shortName}】客户送仓指引到剪贴板！`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 顶部标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              基础主数据
            </span>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-blue-600" />
              国内起运仓 / 集货点配置
            </h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            维护广州仓、龙岩仓、义乌仓等国内集运集货点的联系人、电话及详细仓址，支持一键复制客户送仓指引
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadWarehouses}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            title="刷新列表"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            刷新
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            新建起运仓
          </button>
        </div>
      </div>

      {/* 搜索与过滤工具栏 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索仓库名称、简码、联系人、地址..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
          >
            查询
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">状态筛选:</span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterActive('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterActive === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterActive('true')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterActive === 'true' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              启用中
            </button>
            <button
              onClick={() => setFilterActive('false')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterActive === 'false' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              已停用
            </button>
          </div>
        </div>
      </div>

      {/* 起运仓卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && warehouses.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">正在加载起运仓数据...</div>
        ) : warehouses.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无起运仓数据，请点击右上角新建。
          </div>
        ) : (
          warehouses.map((w) => (
            <div
              key={w.id}
              className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${
                w.isDefault ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'
              }`}
            >
              <div className="p-5 space-y-4">
                {/* 卡片头部 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                        {w.code}
                      </span>
                      {w.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          系统默认仓
                        </span>
                      )}
                      {!w.isActive && (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                          已停用
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-1.5 flex items-center gap-1.5">
                      {w.name}
                      <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                        {w.shortName}
                      </span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(w)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="编辑起运仓"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(w)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="删除起运仓"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 仓库联系人与电话 */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-400 font-medium">收货联系人:</span>
                    <span className="font-bold text-slate-900">{w.contactName}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-400 font-medium">联系电话:</span>
                    <span className="font-mono font-bold text-blue-700">{w.contactPhone}</span>
                  </div>
                  {w.receivingHours && (
                    <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        收货时间:
                      </span>
                      <span className="text-slate-600">{w.receivingHours}</span>
                    </div>
                  )}
                </div>

                {/* 仓库详细地址 */}
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {w.province || ''} {w.city || ''} {w.address}
                    </span>
                  </div>
                </div>

                {/* 备注说明 */}
                {w.note && (
                  <p className="text-[11px] text-amber-800 bg-amber-50/70 p-2.5 rounded-lg border border-amber-100/80 leading-relaxed">
                    💡 {w.note}
                  </p>
                )}
              </div>

              {/* 卡片底栏操作 */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopyGuide(w)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  复制送仓指引
                </button>

                {!w.isDefault && (
                  <button
                    onClick={() => handleSetDefault(w)}
                    className="text-xs font-bold text-slate-500 hover:text-amber-600 flex items-center gap-1 transition-all"
                  >
                    <Star className="w-3.5 h-3.5" />
                    设为默认仓
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新建/编辑 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingWarehouse ? `编辑起运仓 [${editingWarehouse.shortName}]` : '新建国内起运仓 / 集货点'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  填写集货仓库的标识代码、联系人及收货定位地址
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    仓库简码 (Code) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 GZ-01 / YW-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    仓库简称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 广州仓 / 龙岩仓"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  仓库全称 (Full Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如 广州白云集拼总仓"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    收货负责人/组别 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 广州收货组 (李主管)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    收件/咨询电话 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 138-0000-1111"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">省份</label>
                  <input
                    type="text"
                    placeholder="如 广东省"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">城市</label>
                  <input
                    type="text"
                    placeholder="如 广州市"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  仓库详细地址 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="如 白云区石井街道石沙路物流园B区6栋102室"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">营业收货时间</label>
                  <input
                    type="text"
                    placeholder="如 09:00 - 21:00 (周一至周日)"
                    value={receivingHours}
                    onChange={(e) => setReceivingHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">排序权重 (数字越小越前)</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">备注说明 / 送仓提示</label>
                <input
                  type="text"
                  placeholder="如 大宗货物请提前2小时预报，外箱务必贴牢唛头"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-bold text-slate-800">设为系统默认起运仓</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-bold text-slate-800">启用状态 (Active)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {submitting ? '正在保存...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
