"use client";

import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { EmptyState } from "@/components/ui/empty-state";
import { useIsJobActive } from "@/lib/hooks/use-stream-tabs";
import { useJobSubmission } from "@/lib/hooks/use-job-submission";
import { IconPlayerPlay, IconFileText, IconMessage2 } from "@tabler/icons-react";
import type { ResearchFit } from "@/lib/tauri/types";
import { startConversationGeneration } from "@/lib/tauri/commands";
import { handleStreamEvent } from "@/lib/stream/handle-stream-event";
import { toast } from "sonner";
import { toastJobStarted } from "@/lib/stream/job-toasts";

interface PersonConversationPanelProps {
  personId: number;
  personName: string;
  conversationTopics: string | null;
  companyName: string | null;
  researchFit: ResearchFit | null;
}

export function PersonConversationPanel({
  personId,
  personName,
  conversationTopics,
  companyName,
  researchFit,
}: PersonConversationPanelProps) {
  const isJobActive = useIsJobActive(personId, "conversation");
  const { submit } = useJobSubmission();
  // Research judged them unlikely: the usual pitch doesn't apply, but a smaller ask might
  const notAFit = researchFit === "unlikely";

  const handleStartGeneration = async () => {
    await submit(async () => {
      // Start generation - backend will emit events
      // Event bridge handles tab creation and status updates
      // Logs stream directly via Channel callback for real-time display
      const result = await startConversationGeneration(
        personId,
        handleStreamEvent,
        notAFit ? "not_a_fit" : undefined
      );

      toastJobStarted(
        notAFit
          ? `Drafting a message for ${personName}`
          : `Started talking points for ${personName}`,
        result.jobId
      );
      return result;
    }).catch((error) => {
      console.error("Failed to start conversation generation:", error);
      toast.error("Failed to start conversation generation");
    });
  };

  if (!conversationTopics && notAFit) {
    return (
      <EmptyState
        icon={IconMessage2}
        title="Not a great fit, according to the research"
        description={`Draft a message for ${personName} anyway: an honest note built around their own work, with a smaller ask such as a quick chat, an introduction, or staying in touch.`}
        action={{
          label: "Draft a message",
          loadingLabel: "Drafting...",
          onClick: handleStartGeneration,
          isLoading: isJobActive,
          icon: IconMessage2,
        }}
      />
    );
  }

  if (!conversationTopics) {
    const description = companyName
      ? `Generate personalized conversation topics for ${personName} at ${companyName}.`
      : `Generate personalized conversation topics for ${personName}.`;
    return (
      <EmptyState
        icon={IconFileText}
        title="No conversation topics"
        description={description}
        action={{
          label: "Generate Topics",
          loadingLabel: "Generating...",
          onClick: handleStartGeneration,
          isLoading: isJobActive,
          icon: IconPlayerPlay,
        }}
      />
    );
  }

  return (
    <div className="min-h-[300px]">
      <MarkdownRenderer content={conversationTopics} />
    </div>
  );
}
