import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { HostLayout } from "@/components/HostLayout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Users, Search, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Company } from "@shared/schema";

interface CompanyWithCount extends Company {
  userCount: number;
}

export default function BusinessClients() {
  const { isFrench: isFr } = useLanguage();
  const { data: companies, isLoading } = useQuery<CompanyWithCount[]>({
    queryKey: ["/api/crm/host/companies"],
  });
  const [search, setSearch] = useState("");

  const filtered =
    companies?.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contactName?.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-clients-title"
            >
              Business Clients
            </h1>
            <p className="text-muted-foreground mt-1">
              {companies?.length ?? 0} brokerage accounts
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-clients"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-business-clients">
            {filtered.map((company) => (
              <Link key={company.id} href={`/host/clients/${company.id}`}>
                <div
                  data-testid={`card-company-${company.id}`}
                  className="glass-card rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg">
                          {company.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          {company.contactName && (
                            <span className="text-sm text-muted-foreground">
                              {company.contactName}
                            </span>
                          )}
                          {company.billingEmail && (
                            <span className="text-sm text-muted-foreground">
                              {company.billingEmail}
                            </span>
                          )}
                          {company.corporatePhone && (
                            <span className="text-sm text-muted-foreground">
                              {company.corporatePhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{company.userCount} users</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
                          {company.plan}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No business clients found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </HostLayout>
  );
}

