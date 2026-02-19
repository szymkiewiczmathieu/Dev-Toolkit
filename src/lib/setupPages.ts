/** Predefined Salesforce Setup pages for Quick Navigation */

export interface SetupPage {
  label: string;
  path: string;
  category: string;
  icon: string;
  keywords: string[];
}

export const SETUP_PAGES: SetupPage[] = [
  // Objects & Fields
  { label: "Object Manager", path: "/lightning/setup/ObjectManager/home", category: "Objects", icon: "O", keywords: ["object", "field", "custom"] },
  { label: "Custom Metadata Types", path: "/lightning/setup/CustomMetadata/home", category: "Objects", icon: "M", keywords: ["metadata", "custom", "settings"] },
  { label: "Custom Settings", path: "/lightning/setup/CustomSettings/home", category: "Objects", icon: "S", keywords: ["settings", "custom", "hierarchy"] },
  { label: "Custom Labels", path: "/lightning/setup/ExternalStrings/home", category: "Objects", icon: "L", keywords: ["label", "translation", "text"] },

  // Users & Security
  { label: "Users", path: "/lightning/setup/ManageUsers/home", category: "Users", icon: "U", keywords: ["user", "people", "admin"] },
  { label: "Profiles", path: "/lightning/setup/EnhancedProfiles/home", category: "Users", icon: "P", keywords: ["profile", "access", "permission"] },
  { label: "Permission Sets", path: "/lightning/setup/PermSets/home", category: "Users", icon: "P", keywords: ["permission", "set", "access"] },
  { label: "Permission Set Groups", path: "/lightning/setup/PermSetGroups/home", category: "Users", icon: "G", keywords: ["permission", "group"] },
  { label: "Roles", path: "/lightning/setup/Roles/home", category: "Users", icon: "R", keywords: ["role", "hierarchy"] },
  { label: "Sharing Settings", path: "/lightning/setup/SecuritySharing/home", category: "Users", icon: "S", keywords: ["sharing", "owd", "access"] },

  // Automation
  { label: "Flows", path: "/lightning/setup/Flows/home", category: "Automation", icon: "F", keywords: ["flow", "automation", "process"] },
  { label: "Apex Classes", path: "/lightning/setup/ApexClasses/home", category: "Code", icon: "A", keywords: ["apex", "class", "code"] },
  { label: "Apex Triggers", path: "/lightning/setup/ApexTriggers/home", category: "Code", icon: "T", keywords: ["trigger", "apex"] },
  { label: "Approval Processes", path: "/lightning/setup/ApprovalProcesses/home", category: "Automation", icon: "A", keywords: ["approval", "process"] },
  { label: "Scheduled Jobs", path: "/lightning/setup/ScheduledJobs/home", category: "Automation", icon: "J", keywords: ["scheduled", "job", "cron", "batch"] },
  { label: "Apex Jobs", path: "/lightning/setup/AsyncApexJobs/home", category: "Automation", icon: "J", keywords: ["apex", "job", "async", "batch", "queue"] },

  // Deployment
  { label: "Deployment Status", path: "/lightning/setup/DeployStatus/home", category: "Deploy", icon: "D", keywords: ["deploy", "status", "changeset"] },
  { label: "Change Sets (Outbound)", path: "/lightning/setup/OutboundChangeSet/home", category: "Deploy", icon: "C", keywords: ["changeset", "outbound", "deploy"] },
  { label: "Change Sets (Inbound)", path: "/lightning/setup/InboundChangeSet/home", category: "Deploy", icon: "C", keywords: ["changeset", "inbound", "deploy"] },
  { label: "Installed Packages", path: "/lightning/setup/ImportedPackage/home", category: "Deploy", icon: "P", keywords: ["package", "managed", "installed"] },

  // UI
  { label: "Lightning App Builder", path: "/lightning/setup/FlexiPageList/home", category: "UI", icon: "B", keywords: ["lightning", "app", "builder", "page", "flexi"] },
  { label: "Lightning Pages", path: "/lightning/setup/FlexiPageList/home", category: "UI", icon: "P", keywords: ["page", "lightning", "record"] },
  { label: "Tabs", path: "/lightning/setup/CustomTabs/home", category: "UI", icon: "T", keywords: ["tab", "custom"] },
  { label: "App Manager", path: "/lightning/setup/NavigationMenus/home", category: "UI", icon: "A", keywords: ["app", "manager", "navigation"] },
  { label: "Page Layouts", path: "/lightning/setup/ObjectManager/home", category: "UI", icon: "L", keywords: ["layout", "page"] },
  { label: "Record Types", path: "/lightning/setup/ObjectManager/home", category: "UI", icon: "R", keywords: ["record", "type"] },

  // Email
  { label: "Email Deliverability", path: "/lightning/setup/OrgEmailSettings/home", category: "Email", icon: "E", keywords: ["email", "deliverability"] },
  { label: "Email Templates", path: "/lightning/setup/CommunicationTemplatesEmail/home", category: "Email", icon: "E", keywords: ["email", "template"] },
  { label: "Organization-Wide Email", path: "/lightning/setup/OrgWideEmailAddresses/home", category: "Email", icon: "E", keywords: ["email", "orgwide", "from"] },

  // Data
  { label: "Data Import Wizard", path: "/lightning/setup/DataManagementDataImporter/home", category: "Data", icon: "I", keywords: ["import", "data", "wizard"] },
  { label: "Storage Usage", path: "/lightning/setup/CompanyResourceDisk/home", category: "Data", icon: "S", keywords: ["storage", "disk", "usage", "space"] },

  // Integration
  { label: "Named Credentials", path: "/lightning/setup/NamedCredential/home", category: "Integration", icon: "N", keywords: ["named", "credential", "api", "callout"] },
  { label: "External Credentials", path: "/lightning/setup/ExternalCredential/home", category: "Integration", icon: "E", keywords: ["external", "credential", "oauth"] },
  { label: "Connected Apps", path: "/lightning/setup/ConnectedApplication/home", category: "Integration", icon: "C", keywords: ["connected", "app", "oauth"] },
  { label: "Remote Site Settings", path: "/lightning/setup/SecurityRemoteProxy/home", category: "Integration", icon: "R", keywords: ["remote", "site", "callout", "whitelist"] },
  { label: "Platform Events", path: "/lightning/setup/EventObjects/home", category: "Integration", icon: "E", keywords: ["event", "platform", "streaming"] },

  // Debug & Logs
  { label: "Debug Logs", path: "/lightning/setup/ApexDebugLogs/home", category: "Debug", icon: "D", keywords: ["debug", "log", "trace"] },
  { label: "Developer Console", path: "/_ui/common/apex/debug/ApexCSIPage", category: "Debug", icon: "C", keywords: ["developer", "console", "debug"] },

  // Reports
  { label: "Report Types", path: "/lightning/setup/CustomReportTypes/home", category: "Reports", icon: "R", keywords: ["report", "type", "custom"] },

  // Company
  { label: "Company Information", path: "/lightning/setup/CompanyProfileInfo/home", category: "Company", icon: "C", keywords: ["company", "info", "org"] },
  { label: "Translations", path: "/lightning/setup/Translations/home", category: "Company", icon: "T", keywords: ["translation", "language", "i18n"] },
  { label: "Validation Rules", path: "/lightning/setup/ObjectManager/home", category: "Objects", icon: "V", keywords: ["validation", "rule"] },
];

/** Simple fuzzy search for setup pages */
export function searchSetupPages(query: string): SetupPage[] {
  if (!query.trim()) return SETUP_PAGES.slice(0, 15);

  const terms = query.toLowerCase().split(/\s+/);
  const scored = SETUP_PAGES.map((page) => {
    const searchText = [
      page.label,
      page.category,
      ...page.keywords,
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (page.label.toLowerCase().startsWith(term)) {
        score += 10;
      } else if (page.label.toLowerCase().includes(term)) {
        score += 5;
      } else if (searchText.includes(term)) {
        score += 2;
      }
    }
    return { page, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.page).slice(0, 15);
}
