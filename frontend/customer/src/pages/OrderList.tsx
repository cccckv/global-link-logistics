import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { quickOrderApi, type QuickOrder, type QuickOrderStatus, type QuickOrderType } from '../lib/api';
import { Package, Search, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

type TabKey = 'all' | 'pending' | 'approved' | 'fcl_pending' | 'fcl_approved' | 'loading' | 'containerized' | 'receiving' | 'completed';
type SearchType = 'warehouseNumber' | 'orderNumber' | 'trackingNumber' | 'productName';

const searchTypeLabels: Record<SearchType, string> = {
  warehouseNumber: '入仓单号',
  orderNumber: '订单号',
  trackingNumber: '快递单号',
  productName: '产品名称',
};

const tabStatusMap: Record<TabKey, QuickOrderStatus | QuickOrderType | undefined> = {
  all: undefined,
  pending: 'PENDING',
  approved: 'CONFIRMED',
  fcl_pending: 'PENDING',
  fcl_approved: 'CONFIRMED',
  loading: 'IN_TRANSIT',
  containerized: 'IN_TRANSIT',
  receiving: 'DELIVERED',
  completed: 'DELIVERED',
};

export default function OrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<QuickOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const searchTypeRef = useRef<HTMLDivElement>(null);
  
  const [searchType, setSearchType] = useState<SearchType>('warehouseNumber');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [markKeyword, setMarkKeyword] = useState('');
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    confirmed: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, [activeTab, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchTypeRef.current && !searchTypeRef.current.contains(event.target as Node)) {
        setShowSearchTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      const tabStatus = tabStatusMap[activeTab];
      if (tabStatus) {
        params.status = tabStatus;
      }

      if (activeTab === 'fcl_pending' || activeTab === 'fcl_approved') {
        params.orderType = 'SEA_FCL';
      }

      const response = await quickOrderApi.getList(params);
      setOrders(response.data.data || []);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const response = await quickOrderApi.getCounts();
      setCounts(response.data);
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: 1,
        limit: pagination.limit,
      };

      if (markKeyword.trim()) {
        params.mark = markKeyword.trim();
      }

      if (searchKeyword.trim()) {
        params.searchType = searchType;
        params.keyword = searchKeyword.trim();
      }

      const response = await quickOrderApi.getList(params);
      setOrders(response.data.data || []);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(orders.map(o => o.orderId)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleRowClick = (orderId: string) => {
    navigate(`/order/${orderId}`);
  };

  const handleExport = () => {
    alert('导出Excel功能开发中');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      page: 1,
    }));
  };

  const getStatusLabel = (status: QuickOrderStatus) => {
    const labels: Record<QuickOrderStatus, string> = {
      PENDING: '待入库',
      CONFIRMED: '待装柜',
      IN_TRANSIT: '运输中',
      DELIVERED: '已完成',
      CANCELLED: '已取消',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: QuickOrderStatus) => {
    const colors: Record<QuickOrderStatus, string> = {
      PENDING: 'text-yellow-600 bg-yellow-50',
      CONFIRMED: 'text-blue-600 bg-blue-50',
      IN_TRANSIT: 'text-purple-600 bg-purple-50',
      DELIVERED: 'text-green-600 bg-green-50',
      CANCELLED: 'text-red-600 bg-red-50',
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const getTypeLabel = (type: QuickOrderType) => {
    const labels: Record<QuickOrderType, string> = {
      SEA_LCL: '拼柜海运',
      SEA_FCL: '整柜海运',
      AIR: '空运快递',
      LAND: '陆运',
      PARCEL: '快递',
      BATCH: '批量',
    };
    return labels[type] || type;
  };

  const calculateWeight = (order: QuickOrder): string => {
    if (!order.declarations || order.declarations.length === 0) return '-';
    const total = order.declarations.reduce((sum, d) => sum + (d.weight || 0), 0);
    return total.toFixed(2) + 'kg';
  };

  const calculateVolume = (order: QuickOrder): string => {
    if (!order.declarations || order.declarations.length === 0) return '-';
    const total = order.declarations.reduce((sum, d) => {
      const length = d.length || 0;
      const width = d.width || 0;
      const height = d.height || 0;
      return sum + (length * width * height / 1000000);
    }, 0);
    return total.toFixed(3) + 'm³';
  };

  const getTabCount = (tab: TabKey): number => {
    switch (tab) {
      case 'all':
        return counts.all;
      case 'pending':
        return counts.pending;
      case 'approved':
        return 0;
      case 'fcl_pending':
        return 0;
      case 'fcl_approved':
        return 0;
      case 'loading':
        return 0;
      case 'containerized':
        return counts.confirmed;
      case 'receiving':
        return counts.inTransit;
      case 'completed':
        return counts.delivered;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">运单管理</h1>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="请输入搜索唛头"
              value={markKeyword}
              onChange={(e) => setMarkKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-48 text-sm"
            />
            
            <div className="relative flex items-center border border-gray-300 rounded-md bg-white">
              <input
                type="text"
                placeholder="请输入搜索关键词"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 border-0 focus:outline-none rounded-l-md w-64 text-sm"
              />
              <div className="h-8 w-px bg-gray-300"></div>
              <div ref={searchTypeRef} className="relative">
                <button
                  onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors min-w-[100px]"
                >
                  <span className="text-sm text-gray-700">{searchTypeLabels[searchType]}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showSearchTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showSearchTypeDropdown && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    {(Object.keys(searchTypeLabels) as SearchType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setSearchType(type);
                          setShowSearchTypeDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          searchType === type ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
                        }`}
                      >
                        {searchTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-colors font-medium text-sm shadow-sm"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              导出Excel
            </button>
          </div>

          <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
            <TabButton
              active={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              label={`全部(${getTabCount('all')})`}
            />
            <TabButton
              active={activeTab === 'pending'}
              onClick={() => setActiveTab('pending')}
              label={`待入库(${getTabCount('pending')})`}
            />
            <TabButton
              active={activeTab === 'approved'}
              onClick={() => setActiveTab('approved')}
              label={`申请出库(${getTabCount('approved')})`}
            />
            <TabButton
              active={activeTab === 'fcl_pending'}
              onClick={() => setActiveTab('fcl_pending')}
              label={`整柜待审核(${getTabCount('fcl_pending')})`}
            />
            <TabButton
              active={activeTab === 'fcl_approved'}
              onClick={() => setActiveTab('fcl_approved')}
              label={`整柜待提箱(${getTabCount('fcl_approved')})`}
            />
            <TabButton
              active={activeTab === 'loading'}
              onClick={() => setActiveTab('loading')}
              label={`待装车(${getTabCount('loading')})`}
            />
            <TabButton
              active={activeTab === 'containerized'}
              onClick={() => setActiveTab('containerized')}
              label={`待装柜(${getTabCount('containerized')})`}
            />
            <TabButton
              active={activeTab === 'receiving'}
              onClick={() => setActiveTab('receiving')}
              label={`待签收(${getTabCount('receiving')})`}
            />
            <TabButton
              active={activeTab === 'completed'}
              onClick={() => setActiveTab('completed')}
              label={`已完成(${getTabCount('completed')})`}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedOrders.size === orders.length && orders.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">唛头</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入仓单号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递数量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订柜箱型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">重量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">体积</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">仓库</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目的地</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运输方式</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">下单时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr
                        key={order.orderId}
                        onClick={() => handleRowClick(order.orderId)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.orderId)}
                            onChange={(e) => handleSelectOrder(order.orderId, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order.userMark || order.mark || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                          {order.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.declarations?.[0]?.productName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.declarations?.filter(d => d.trackingNumber).length > 0
                            ? `${order.declarations.filter(d => d.trackingNumber).length}个`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.containers?.[0]?.containerType || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {calculateWeight(order)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {calculateVolume(order)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.warehouse || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.destination}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getTypeLabel(order.orderType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getTypeLabel(order.orderType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/order/${order.orderId}`);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无订单</h3>
                  <p className="mt-1 text-sm text-gray-500">尝试调整搜索条件或筛选器</p>
                </div>
              )}
            </div>

            {orders.length > 0 && (
              <div className="bg-white mt-4 px-6 py-4 flex items-center justify-between rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    共 <span className="font-semibold text-gray-900">{pagination.total}</span> 条
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">每页</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handleLimitChange(Number(e.target.value))}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-600">条</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                    <span className="text-sm text-gray-600">第</span>
                    <span className="text-sm font-semibold text-primary min-w-[20px] text-center">{pagination.page}</span>
                    <span className="text-sm text-gray-600">/</span>
                    <span className="text-sm text-gray-900">{pagination.totalPages}</span>
                    <span className="text-sm text-gray-600">页</span>
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-600 hover:text-primary hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
