import { NavLink } from "react-router-dom";
import {
  IconBuilding,
  IconUsers,
  IconUserCircle,
  IconFileText,
  IconTargetArrow,
} from "@tabler/icons-react";
import { ModelSelector } from "./model-selector";
import { ChromeToggle } from "./chrome-toggle";
import { JobProgress } from "./job-progress";
import { UsageMeter } from "./usage-meter";
import { PlaybookSwitcher } from "./playbook-switcher";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { useOnboardingStatus } from "@/lib/query";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Lists",
    links: [
      { to: "/lead", label: "Companies", icon: IconBuilding },
      { to: "/people", label: "People", icon: IconUsers },
    ],
  },
  {
    title: "Setup",
    links: [
      { to: "/about", label: "About you", icon: IconUserCircle },
      { to: "/prompt", label: "Research instructions", icon: IconFileText },
      { to: "/scoring", label: "Fit criteria", icon: IconTargetArrow },
    ],
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
      {children}
    </div>
  );
}

export function Sidebar() {
  const { data: onboardingStatus } = useOnboardingStatus();

  return (
    <aside className="w-52 bg-sidebar flex flex-col text-[13px] shrink-0 border-r border-white/5 pt-8">
      <div className="p-2">
        <PlaybookSwitcher />
      </div>

      <nav aria-label="Main" className="flex-1 px-2 py-1 space-y-2 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <SectionLabel>{section.title}</SectionLabel>
            <div className="mt-0.5 space-y-px">
              {section.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded gap-2 px-2 py-1 transition-colors",
                      isActive
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-white/5 space-y-1">
        <JobProgress />
        <UsageMeter />
        <SectionLabel>Settings</SectionLabel>
        <ModelSelector />
        <ChromeToggle />
      </div>

      {onboardingStatus && <OnboardingChecklist status={onboardingStatus} />}
    </aside>
  );
}
