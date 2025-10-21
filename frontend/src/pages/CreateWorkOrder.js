import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const CreateWorkOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    request_type: 'MEP',
    sla_type: 'normal',
    location: '',
    department: '',
    client_id: '',
    assigned_to_id: '',
    start_date: '',
    due_date: '',
    duration_days: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await axios.get('/users');
      setClients(response.data.filter(u => u.role === 'client'));
      setTechnicians(response.data.filter(u => u.role === 'technician'));
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { ...formData };
      if (!payload.assigned_to_id) delete payload.assigned_to_id;
      if (!payload.start_date) delete payload.start_date;
      if (!payload.due_date) delete payload.due_date;
      if (!payload.duration_days) delete payload.duration_days;
      else payload.duration_days = parseInt(payload.duration_days);

      await axios.post('/work-orders', payload);
      toast.success('Work order created successfully!');
      navigate('/work-orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create work order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="create-work-order-page">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/work-orders')} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <Card className="glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Work Order</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    data-testid="wo-title-input"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="e.g., HVAC System Maintenance"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    data-testid="wo-location-input"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Building A, Floor 3"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  data-testid="wo-description-input"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  placeholder="Describe the work order in detail..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="request_type">Request Type *</Label>
                  <Select
                    value={formData.request_type}
                    onValueChange={(value) => setFormData({ ...formData, request_type: value })}
                  >
                    <SelectTrigger data-testid="wo-request-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEP">MEP</SelectItem>
                      <SelectItem value="Civil">Civil</SelectItem>
                      <SelectItem value="Plumbing">Plumbing</SelectItem>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="HVAC">HVAC</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sla_type">Priority *</Label>
                  <Select
                    value={formData.sla_type}
                    onValueChange={(value) => setFormData({ ...formData, sla_type: value })}
                  >
                    <SelectTrigger data-testid="wo-sla-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="client_id">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger data-testid="wo-client-select">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="assigned_to_id">Assign to Technician</Label>
                  <Select
                    value={formData.assigned_to_id || undefined}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to_id: value })}
                  >
                    <SelectTrigger data-testid="wo-technician-select">
                      <SelectValue placeholder="Select technician (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    data-testid="wo-start-date-input"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    data-testid="wo-due-date-input"
                    name="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <Label htmlFor="duration_days">Duration (Days)</Label>
                  <Input
                    id="duration_days"
                    data-testid="wo-duration-input"
                    name="duration_days"
                    type="number"
                    min="1"
                    value={formData.duration_days}
                    onChange={handleChange}
                    placeholder="e.g., 7"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  data-testid="wo-department-input"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Facilities Management"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/work-orders')}
                  data-testid="cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  disabled={loading}
                  data-testid="submit-button"
                >
                  {loading ? 'Creating...' : 'Create Work Order'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateWorkOrder;