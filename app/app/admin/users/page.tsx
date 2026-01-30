'use client';

import { useEffect, useState } from 'react';
import { supabase, Profile, UserRole } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { canManageUsers } from '@/lib/auth/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface UserWithProfile extends Profile {
  last_sign_in_at?: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'SALES_REP' as UserRole,
    phone: '',
    password: '',
  });
  const [resetPassword, setResetPassword] = useState('');
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (profile && !canManageUsers(profile.role)) {
      router.push('/app');
      toast({
        title: 'Access denied',
        description: 'You do not have permission to access this page',
        variant: 'destructive',
      });
      return;
    }

    fetchUsers();
  }, [profile]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setUsers(data);
    setLoading(false);
  };

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.full_name) {
      toast({
        title: 'Validation error',
        description: 'Email and full name are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const tempPassword = newUser.password || generatePassword();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: tempPassword,
        options: {
          data: {
            full_name: newUser.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase
          .from('profiles')
          .update({
            role: newUser.role,
            phone: newUser.phone,
            password_change_required: true,
          })
          .eq('id', authData.user.id);

        await supabase.from('user_invitations').insert({
          email: newUser.email,
          role: newUser.role,
          invited_by: user?.id,
          status: 'ACCEPTED',
          temp_password: tempPassword,
        });
      }

      toast({
        title: 'User created',
        description: `User created successfully. Temporary password: ${tempPassword}`,
        duration: 10000,
      });

      setShowCreateDialog(false);
      setNewUser({
        email: '',
        full_name: '',
        role: 'SALES_REP',
        phone: '',
        password: '',
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Failed to create user',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !resetPassword) {
      toast({
        title: 'Validation error',
        description: 'Password is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(selectedUser.id, {
        password: resetPassword,
      });

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ password_change_required: true })
        .eq('id', selectedUser.id);

      toast({
        title: 'Password reset',
        description: 'User password has been reset successfully',
      });

      setShowResetPasswordDialog(false);
      setResetPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: 'Failed to reset password',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      await supabase.from('profiles').delete().eq('id', userId);

      toast({
        title: 'User deleted',
        description: 'User has been deleted successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Failed to delete user',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'SALES_REP':
        return 'bg-green-100 text-green-800';
      case 'READ_ONLY':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!profile || !canManageUsers(profile.role)) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(u.role)}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>{u.phone || '-'}</TableCell>
                    <TableCell>
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(u);
                            setShowResetPasswordDialog(true);
                          }}
                          title="Reset password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        {u.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(u.id)}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                  <SelectItem value="READ_ONLY">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label>Temporary Password (leave blank to auto-generate)</Label>
              <Input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Auto-generate secure password"
              />
              <p className="text-xs text-gray-500">
                User will be required to change password on first login
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>Create User</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reset password for {selectedUser?.full_name} ({selectedUser?.email})
            </p>

            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetPassword(generatePassword())}
              >
                Generate Password
              </Button>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetPasswordDialog(false);
                  setResetPassword('');
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword}>Reset Password</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
