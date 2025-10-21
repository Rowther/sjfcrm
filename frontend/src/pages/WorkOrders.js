import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

const WorkOrders = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadWorkOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [workOrders, searchQuery, statusFilter]);

  const loadWorkOrders = async () => {
    try {
      const response = await axios.get('/work-orders');
      setWorkOrders(response.data);
      setFilteredOrders(response.data);
    } catch (error) {
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...workOrders];

    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.request_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      approved: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="work-orders-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-600 mt-1">Manage and track all work orders</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'supervisor') && (
            <Link to="/work-orders/new">
              <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700" data-testid="create-work-order-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Work Order
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <Card className="glass border-0 shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                data-testid="search-work-orders"
                placeholder="Search by ID, title, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="filter-status" className="pl-10">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Work Orders List */}
        {filteredOrders.length === 0 ? (
          <Card className="glass border-0 shadow-md p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No work orders found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first work order to get started'}
              </p>
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <Link to="/work-orders/new">
                  <Button data-testid="create-first-work-order">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Work Order
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Link key={order.id} to={`/work-orders/${order.id}`}>
                <Card className="glass border-0 shadow-md hover:shadow-lg transition-shadow p-6 card-hover" data-testid={`work-order-card-${order.request_id}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">{order.request_id}</span>
                        <span className={`status-badge ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.sla_type === 'urgent' && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                            URGENT
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{order.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{order.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                        <span>📍 {order.location}</span>
                        <span>🛠️ {order.request_type}</span>
                        <span>👤 {order.client_name}</span>
                        {order.assigned_to_name && (
                          <span>⚙️ Assigned to {order.assigned_to_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end gap-2">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ${order.total_cost.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WorkOrders;