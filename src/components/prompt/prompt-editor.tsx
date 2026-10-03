import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconBuilding,
  IconUser,
  IconMessageCircle,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { savePromptByType } from "@/lib/tauri/commands";
import type { PromptType } from "@/lib/tauri/types";
import type { PromptContents } from "@/pages/prompt";

interface PromptEditorProps {
  prompts: PromptContents;
}

/** The company overview has its own page (About you), so it isn't a tab here */
type InstructionType = Exclude<PromptType, "company_overview">;

export function PromptEditor({ prompts }: PromptEditorProps) {
  const [activeTab, setActiveTab] = useState<InstructionType>("company");
  const [contents, setContents] = useState<PromptContents>(() => prompts);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const currentContent = contents[activeTab];

  const setCurrentContent = (value: string) => {
    setContents((prev) => ({ ...prev, [activeTab]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    startTransition(async () => {
      try {
        await savePromptByType(activeTab, currentContent);
        toast.success("Instructions saved");
      } catch (error) {
        toast.error("Couldn't save instructions", {
          description: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      } finally {
        setIsSaving(false);
      }
    });
  };

  const tabs = [
    { id: "company" as const, label: "Company research", icon: IconBuilding },
    { id: "person" as const, label: "Person research", icon: IconUser },
    { id: "conversation_topics" as const, label: "Outreach", icon: IconMessageCircle },
  ];

  return (
    <>
      <div className="border-b border-white/5 px-4">
        <div className="flex gap-4">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-2 text-sm border-b-2 transition-colors -mb-px ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <TabIcon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl">
          <div className="text-sm text-muted-foreground mb-4 space-y-1">
            <p className="text-xs text-muted-foreground/70">
              Every job also reads your{" "}
              <Link to="/about" className="underline underline-offset-2 hover:text-foreground">
                About you
              </Link>{" "}
              description.
            </p>
            {activeTab === "company" && (
              <>
                <p>
                  Instructions for company research. The target company&apos;s details are{" "}
                  <strong>automatically provided</strong>.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Auto-injected: Company name, website, industry, size, LinkedIn URL, location.
                  Focus on what to discover.
                </p>
              </>
            )}
            {activeTab === "person" && (
              <>
                <p>
                  Instructions for researching people. The person&apos;s details AND their company
                  info are <strong>automatically provided</strong>.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Auto-injected: Name, title, email, LinkedIn, company details. Focus on what to
                  research about them.
                </p>
              </>
            )}
            {activeTab === "conversation_topics" && (
              <>
                <p>
                  Instructions for outreach: talking points and messages, written when you click
                  Generate topics. The person&apos;s profile and company info are{" "}
                  <strong>automatically provided</strong>.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Auto-injected: Person details, company details. Focus on what call prep to
                  generate.
                </p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder={
                activeTab === "conversation_topics"
                  ? "What should outreach include and how should it sound?"
                  : `What should ${activeTab} research find out?`
              }
              className="w-full h-96 bg-white/5 border border-white/5 p-3 text-xs font-mono resize-none rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
            />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={isPending || isSaving}>
                {isPending || isSaving ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="size-4" />
                )}
                {isPending || isSaving
                  ? "Saving..."
                  : `Save ${
                      activeTab === "company"
                        ? "company research"
                        : activeTab === "person"
                          ? "person research"
                          : "outreach"
                    } instructions`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
