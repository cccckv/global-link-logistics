import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Building } from 'lucide-react';
import { customerV2Api, type Customer } from '../../lib/v2-api';
import {
  DESTINATION_COUNTRIES,
  getPortsByCountry,
  getDefaultPortByCountry,
  ORIGIN_WAREHOUSES,
} from '../../lib/logistics-dictionary';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // New customer modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientCode, setClientCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [defaultWarehouse, setDefaultWarehouse] = useState('');

  // Default address fields
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrDetail, setAddrDetail] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerV2Api.list();
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

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientCode.trim() || !name.trim()) return;

    try {
      await customerV2Api.create({
        clientCode: clientCode.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        destinationCountry,
        destinationPort,
        defaultWarehouse,
        addresses: addrName.trim()
          ? [
              {
                name: addrName.trim(),
                phone: addrPhone.trim() || phone.trim() || '-',
                country: destinationCountry,
                region: destinationPort,
                address: addrDetail.trim() || '默认地址',
                isDefault: true,
              },
            ]
          : undefined,
      });

      toast.success('客户档案与唛头创建成功！');
      setShowCreateModal(false);
      setClientCode('');
      setName('');
      setPhone('');
      setCompany('');
      setAddrName('');
      setAddrDetail('');
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              客户主数据
            </span>
            <h1 className="text-2xl font-bold text-slate-900">客户档案与唛头管理</h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            维护客户编码/唛头 (如 WH-ZZY-FLB) 与其绑定的常用海外收件人地址簿，支持下单秒级自动带出
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          新建客户唛头
        </button>
      </div>

      {/* Grid of Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">正在加载客户档案...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无客户档案，请点击右上角新建。
          </div>
        ) : (
          customers.map((c) => {
            const defaultAddress = c.addresses?.find((a) => a.isDefault) || c.addresses?.[0];

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold">
                        {c.clientCode}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-2">{c.name}</h2>
                      {c.company && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building className="w-3.5 h-3.5" />
                          {c.company}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">常用路线:</span>
                      <span className="font-semibold text-slate-800">
                        {c.defaultWarehouse || '广州'} ➔ {c.destinationCountry || '菲律宾'} ({c.destinationPort || '马尼拉'})
                      </span>
                    </div>
                    {c.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">联系电话:</span>
                        <span className="font-mono font-medium">{c.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Default Overseas Recipient Box */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      绑定海外收件人 (下单自动带出)
                    </span>
                    {defaultAddress ? (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-blue-950">
                          <span>{defaultAddress.name}</span>
                          <span className="font-mono text-[11px] text-blue-700">{defaultAddress.phone}</span>
                        </div>
                        <p className="text-slate-500 text-[11px] truncate" title={defaultAddress.address}>
                          {defaultAddress.address}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">暂未配置默认收件地址</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                  <span>地址簿: {c.addresses?.length || 0} 个常用地址</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">新建客户档案与唛头</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  客户编码 / 唛头 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如 WH-10099"
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  客户名称 / 简称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如 菲律宾百货商贸"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">联系电话</label>
                <input
                  type="text"
                  placeholder="139..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">企业/公司全称</label>
                <input
                  type="text"
                  placeholder="公司名称"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">常用起运仓</label>
                <select
                  value={defaultWarehouse}
                  onChange={(e) => setDefaultWarehouse(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择起运仓 --</option>
                  {ORIGIN_WAREHOUSES.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">常用目的国</label>
                <select
                  value={destinationCountry}
                  onChange={(e) => {
                    const country = e.target.value;
                    setDestinationCountry(country);
                    setDestinationPort(getDefaultPortByCountry(country));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择常用目的国 --</option>
                  {DESTINATION_COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.enName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">常用目的港口 (与目的国关联)</label>
                <select
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择常用目的港 --</option>
                  {getPortsByCountry(destinationCountry).map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                  {destinationPort && !getPortsByCountry(destinationCountry).includes(destinationPort) && (
                    <option value={destinationPort}>
                      {destinationPort} (自定义)
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-800">绑定默认海外收件人 (选填)</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="海外联系人"
                  value={addrName}
                  onChange={(e) => setAddrName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="海外电话"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <input
                type="text"
                placeholder="详细收件地址 (如 Tondo, Manila)"
                value={addrDetail}
                onChange={(e) => setAddrDetail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                确认创建
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
