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
  }, [profile?.id, profile?.full_name, profile?.phone, user?.email]);

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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border bg-muted">
            <CardTitle className="flex items-center text-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <span>Personal Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Full Name</Label>
                <Input
                  value={profileData.full_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    value={profileData.email}
                    disabled
                    className="h-11 pl-11 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                    placeholder="+1 234 567 8900"
                    className="h-11 pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Role</Label>
                <div className="h-11 flex items-center">
                  <Badge
                    className={`text-sm px-4 py-2 ${
                      profile.role === 'ADMIN'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : profile.role === 'MANAGER'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : profile.role === 'SALES_REP'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-gray-100 text-gray-800 border-border'
                    }`}
                  >
                    {profile.role}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleUpdateProfile} disabled={loading} className="px-6">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border bg-muted">
            <CardTitle className="flex items-center text-lg">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mr-3">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {profile.password_change_required && (
              <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm font-medium text-amber-800">
                    You are required to change your password
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">New Password</Label>
              <Input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                placeholder="Enter new password"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Confirm new password"
                className="h-11"
              />
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={loading} className="px-6">
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border bg-muted">
            <CardTitle className="flex items-center text-lg">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <span>Google Calendar Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-5 border-2 border-border rounded-xl bg-card hover:border-muted-foreground transition-colors">
              <div className="flex items-center gap-4">
                {profile.google_calendar_connected ? (
                  <>
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Connected</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Your Google Calendar is connected
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <XCircle className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Not Connected</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
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
                  className="flex-shrink-0"
                >
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handleConnectGoogleCalendar} disabled={loading} className="flex-shrink-0">
                  Connect Calendar
                </Button>
              )}
            </div>

            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-blue-800">
                  When you connect Google Calendar, tasks and events you create in the CRM
                  will automatically appear in your Google Calendar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
