import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { ApiCall } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Mail, UserPlus, Trash2, Clock, CheckCircle } from 'lucide-react';

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

interface InvitationResponse {
  invitations: PendingInvitation[];
  total: number;
}

const UserInvitations: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'TECHNICIAN'
  });
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check authorization
  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (isAuthorized) {
      loadInvitations();
    }
  }, [isAuthorized]);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const data = await ApiCall.get<InvitationResponse>('/admin/users/invitations');
      setInvitations(data.invitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        setInviteError('Unable to connect to server. Please ensure the backend API is running.');
      } else if (error instanceof Error) {
        setInviteError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const data = await ApiCall.post<any>('/admin/users/invite', {
        email: inviteFormData.email,
        role: inviteFormData.role
      });

      if (data.success) {
        setInviteSuccess(`Invitation sent to ${inviteFormData.email}`);
        setInviteFormData({ email: '', role: 'TECHNICIAN' });
        setShowInviteModal(false);
        
        // Reload invitations
        await loadInvitations();
        
        setTimeout(() => setInviteSuccess(''), 3000);
      } else {
        setInviteError(data.detail || 'Failed to send invitation');
      }
    } catch (error) {
      setInviteError('Error sending invitation. Please try again.');
      console.error('Error:', error);
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    setDeleting(true);
    try {
      await ApiCall.delete(`/admin/users/invitations/${invitationId}`);
      // Remove from list
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting invitation:', error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'ADMIN': 'bg-red-100 text-red-800',
      'MANAGER': 'bg-blue-100 text-blue-800',
      'TECHNICIAN': 'bg-green-100 text-green-800',
      'RECEPTIONIST': 'bg-purple-100 text-purple-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (isExpired: boolean) => {
    if (isExpired) {
      return <Badge>(Expired)</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">(Pending)</Badge>;
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can manage user invitations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            <Mail className="inline-block w-8 h-8 mr-2" />
            User Invitations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Invite new team members to join your company
          </p>
        </div>
        <Button
          onClick={() => setShowInviteModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2 inline-block" />
          Invite User
        </Button>
      </div>

      {/* Success Message */}
      {inviteSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-100">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {inviteSuccess}
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteError('');
          setInviteFormData({ email: '', role: 'TECHNICIAN' });
        }}
        title="Invite New User"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {inviteError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-100">
              {inviteError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={inviteFormData.email}
              onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
              required
              disabled={inviting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <Select
              value={inviteFormData.role}
              onChange={(e) => setInviteFormData({ ...inviteFormData, role: e.target.value })}
              disabled={inviting}
              options={[
                { value: 'TECHNICIAN', label: 'Technician' },
                { value: 'MANAGER', label: 'Manager' },
                { value: 'RECEPTIONIST', label: 'Receptionist' },
                { value: 'ADMIN', label: 'Admin' },
              ]}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={inviting || !inviteFormData.email}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
            <Button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
              disabled={inviting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Cancel Invitation"
        message="Are you sure you want to cancel this invitation?"
        confirmText="Cancel Invitation"
        cancelText="Keep Invitation"
        onConfirm={() => {
          if (deleteConfirm) {
            handleDeleteInvitation(deleteConfirm);
          }
        }}
        onClose={() => setDeleteConfirm(null)}
        variant="danger"
      />

      {/* Loading */}
      {loading && <LoadingSpinner />}

      {/* Empty State */}
      {!loading && invitations.length === 0 && (
        <EmptyState
          title="No Pending Invitations"
          description="You haven't sent any invitations yet. Click 'Invite User' to get started."
          icon={<Mail className="w-12 h-12" />}
        />
      )}

      {/* Invitations Table */}
      {!loading && invitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                      invitation.is_expired ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(invitation.role)}`}>
                        {invitation.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <div>
                          <div>{formatDate(invitation.created_at)}</div>
                          <div className="text-xs text-gray-500">{formatTime(invitation.created_at)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(invitation.expires_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(invitation.is_expired)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button
                        onClick={() => setDeleteConfirm(invitation.id)}
                        disabled={deleting}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200 text-xs font-medium transition disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && invitations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-100">
            <strong>{invitations.filter(i => !i.is_expired).length}</strong> active invitation{invitations.filter(i => !i.is_expired).length !== 1 ? 's' : ''} • 
            <strong className="ml-2">{invitations.filter(i => i.is_expired).length}</strong> expired invitation{invitations.filter(i => i.is_expired).length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default UserInvitations;
