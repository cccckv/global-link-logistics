import { useState, useEffect } from 'react';
import { userApi } from '../lib/api';
import { Search, Plus, Edit, Trash2, X } from 'lucide-react';

interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  userType: 'CUSTOMER' | 'EMPLOYEE';
  userRole: 'ADMIN' | 'USER';
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface CreateUserData {
  name: string;
  phone: string;
  password: string;
  userRole: 'ADMIN' | 'USER';
  email?: string;
}

interface UpdateUserData {
  name?: string;
  phone?: string;
  password?: string;
  userRole?: 'ADMIN' | 'USER';
  email?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    phone: '',
    password: '',
    userRole: 'USER',
    email: '',
  });

  useEffect(() => {
    loadUsers();
  }, [pagination.page, pagination.limit]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userApi.list({
        search: searchKeyword || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      setUsers(response.data.data);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('加载用户列表失败:', error);
      alert(error.response?.data?.error || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    loadUsers();
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      alert('请填写必填字段：用户唛头、手机号、密码');
      return;
    }

    try {
      await userApi.create(formData);
      alert('用户创建成功');
      setShowCreateModal(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('创建用户失败:', error);
      alert(error.response?.data?.error || '创建用户失败');
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;

    const updateData: UpdateUserData = {};
    if (formData.name && formData.name !== editingUser.name) {
      updateData.name = formData.name;
    }
    if (formData.phone && formData.phone !== editingUser.phone) {
      updateData.phone = formData.phone;
    }
    if (formData.email !== undefined && formData.email !== editingUser.email) {
      updateData.email = formData.email || undefined;
    }
    if (formData.userRole !== editingUser.userRole) {
      updateData.userRole = formData.userRole;
    }
    if (formData.password) {
      updateData.password = formData.password;
    }

    if (Object.keys(updateData).length === 0) {
      alert('没有修改任何内容');
      return;
    }

    try {
      await userApi.update(editingUser.id, updateData);
      alert('用户信息已更新');
      setShowEditModal(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('更新用户失败:', error);
      alert(error.response?.data?.error || '更新用户失败');
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`确认删除用户 "${user.name}"？\n此操作不可恢复。`)) {
      return;
    }

    try {
      await userApi.delete(user.id);
      alert('用户已删除');
      loadUsers();
    } catch (error: any) {
      console.error('删除用户失败:', error);
      alert(error.response?.data?.error || '删除用户失败');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      phone: user.phone,
      password: '',
      userRole: user.userRole,
      email: user.email || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      password: '',
      userRole: 'USER',
      email: '',
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    resetForm();
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">用户唛头管理</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              <Plus className="w-5 h-5" />
              新增用户
            </button>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索用户唛头或手机号..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              <Search className="w-5 h-5" />
              查询
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                  <th className="pb-3 font-medium">用户唛头</th>
                  <th className="pb-3 font-medium">手机号</th>
                  <th className="pb-3 font-medium">邮箱</th>
                  <th className="pb-3 font-medium">角色</th>
                  <th className="pb-3 font-medium">创建时间</th>
                  <th className="pb-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 font-medium text-gray-900">{user.name}</td>
                      <td className="py-4 text-gray-600">{user.phone}</td>
                      <td className="py-4 text-gray-600">{user.email || '-'}</td>
                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.userRole === 'ADMIN'
                              ? 'bg-accent-coral/20 text-accent-coral'
                              : 'bg-primary/20 text-primary'
                          }`}
                        >
                          {user.userRole === 'ADMIN' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                共 {pagination.total} 条记录
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={pagination.limit}
                  onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={10}>10条/页</option>
                  <option value={20}>20条/页</option>
                  <option value={50}>50条/页</option>
                  <option value={100}>100条/页</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    上一页
                  </button>
                  <div className="flex items-center px-4 py-2 text-sm text-gray-700">
                    第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {showCreateModal ? '新增用户' : '编辑用户'}
              </h2>
              <button
                onClick={showCreateModal ? closeCreateModal : closeEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用户唛头 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入用户唛头（登录账号）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入手机号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入邮箱（可选）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码 {showEditModal && <span className="text-gray-500 text-xs">（留空则不修改）</span>}
                  {showCreateModal && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={showEditModal ? '留空则不修改密码' : '请输入密码'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.userRole}
                  onChange={(e) => setFormData({ ...formData, userRole: e.target.value as 'ADMIN' | 'USER' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="USER">普通用户</option>
                  <option value="ADMIN">管理员</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  普通用户仅能访问"我的订单"和"外部查询"
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={showCreateModal ? closeCreateModal : closeEditModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleEdit}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
              >
                {showCreateModal ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
