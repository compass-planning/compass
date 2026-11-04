import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Save,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
} from "lucide-react";

interface HostUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
}

const ALL_ROLES = [
  "admin",
  "sales",
  "manager",
  "accounting",
  "service",
  "development",
] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700",
  sales: "bg-violet-50 text-violet-700",
  manager: "bg-purple-50 text-purple-700",
  accounting: "bg-green-50 text-green-700",
  service: "bg-orange-50 text-orange-700",
  development: "bg-violet-50 text-violet-700",
};

export default function HostUsers() {
  const { data: users = [], isLoading } = useQuery<HostUser[]>({
    queryKey: ["/api/crm/host/users"],
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<HostUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<HostUser | null>(null);

  const superAdminId =
    users
      .filter((u) => u.roles.includes("admin"))
      .sort((a, b) => a.id - b.id)[0]?.id ?? null;

  return (
    <HostLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-host-users-title"
            >
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage host portal users and their access.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            data-testid="button-create-host-user"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-background/30">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-display font-bold">
                  {users.length} Users
                </span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSuperAdmin={user.id === superAdminId}
                  onEdit={() => setEditingUser(user)}
                  onSetPassword={() => setPasswordUser(user)}
                />
              ))}
              {users.length === 0 && (
                <div className="px-6 py-12 text-center text-muted-foreground">
                  No host users found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          isSuperAdmin={editingUser.id === superAdminId}
          onClose={() => setEditingUser(null)}
        />
      )}
      {passwordUser && (
        <SetPasswordModal
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
        />
      )}
    </HostLayout>
  );
}

function UserRow({
  user,
  isSuperAdmin,
  onEdit,
  onSetPassword,
}: {
  user: HostUser;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onSetPassword: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crm/host/users/${user.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/users"] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/crm/host/users/${user.id}`, {
        isActive: !user.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/users"] });
    },
  });

  return (
    <div
      className={`px-6 py-4 flex items-center gap-4 ${!user.isActive ? "opacity-60" : ""}`}
      data-testid={`row-host-user-${user.id}`}
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
        {user.firstName[0]}
        {user.lastName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-semibold text-sm"
            data-testid={`text-host-user-name-${user.id}`}
          >
            {user.firstName} {user.lastName}
          </span>
          {isSuperAdmin && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full"
              data-testid={`badge-super-admin-${user.id}`}
            >
              <ShieldAlert className="w-3 h-3" />
              Super Admin
            </span>
          )}
          {!user.isActive && (
            <span
              className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full"
              data-testid={`badge-inactive-${user.id}`}
            >
              Inactive
            </span>
          )}
        </div>
        <p
          className="text-xs text-muted-foreground"
          data-testid={`text-host-user-email-${user.id}`}
        >
          {user.email}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {user.roles.map((r) => (
          <span
            key={r}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full ${ROLE_COLORS[r] ?? "bg-gray-50 text-gray-700"}`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-edit-host-user-${user.id}`}
          title="Edit user"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onSetPassword}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-set-password-host-user-${user.id}`}
          title="Set password"
        >
          <Key className="w-4 h-4" />
        </button>
        {!isSuperAdmin && (
          <>
            <button
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
              className={`p-2 rounded-lg hover:bg-muted transition-colors ${user.isActive ? "text-muted-foreground hover:text-orange-600" : "text-green-600 hover:text-green-700"}`}
              data-testid={`button-toggle-active-host-user-${user.id}`}
              title={user.isActive ? "Deactivate" : "Reactivate"}
            >
              {user.isActive ? (
                <UserX className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    `Are you sure you want to permanently delete ${user.firstName} ${user.lastName}?`,
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
              data-testid={`button-delete-host-user-${user.id}`}
              title="Delete user"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>(["service"]);
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const createUser = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roles,
      };
      if (phone.trim()) payload.phone = phone.trim();
      if (tempPassword.trim()) payload.tempPassword = tempPassword.trim();
      const res = await apiRequest("POST", "/api/crm/host/users", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/users"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create user");
    },
  });

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-create-host-user"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-bold text-lg">Add Host User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted"
            data-testid="button-close-create-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl"
              data-testid="text-create-user-error"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                data-testid="input-create-firstname"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                data-testid="input-create-lastname"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              data-testid="input-create-email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              data-testid="input-create-phone"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Min 6 characters (optional)"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white pr-10"
                data-testid="input-create-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Roles *
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  data-testid={`button-toggle-role-${role}`}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all border ${
                    roles.includes(role)
                      ? `${ROLE_COLORS[role]} border-current`
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
              data-testid="button-cancel-create"
            >
              Cancel
            </button>
            <button
              onClick={() => createUser.mutate()}
              disabled={
                createUser.isPending ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                roles.length === 0
              }
              data-testid="button-submit-create-user"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {createUser.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  isSuperAdmin,
  onClose,
}: {
  user: HostUser;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [roles, setRoles] = useState<string[]>([...user.roles]);
  const [error, setError] = useState("");

  const updateUser = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/crm/host/users/${user.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        roles,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/me"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update user");
    },
  });

  const toggleRole = (role: string) => {
    if (isSuperAdmin && role === "admin") return;
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-edit-host-user"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Edit User</h2>
              {isSuperAdmin && (
                <p className="text-xs text-amber-600 font-medium">
                  Primary super-admin — admin role is locked
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted"
            data-testid="button-close-edit-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl"
              data-testid="text-edit-user-error"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                data-testid="input-edit-firstname"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                data-testid="input-edit-lastname"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              data-testid="input-edit-phone"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const locked = isSuperAdmin && role === "admin";
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    disabled={locked}
                    data-testid={`button-edit-toggle-role-${role}`}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all border ${
                      roles.includes(role)
                        ? `${ROLE_COLORS[role]} border-current ${locked ? "cursor-not-allowed" : ""}`
                        : "bg-gray-50 text-gray-400 border-gray-200"
                    } ${locked ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {locked && <Shield className="w-3 h-3 inline mr-1" />}
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
              data-testid="button-cancel-edit"
            >
              Cancel
            </button>
            <button
              onClick={() => updateUser.mutate()}
              disabled={
                updateUser.isPending ||
                !firstName.trim() ||
                !lastName.trim() ||
                roles.length === 0
              }
              data-testid="button-submit-edit-user"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetPasswordModal({
  user,
  onClose,
}: {
  user: HostUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/crm/host/users/${user.id}/set-password`,
        { password },
      );
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setPassword("");
      setTimeout(() => onClose(), 1500);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to set password");
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-set-password"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Set Password</h2>
              <p className="text-sm text-muted-foreground">
                {user.firstName} {user.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted"
            data-testid="button-close-password-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl"
              data-testid="text-set-password-error"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2"
              data-testid="text-set-password-success"
            >
              <ShieldCheck className="w-4 h-4" />
              Password set successfully!
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white pr-10"
                data-testid="input-set-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
              data-testid="button-cancel-set-password"
            >
              Cancel
            </button>
            <button
              onClick={() => setPasswordMutation.mutate()}
              disabled={setPasswordMutation.isPending || password.length < 6}
              data-testid="button-submit-set-password"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Key className="w-4 h-4" />
              {setPasswordMutation.isPending ? "Setting..." : "Set Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
