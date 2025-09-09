'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Loader2, UserPlus, Mail, Crown, Shield, User, MoreHorizontal, Trash2 } from 'lucide-react';
import { z } from 'zod';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim(),
  role: z.enum(['admin', 'member'], { required_error: 'Please select a role' }),
});

// Types
interface OrganizationMember {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
}

interface MembersManagementSectionProps {
  disabled?: boolean;
}

export default function MembersManagementSection({ disabled = false }: MembersManagementSectionProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteError, setInviteError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });
  const { toast } = useToast();

  // Fetch members and invitations
  useEffect(() => {
    fetchMembersAndInvitations();
  }, []);

  const fetchMembersAndInvitations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/members');
      
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const result = await response.json();
      
      if (result.success) {
        setMembers(result.data.members || []);
        setInvitations(result.data.invitations || []);
      } else {
        throw new Error(result.error || 'Failed to fetch members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateInvite = () => {
    try {
      inviteSchema.parse({ email: inviteEmail, role: inviteRole });
      setInviteError('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setInviteError(error.errors[0]?.message || 'Invalid input');
      }
      return false;
    }
  };

  const handleInviteMember = async () => {
    if (!validateInvite()) {
      return;
    }

    try {
      setInviting(true);
      const response = await fetch('/api/settings/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite member');
      }

      if (result.success) {
        toast({
          title: 'Success',
          description: `Invitation sent to ${inviteEmail}`,
        });
        setShowInviteForm(false);
        setInviteEmail('');
        setInviteRole('member');
        setInviteError('');
        await fetchMembersAndInvitations();
      } else {
        throw new Error(result.error || 'Failed to invite member');
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite member',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const response = await fetch('/api/settings/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          role: newRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update member role');
      }

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Member role updated successfully',
        });
        await fetchMembersAndInvitations();
      } else {
        throw new Error(result.error || 'Failed to update member role');
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update member role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch('/api/settings/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove member');
      }

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Member removed successfully',
        });
        await fetchMembersAndInvitations();
      } else {
        throw new Error(result.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default' as const;
      case 'admin':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const canManageRole = (memberRole: string) => {
    // Only owners and admins can manage roles, but owners cannot be managed
    return memberRole !== 'owner';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Invite and manage team members and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" role="status" aria-label="Loading members" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Invite and manage team members and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Members */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Current Members ({members.length})</h4>
              <Button
                onClick={() => setShowInviteForm(true)}
                size="sm"
                disabled={disabled}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No team members yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(member.role)}
                        <div>
                          <p className="text-sm font-medium">
                            {member.full_name || member.email}
                          </p>
                          {member.full_name && (
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                      {canManageRole(member.role) && !disabled && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.role !== 'admin' && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateRole(member.id, 'admin')}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {member.role !== 'member' && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateRole(member.id, 'member')}
                              >
                                <User className="h-4 w-4 mr-2" />
                                Make Member
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  title: 'Remove Member',
                                  description: `Are you sure you want to remove ${member.full_name || member.email} from the organization? This action cannot be undone.`,
                                  action: () => handleRemoveMember(member.id),
                                })
                              }
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Pending Invitations ({invitations.length})</h4>
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {new Date(invitation.created_at).toLocaleDateString()}
                          {invitation.invited_by_name && ` by ${invitation.invited_by_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{invitation.role}</Badge>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Form */}
          {showInviteForm && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Invite New Member</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                    setInviteRole('member');
                    setInviteError('');
                  }}
                  disabled={inviting}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteError('');
                    }}
                    className={inviteError ? 'border-destructive' : ''}
                    disabled={inviting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}
                    disabled={inviting}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteError && (
                  <p className="text-sm text-destructive">{inviteError}</p>
                )}
                <Button
                  onClick={handleInviteMember}
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending Invitation...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={() => {
          confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        variant="destructive"
      />
    </>
  );
}