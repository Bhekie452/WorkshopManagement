import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Mail, CheckCircle, AlertCircle, Lock, User } from 'lucide-react';

interface InvitationDetails {
  valid: boolean;
  email?: string;
  role?: string;
  company_id?: string;
  expires_at?: string;
  message?: string;
}

const AcceptInvitation: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setInvitation({ valid: false, message: 'Invalid invitation link' });
      setValidating(false);
      return;
    }

    try {
      const response = await fetch(`/api/invitations/validate/${token}`);
      const data: InvitationDetails = await response.json();
      
      setInvitation(data);
    } catch (error) {
      console.error('Error validating token:', error);
      setInvitation({ valid: false, message: 'Error validating invitation' });
    } finally {
      setValidating(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    setAccepting(true);
    setError('');

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          name: formData.name,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login?message=Account created successfully. Please log in.');
        }, 2000);
      } else {
        setError(data.message || 'Failed to create account');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Error creating account. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // Validating
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  // Invalid invitation
  if (!invitation?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Invitation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {invitation?.message || 'This invitation is invalid or has expired.'}
          </p>
          <Button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Account Created!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account has been successfully created. You'll be redirected to the login page.
          </p>
          <div className="animate-spin inline-block w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  // Invitation form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-blue-100 dark:bg-blue-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Your Account
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
            Welcome to your new team!
          </p>
        </div>

        {/* Invitation Details */}
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Email:</span>
              <span className="font-semibold text-gray-900 dark:text-white ml-2">
                {invitation?.email}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Role:</span>
              <span className="font-semibold text-gray-900 dark:text-white ml-2">
                {invitation?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-800 dark:text-red-100 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline-block mr-2" />
              Full Name
            </label>
            <Input
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) {
                  setFormErrors({ ...formErrors, name: '' });
                }
              }}
              disabled={accepting}
              className={formErrors.name ? 'border-red-500' : ''}
            />
            {formErrors.name && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {formErrors.name}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Lock className="w-4 h-4 inline-block mr-2" />
              Password
            </label>
            <Input
              type="password"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (formErrors.password) {
                  setFormErrors({ ...formErrors, password: '' });
                }
              }}
              disabled={accepting}
              className={formErrors.password ? 'border-red-500' : ''}
            />
            {formErrors.password && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {formErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Lock className="w-4 h-4 inline-block mr-2" />
              Confirm Password
            </label>
            <Input
              type="password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                if (formErrors.confirmPassword) {
                  setFormErrors({ ...formErrors, confirmPassword: '' });
                }
              }}
              disabled={accepting}
              className={formErrors.confirmPassword ? 'border-red-500' : ''}
            />
            {formErrors.confirmPassword && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {formErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={accepting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {accepting ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
};

export default AcceptInvitation;
