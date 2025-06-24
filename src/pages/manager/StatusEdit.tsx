import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, Calendar, User, Users, AlertCircle, Loader } from 'lucide-react';

const StatusEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [status, setStatus] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [formData, setFormData] = useState({
    date: '',
    isLeave: false,
    leaveReason: '',
    responses: []
  });

  // Get auth token from localStorage or your auth context
  const getAuthToken = () => {
    return localStorage.getItem('token') || '';
  };

  // API functions
  const api = {
    getStatus: async (statusId) => {
      const response = await fetch(`/api/status/${statusId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
      
      return await response.json();
    },
    
    getQuestions: async () => {
      const response = await fetch('/api/questions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.statusText}`);
      }
      
      return await response.json();
    },
    
    updateStatus: async (statusId, data) => {
      const response = await fetch(`/api/status/${statusId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update status: ${response.statusText}`);
      }
      
      return await response.json();
    }
  };

  useEffect(() => {
    fetchStatusData();
  }, [id]);

  const fetchStatusData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [statusData, questionsData] = await Promise.all([
        api.getStatus(id),
        api.getQuestions()
      ]);
      
      setStatus(statusData);
      setQuestions(questionsData);
      
      // Initialize form data
      const statusDate = new Date(statusData.date);
      const formattedDate = statusDate.toISOString().split('T')[0];
      
      // Create responses array for all questions
      const allResponses = questionsData.map(question => {
        const existingResponse = statusData.responses?.find(r => 
          r.question._id === question._id || r.question === question._id
        );
        
        return {
          question: question._id,
          answer: existingResponse?.answer || ''
        };
      });
      
      setFormData({
        date: formattedDate,
        isLeave: statusData.isLeave || false,
        leaveReason: statusData.leaveReason || '',
        responses: allResponses
      });
      
    } catch (err) {
      setError(err.message || 'Failed to load status data. Please try again.');
      console.error('Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (success) setSuccess('');
    if (error) setError('');
  };

  const handleResponseChange = (questionId, answer) => {
    setFormData(prev => ({
      ...prev,
      responses: prev.responses.map(r => 
        r.question === questionId 
          ? { ...r, answer }
          : r
      )
    }));
    
    if (success) setSuccess('');
    if (error) setError('');
  };

  const handleLeaveToggle = (isLeave) => {
    setFormData(prev => ({
      ...prev,
      isLeave,
      leaveReason: isLeave ? prev.leaveReason : '',
      responses: isLeave ? [] : prev.responses
    }));
    
    if (success) setSuccess('');
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.date) {
      setError('Date is required');
      return false;
    }
    
    if (formData.isLeave && !formData.leaveReason.trim()) {
      setError('Leave reason is required when marking as leave');
      return false;
    }
    
    if (!formData.isLeave) {
      const emptyResponses = formData.responses.filter(r => !r.answer.trim());
      if (emptyResponses.length > 0) {
        setError('All questions must be answered for status updates');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const updateData = {
        date: formData.date,
        isLeave: formData.isLeave,
        leaveReason: formData.isLeave ? formData.leaveReason : undefined,
        responses: formData.isLeave ? [] : formData.responses.filter(r => r.answer.trim())
      };
      
      await api.updateStatus(id, updateData);
      
      setSuccess('Status updated successfully!');
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/manager/export');
      }, 1000);
      
    } catch (err) {
      setError(err.message || 'Failed to update status. Please try again.');
      console.error('Error updating status:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading status data...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Status not found</p>
          <button
            onClick={() => navigate('/admin/status')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Status List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  title="Go Back"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Edit Status</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Update status for {status.user.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <User size={16} className="text-gray-500" />
                <span className="font-medium">Employee:</span>
                <span>{status.user.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-gray-500" />
                <span className="font-medium">Team:</span>
                <span>{status.team.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="font-medium">Original Date:</span>
                <span>{new Date(status.date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="h-5 w-5 bg-green-600 rounded-full flex items-center justify-center mr-2">
                <span className="text-white text-xs">✓</span>
              </div>
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Edit Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Date Input */}
                {/* <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                    Status Date
                </label>
                <input
                    type="date"
                    id="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
                </div> */}

            {/* Leave Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isLeave"
                checked={formData.isLeave}
                onChange={(e) => handleLeaveToggle(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isLeave" className="text-sm font-medium text-gray-700">
                Mark as Leave
              </label>
            </div>

            {/* Leave Reason */}
            {formData.isLeave && (
              <div>
                <label htmlFor="leaveReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Reason
                </label>
                <input
                  type="text"
                  id="leaveReason"
                  value={formData.leaveReason}
                  onChange={(e) => handleInputChange('leaveReason', e.target.value)}
                  placeholder="Enter reason for leave"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={formData.isLeave}
                />
              </div>
            )}

            {/* Questions and Responses */}
            {!formData.isLeave && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Status Questions</h3>
                {questions.map((question, index) => {
                  const response = formData.responses.find(r => r.question === question._id);
                  return (
                    <div key={question._id} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {index + 1}. {question.text}
                      </label>
                      <textarea
                        value={response?.answer || ''}
                        onChange={(e) => handleResponseChange(question._id, e.target.value)}
                        rows={3}
                        placeholder="Enter your response..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                        required={!formData.isLeave}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={saving}
              >
                <X size={16} className="inline mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {saving ? (
                  <>
                    <Loader size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StatusEdit;