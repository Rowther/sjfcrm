import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Plus,
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, workOrdersRes] = await Promise.all([
        axios.get('/dashboard/stats'),
        axios.get('/work-orders')
      ]);
      setStats(statsRes.data);
      setRecentWorkOrders(workOrdersRes.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="space-y-6" data-testid="dashboard-page">
        {/* Welcome Section */}
        <div className="glass rounded-xl p-6 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600 mt-1">Here's what's happening with your work orders today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass border-0 shadow-md hover:shadow-lg transition-shadow" data-testid="stat-total-orders">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats?.total_orders || 0}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="glass border-0 shadow-md hover:shadow-lg transition-shadow" data-testid="stat-in-progress">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
              <Clock className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats?.in_progress || 0}</div>
              <p className="text-xs text-gray-500 mt-1">{stats?.pending || 0} pending</p>
            </CardContent>
          </Card>

          <Card className="glass border-0 shadow-md hover:shadow-lg transition-shadow" data-testid="stat-completed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {(stats?.completed || 0) + (stats?.approved || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{stats?.completion_rate || 0}% completion rate</p>
            </CardContent>
          </Card>

          <Card className="glass border-0 shadow-md hover:shadow-lg transition-shadow" data-testid="stat-total-cost">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Cost</CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                ${(stats?.total_cost || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">All projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {(user?.role === 'admin' || user?.role === 'supervisor') && (
          <Card className="glass border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link to="/work-orders/new">
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700" data-testid="create-work-order-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Work Order
                  </Button>
                </Link>
                <Link to="/work-orders">
                  <Button variant="outline" data-testid="view-all-orders-button">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    View All Orders
                  </Button>
                </Link>
                <Link to="/reports">
                  <Button variant="outline" data-testid="view-reports-button">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Reports
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Work Orders */}
        <Card className="glass border-0 shadow-md">
          <CardHeader>
            <CardTitle>Recent Work Orders</CardTitle>
            <CardDescription>Your latest work order activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentWorkOrders.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No work orders yet</p>
                {(user?.role === 'admin' || user?.role === 'supervisor') && (
                  <Link to="/work-orders/new">
                    <Button className="mt-4" data-testid="create-first-order-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Work Order
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {recentWorkOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/work-orders/${order.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all" data-testid={`work-order-${order.request_id}`}>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-semibold text-gray-900">{order.request_id}</span>
                          <span className={`status-badge ${getStatusColor(order.status)}`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{order.title}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>{order.location}</span>
                          <span>•</span>
                          <span>{order.request_type}</span>
                          {order.assigned_to_name && (
                            <>
                              <span>•</span>
                              <span>Assigned to {order.assigned_to_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          ${order.total_cost.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                <Link to="/work-orders">
                  <Button variant="outline" className="w-full" data-testid="view-all-orders-link">
                    View All Work Orders
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;