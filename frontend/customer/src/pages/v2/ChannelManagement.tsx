import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Ship,
  Plane,
  Anchor,
  FileCheck,
  ShieldCheck,
  Truck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  Search,
  RefreshCw,
  Building2,
  Phone,
  User,
} from 'lucide-react';

import {
  channelV2Api,
  type ChannelCategory,
  type ShippingChannel,
} from '../../lib/v2-api';

interface CategoryTabConfig {
  key: ChannelCategory;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const CATEGORY_TABS: CategoryTabConfig[] = [
  {
    key: 'SEA_LCL',
    label: '海运拼箱专线',
    sublabel: '散货拼柜承运渠道',
    icon: <Ship className="w-5 h-5 text-blue-600" />,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    key: 'AIR',
    label: '空运专线渠道',
    sublabel: '航空快运/庄家专线',
    icon: <Plane className="w-5 h-5 text-purple-600" />,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    key: 'FCL_BOOKING',
    label: '整柜 - 订舱渠道',
    sublabel: '船司/一级订舱代理',
    icon: <Anchor className="w-5 h-5 text-indigo-600" />,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    key: 'FCL_CUSTOMS',
    label: '整柜 - 报关渠道',
    sublabel: '国内出口报关行',
    icon: <FileCheck className="w-5 h-5 text-emerald-600" />,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    key: 'FCL_CLEARANCE',
    label: '整柜 - 清关渠道',
    sublabel: '目的港清关代理行',
    icon: <ShieldCheck className="w-5 h-5 text-amber-600" />,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    key: 'FCL_TRUCKING',
    label: '整柜 - 拖车渠道',
    sublabel: '码头港口集卡车队',
    icon: <Truck className="w-5 h-5 text-rose-600" />,
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

export const ChannelManagementPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ChannelCategory>('SEA_LCL');
  const [channels, setChannels] = useState<ShippingChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ShippingChannel | null>(null);
  const [formData, setFormData] = useState<{
    category: ChannelCategory;
    name: string;
    code: string;
    contactPerson: string;
    contactPhone: string;
    isDefault: boolean;
    isActive: boolean;
    note: string;
  }>({
    category: 'SEA_LCL',
    name: '',
    code: '',
    contactPerson: '',
    contactPhone: '',
    isDefault: false,
    isActive: true,
    note: '',
  });

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const res = await channelV2Api.list({ category: activeCategory });
      if (res.data.success) {
        setChannels(res.data.data);
      }
    } catch (err: any) {
      toast.error('加载渠道列表失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [activeCategory]);

  const handleOpenCreateModal = () => {
    setEditingChannel(null);
    setFormData({
      category: activeCategory,
      name: '',
      code: '',
      contactPerson: '',
      contactPhone: '',
      isDefault: false,
      isActive: true,
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ch: ShippingChannel) => {
    setEditingChannel(ch);
    setFormData({
      category: ch.category,
      name: ch.name,
      code: ch.code || '',
      contactPerson: ch.contactPerson || '',
      contactPhone: ch.contactPhone || '',
      isDefault: ch.isDefault,
      isActive: ch.isActive,
      note: ch.note || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('请输入渠道商名称');
      return;
    }

    try {
      if (editingChannel) {
        await channelV2Api.update(editingChannel.id, {
          category: formData.category,
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          contactPerson: formData.contactPerson.trim() || undefined,
          contactPhone: formData.contactPhone.trim() || undefined,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          note: formData.note.trim() || undefined,
        });
        toast.success(`渠道【${formData.name}】更新成功`);
      } else {
        await channelV2Api.create({
          category: formData.category,
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          contactPerson: formData.contactPerson.trim() || undefined,
          contactPhone: formData.contactPhone.trim() || undefined,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          note: formData.note.trim() || undefined,
        });
        toast.success(`渠道【${formData.name}】创建成功`);
      }
      setIsModalOpen(false);
      loadChannels();
    } catch (err: any) {
      toast.error('保存渠道失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleDefault = async (ch: ShippingChannel) => {
    if (ch.isDefault) return; // 已经是默认无需取消
    try {
      await channelV2Api.update(ch.id, { isDefault: true });
      toast.success(`已将【${ch.name}】设为当前分类默认渠道`);
      loadChannels();
    } catch (err: any) {
      toast.error('设置默认渠道失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleActive = async (ch: ShippingChannel) => {
    try {
      await channelV2Api.toggleActive(ch.id);
      toast.success(`已${ch.isActive ? '停用' : '启用'}【${ch.name}】`);
      loadChannels();
    } catch (err: any) {
      toast.error('操作失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (ch: ShippingChannel) => {
    if (!window.confirm(`确定要删除渠道【${ch.name}】吗？删除后将无法恢复。`)) {
      return;
    }
    try {
      await channelV2Api.delete(ch.id);
      toast.success(`已删除渠道【${ch.name}】`);
      loadChannels();
    } catch (err: any) {
      toast.error('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredChannels = channels.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.contactPhone && c.contactPhone.toLowerCase().includes(q)) ||
      (c.note && c.note.toLowerCase().includes(q))
    );
  });

  const activeTabConfig = CATEGORY_TABS.find((t) => t.key === activeCategory)!;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 max-w-[1400px] mx-auto space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              渠道与服务商管理
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                按运输方式分类
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              集中维护海运拼箱专线、空运专线及海运整柜（订舱/报关/清关/拖车）的全链路合作服务商与默认推荐选项
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadChannels}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            新增【{activeTabConfig.label}】
          </button>
        </div>
      </div>

      {/* 6 大分类选项卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all relative ${
                isSelected
                  ? 'bg-white border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-2 rounded-lg bg-slate-100/80">{tab.icon}</div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                )}
              </div>
              <div className="text-sm font-bold text-slate-900">{tab.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{tab.sublabel}</div>
            </button>
          );
        })}
      </div>

      {/* 主体卡片 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* 检索过滤条 */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${activeTabConfig.badgeColor}`}>
              {activeTabConfig.label}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              共 {channels.length} 个服务商 (已过滤展示 {filteredChannels.length} 条)
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索渠道名称、简码、联系人..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 渠道列表 */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            正在加载渠道数据...
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            暂无【{activeTabConfig.label}】渠道数据
            <div className="mt-3">
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                立即创建首个渠道
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4 w-12 text-center">默认</th>
                  <th className="py-3 px-4">渠道服务商名称</th>
                  <th className="py-3 px-4">代号/简码</th>
                  <th className="py-3 px-4">联系人与电话</th>
                  <th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4">业务备注说明</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChannels.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-50/60 transition group">
                    {/* 默认标识 */}
                    <td className="py-3 px-4 text-center">
                      <button
                        title={ch.isDefault ? '当前为默认渠道' : '点击设为默认'}
                        onClick={() => handleToggleDefault(ch)}
                        className={`p-1 rounded-md transition ${
                          ch.isDefault
                            ? 'text-amber-500 hover:scale-110'
                            : 'text-slate-300 hover:text-amber-400'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${ch.isDefault ? 'fill-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* 渠道名称 */}
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span>{ch.name}</span>
                      {ch.isDefault && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          默认推荐
                        </span>
                      )}
                    </td>

                    {/* 简码 */}
                    <td className="py-3 px-4 font-mono text-slate-600 font-semibold">
                      {ch.code ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ch.code}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 联系人 */}
                    <td className="py-3 px-4 text-slate-600">
                      {ch.contactPerson || ch.contactPhone ? (
                        <div className="space-y-0.5">
                          {ch.contactPerson && (
                            <div className="flex items-center gap-1 text-slate-800 font-medium">
                              <User className="w-3 h-3 text-slate-400" />
                              {ch.contactPerson}
                            </div>
                          )}
                          {ch.contactPhone && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {ch.contactPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 状态 */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(ch)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                          ch.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {ch.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            正常启用
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            已停用
                          </>
                        )}
                      </button>
                    </td>

                    {/* 备注 */}
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {ch.note || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 操作 */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(ch)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="编辑渠道"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ch)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="删除渠道"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增/编辑模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingChannel ? '编辑渠道服务商' : '新增渠道服务商'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* 所属分类 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">所属业务分类 *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ChannelCategory })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORY_TABS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label} ({t.sublabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* 渠道名称 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">渠道 / 服务商名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：万海自营拼箱专线 / 中外运 / 优尼科订舱"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 简码 / 代码 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">代号 / 简码 (选填)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="如：WH-LCL / SINOTRANS / UNICORN"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 联系人 & 电话 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">联系人 (选填)</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="业务对接人"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">联系电话 / 微信 (选填)</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="联系电话"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 备注说明 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">备注说明 (选填)</label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="如：负责马尼拉南港清关，时效2天..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 开关选项 */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>设为该分类下的默认推荐渠道</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>正常启用</span>
                </label>
              </div>

              {/* 底部按钮 */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition"
                >
                  确认保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChannelManagementPage;
