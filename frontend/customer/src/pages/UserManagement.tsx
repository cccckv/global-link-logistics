import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { userApi, type User, type UserRoleType } from '../lib/api';
import { customerV2Api, type Customer } from '../lib/v2-api';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Users,
  ShieldCheck,
  Briefcase,
  BadgeDollarSign,
  UserCheck,
  Tag,
  KeyRound,
  Phone,
  User as UserIcon,
} from 'lucide-react';

const ROLE_CONFIG: Record<
  UserRoleType,
  {
    label: string;
    icon: any;
    badgeCls: string;
    description: string;
  }
> = {
  ADMIN: {
    label: '管理员',
    icon: ShieldCheck,
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
    description: '系统最高权限，具备全局管理、配置及用户权限分配能力',
  },
  SALES: {
    label: '业务员',
    icon: Briefcase,
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200 ring-sky-500/20',
    description: '负责入库拼箱实测、运单全景调度、集装箱跟踪及客户档案',
  },
  FINANCE: {
    label: '财务',
    icon: BadgeDollarSign,
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
    description: '负责运单应收应付核算、干线成本审核、收款销账与对账',
  },
  USER: {
    label: '普通用户',
    icon: UserCheck,
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
    description: '外部货主/委托客户账号，仅可查看绑定唛头名下的运单轨迹',
  },
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Customer pool for quick shippingMark picking
  const [customerPool, setCustomerPool] = useState<Customer[]>([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRoleType>('USER');
  const [formShippingMarks, setFormShippingMarks] = useState<string[]>([]);
  const [markInputText, setMarkInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [pagination.page, pagination.limit, roleFilter]);

  useEffect(() => {
    loadCustomerPool();
  }, []);

  const loadCustomerPool = async () => {
    try {
      const res = await customerV2Api.list();
      if (res.data.success) {
        setCustomerPool(res.data.data);
      }
    } catch (e) {
      console.error('加载客户档案唛头池失败:', e);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params: any = {
        search: searchKeyword.trim() || undefined,
        page: pagination.page,
        limit: pagination.limit,
      };
      if (roleFilter !== 'ALL') {
        params.userRole = roleFilter;
      }

      const response = await userApi.list(params);
      setUsers(response.data.data);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('加载用户列表失败:', error);
      toast.error(error.response?.data?.error || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadUsers();
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormPhone('');
    setFormPassword('');
    setFormRole('USER');
    setFormShippingMarks([]);
    setMarkInputText('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.name || '');
    setFormPhone(user.phone || '');
    setFormPassword('');
    setFormRole(user.userRole || 'USER');
    setFormShippingMarks(Array.isArray(user.shippingMarks) ? [...user.shippingMarks] : []);
    setMarkInputText('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setSubmitting(false);
  };

  // Shipping mark helpers
  const handleAddShippingMark = (markToAdd?: string) => {
    const mark = (markToAdd || markInputText).trim().toUpperCase();
    if (!mark) return;
    if (formShippingMarks.includes(mark)) {
      toast.info(`唛头 "${mark}" 已经在关联列表中`);
      setMarkInputText('');
      return;
    }
    setFormShippingMarks((prev) => [...prev, mark]);
    setMarkInputText('');
  };

  const handleRemoveShippingMark = (markToRemove: string) => {
    setFormShippingMarks((prev) => prev.filter((m) => m !== markToRemove));
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('请填写用户姓名');
      return;
    }
    if (!formPhone.trim()) {
      toast.error('请填写登录手机号');
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      toast.error('新增用户时必须填写登录密码');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const updatePayload: any = {
          name: formName.trim(),
          phone: formPhone.trim(),
          userRole: formRole,
        };
        if (formPassword.trim()) {
          updatePayload.password = formPassword.trim();
        }
        if (formRole === 'USER') {
          updatePayload.shippingMarks = formShippingMarks;
        } else {
          updatePayload.shippingMarks = [];
        }

        await userApi.update(editingUser.id, updatePayload);
        toast.success('用户信息已更新');
      } else {
        // Create user
        await userApi.create({
          name: formName.trim(),
          phone: formPhone.trim(),
          password: formPassword.trim(),
          userRole: formRole,
          shippingMarks: formRole === 'USER' ? formShippingMarks : [],
        });
        toast.success('用户创建成功');
      }

      closeModal();
      loadUsers();
    } catch (error: any) {
      console.error('保存用户失败:', error);
      toast.error(error.response?.data?.error || '操作失败，请检查手机号是否已被占用');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`确认删除用户 "${user.name} (${user.phone})"？\n此操作将禁用该登录账号。`)) {
      return;
    }

    try {
      await userApi.delete(user.id);
      toast.success('用户已删除');
      loadUsers();
    } catch (error: any) {
      console.error('删除用户失败:', error);
      toast.error(error.response?.data?.error || '删除用户失败');
    }
  };

  // Quick suggestion list from customer pool (filter out already added)
  const suggestedMarks = useMemo(() => {
    if (formRole !== 'USER') return [];
    return customerPool
      .map((c) => c.clientCode)
      .filter((code) => code && !formShippingMarks.includes(code.toUpperCase()))
      .slice(0, 10);
  }, [customerPool, formShippingMarks, formRole]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-accent-cyan/20 text-primary rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">用户系统管理</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                管理系统各岗位操作账号（管理员/业务员/财务）与普通客户账号，精准配置专属客户唛头
              </p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4" />
            新增系统用户
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 items-center">
            {/* Search input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索姓名、登录手机号或关联唛头..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
              {[
                { id: 'ALL', label: '全部角色' },
                { id: 'ADMIN', label: '管理员' },
                { id: 'SALES', label: '业务员' },
                { id: 'FINANCE', label: '财务' },
                { id: 'USER', label: '普通用户' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRoleFilter(tab.id);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition ${
                    roleFilter === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="w-full md:w-auto px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              查询
            </button>
          </form>
        </div>

        {/* User Table */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">用户姓名</th>
                  <th className="px-6 py-3.5">登录手机号</th>
                  <th className="px-6 py-3.5">系统角色</th>
                  <th className="px-6 py-3.5">关联客户唛头 (普通用户)</th>
                  <th className="px-6 py-3.5">创建时间</th>
                  <th className="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2"></div>
                      <p className="text-xs">加载用户数据中...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      暂无符合条件的用户账号
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const roleCfg = ROLE_CONFIG[u.userRole] || ROLE_CONFIG.USER;
                    const RoleIcon = roleCfg.icon;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold uppercase">
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-mono">{u.phone}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleCfg.badgeCls}`}
                          >
                            <RoleIcon className="w-3.5 h-3.5" />
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.userRole === 'USER' ? (
                            Array.isArray(u.shippingMarks) && u.shippingMarks.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-w-md">
                                {u.shippingMarks.map((mark) => (
                                  <span
                                    key={mark}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    <Tag className="w-3 h-3 mr-1 text-blue-500" />
                                    {mark}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">
                                ⚠️ 未绑定唛头 (无法查单)
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs font-mono">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                          {new Date(u.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="编辑用户"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="删除用户"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div>
                共 <span className="font-semibold text-gray-900">{pagination.total}</span> 条账号记录
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={pagination.limit}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      limit: parseInt(e.target.value),
                      page: 1,
                    }))
                  }
                  className="px-2.5 py-1 border border-gray-300 rounded text-xs outline-none"
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                  <option value={100}>100 条/页</option>
                </select>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    disabled={pagination.page === 1}
                    className="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="px-2 font-mono">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create or Edit User */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  {editingUser ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {editingUser ? '编辑系统用户' : '新增系统用户'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingUser ? `修改账号：${editingUser.phone}` : '创建新的系统操作账号或客户账号'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  用户姓名 / 客户称呼 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="如：张三 / 义乌某某外贸"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  登录手机号 (唯一主账号) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="请输入11位手机号码"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  登录密码{' '}
                  {editingUser ? (
                    <span className="text-gray-400 font-normal">（留空则保持原密码不变）</span>
                  ) : (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '留空表示不修改密码' : '请输入登录密码'}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  系统角色分配 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(ROLE_CONFIG) as UserRoleType[]).map((r) => {
                    const cfg = ROLE_CONFIG[r];
                    const Icon = cfg.icon;
                    const isSelected = formRole === r;

                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormRole(r)}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
                            {cfg.label}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 line-clamp-2 leading-snug">
                          {cfg.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shipping Marks Section: ONLY for USER role */}
              {formRole === 'USER' ? (
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-900">
                      关联客户唛头（可绑定多个）
                    </label>
                    <span className="text-[11px] text-gray-500">
                      已绑定 {formShippingMarks.length} 个
                    </span>
                  </div>

                  {/* Tag Pool */}
                  <div className="min-h-[48px] p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-wrap gap-1.5 items-center">
                    {formShippingMarks.length === 0 ? (
                      <span className="text-xs text-gray-400 px-1">
                        暂未绑定唛头，请在下方输入或快捷选择客户唛头
                      </span>
                    ) : (
                      formShippingMarks.map((mark) => (
                        <span
                          key={mark}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-white text-blue-700 border border-blue-300 shadow-2xs group"
                        >
                          <Tag className="w-3 h-3 text-blue-500" />
                          {mark}
                          <button
                            type="button"
                            onClick={() => handleRemoveShippingMark(mark)}
                            className="text-gray-400 hover:text-rose-500 transition p-0.5 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add Custom Mark Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={markInputText}
                      onChange={(e) => setMarkInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddShippingMark();
                        }
                      }}
                      placeholder="输入唛头编码（如 WH-ZZY-FLB），按回车或点击添加"
                      className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddShippingMark()}
                      disabled={!markInputText.trim()}
                      className="px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      添加
                    </button>
                  </div>

                  {/* Suggestions from Customer Pool */}
                  {suggestedMarks.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-gray-500 font-medium">
                        💡 快捷从客户档案中选择唛头：
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {suggestedMarks.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => handleAddShippingMark(code)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded text-[11px] font-mono transition"
                          >
                            <Plus className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>内部人员角色（管理员/业务员/财务）无需绑定客户唛头，具备系统内视角权限。</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-dark shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? '保存中...' : editingUser ? '保存修改' : '创建用户'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
