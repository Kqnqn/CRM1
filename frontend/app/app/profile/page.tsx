'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, CheckCircle2, XCircle, User, Lock, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  useEffect(() => {
    if (profile && user) {
      setProfileData({
        full_name: profile.full_name || '',
        email: user.email || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, user]);

  const handleUpdateProfile = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
      });

      refreshProfile();
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.new || !passwords.confirm) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all password fields',
        variant: 'destructive',
      });
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast({
        title: 'Validation error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (passwords.new.length < 8) {
      toast({
        title: 'Validation error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      });

      if (error) throw error;

      if (profile?.password_change_required) {
        await supabase
          .from('profiles')
          .update({ password_change_required: false })
          .eq('id', profile.id);
      }

      toast({
        title: 'Password changed',
        description: 'Your password has been changed successfully',
      });

      setPasswords({ current: '', new: '', confirm: '' });
      refreshProfile();
    } catch (error: any) {
      toast({
        title: 'Password change failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleCalendar = () => {
    toast({
      title: 'Coming soon',
      description: 'Google Calendar integration will be available soon',
    });
  };

  const handleDisconnectGoogleCalendar = async () => {
    if (!profile) return;

    if (!confirm('Are you sure you want to disconnect your Google Calendar?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          google_calendar_connected: false,
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'Calendar disconnected',
        description: 'Your Google Calendar has been disconnected',
      });

      refreshProfile();
    } catch (error: any) {
      toast({
        title: 'Disconnect failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={profileData.full_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <Input value={profileData.email} disabled className="flex-1" />
                </div>
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <Input
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                    placeholder="+1 234 567 8900"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      profile.role === 'ADMIN'
                        ? 'bg-red-100 text-red-800'
                        : profile.role === 'MANAGER'
                        ? 'bg-blue-100 text-blue-800'
                        : profile.role === 'SALES_REP'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {profile.role}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleUpdateProfile} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.password_change_required && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">
                  You are required to change your password
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                placeholder="Enter new password"
              />
              <p className="text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleChangePassword} disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Google Calendar Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {profile.google_calendar_connected ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Connected</p>
                      <p className="text-sm text-gray-600">
                        Your Google Calendar is connected
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">Not Connected</p>
                      <p className="text-sm text-gray-600">
                        Connect your Google Calendar to sync tasks and events
                      </p>
                    </div>
                  </>
                )}
              </div>

              {profile.google_calendar_connected ? (
                <Button
                  variant="outline"
                  onClick={handleDisconnectGoogleCalendar}
                  disabled={loading}
                >
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handleConnectGoogleCalendar} disabled={loading}>
                  Connect Calendar
                </Button>
              )}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                When you connect Google Calendar, tasks and events you create in the CRM
                will automatically appear in your Google Calendar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
