import { useState } from "react";
import { HouseholdQueue } from "@/components/HouseholdQueue";
import { useSearch, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useClients } from "@/hooks/use-clients";
import { useStaffMembers, useStaffMember, useCurrentStaff } from "@/hooks/use-users";
import type { Client, UserRole } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

const _maritalLabels: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
  common_law: "Common Law",
  separated: "Separated",
};

const _contactLabels: Record<string, string> = {
  email: "Personal Email",
  phone: "Home Phone",
  cell: "Cell Phone",
  work_email: "Work Email",
  work_phone: "Work Phone",
};

const _pensionLabels: Record<string, string> = {
  defined_benefit: "Defined Benefit Pension",
  defined_contribution: "Defined Contribution Pension",
  non_contributory: "Non-Contributory Pension",
  rrsp_matching: "RRSP Matching",
  none: "No Pension Plan",
};

const managerRoles: UserRole[] = ["general_manager", "office_admin", "sales_manager"];

export default function Clients() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const advisorIdParam = params.get("advisorId");
  const advisorId = advisorIdParam ? Number(advisorIdParam) : null;

  const { data: allClients, isLoading: allLoading } = useClients();
  const { data: advisorClients, isLoading: advisorLoading } = useQuery<Client[]>({
    queryKey: ["/api/crm/staff", advisorId, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${advisorId}/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: !!advisorId,
  });
  const { data: _filterAdvisor } = useStaffMember(advisorId ?? 0);
  const { data: currentStaff } = useCurrentStaff();
  const { data: allStaff } = useStaffMembers();

  const _showAdvisorCol = managerRoles.includes(currentStaff?.role as UserRole);
  const _staffById = new Map((allStaff ?? []).map(s => [s.id, s]));

  const clients = advisorId ? advisorClients : allClients;
  const _isLoading = advisorId ? advisorLoading : allLoading;

  const [, navigate] = useLocation();
  const [_isAddOpen, setIsAddOpen] = useState(false);
  const [_spousePrompt, setSpousePrompt] = useState<Client | null>(null);
  const [searchTerm, _setSearchTerm] = useState("");

  const _filteredClients = clients?.filter(c => {
    const term = searchTerm.toLowerCase();
    return `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(term);
  });

  const _handleClientCreated = (newClient: Client) => {
    if ((newClient.maritalStatus === "married" || newClient.maritalStatus === "common_law") && !newClient.spouseId) {
      setSpousePrompt(newClient);
    }
  };

  return (
    <AppLayout noPadding>
      <HouseholdQueue onSelect={(id) => navigate(`/clients/${id}`)} />
    </AppLayout>
  );
}