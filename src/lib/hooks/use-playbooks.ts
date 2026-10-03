import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useSelectionStore } from "@/lib/store/selection-store";
import { getPlaybooks } from "@/lib/tauri/commands";
import type { Playbook, PlaybooksState, TierLabels } from "@/lib/tauri/types";

export const DEFAULT_TIER_LABELS: TierLabels = {
  hot: "Hot",
  warm: "Warm",
  nurture: "Nurture",
  disqualified: "Disqualified",
};

export function usePlaybooks() {
  return useQuery({
    queryKey: queryKeys.playbooks,
    queryFn: getPlaybooks,
  });
}

export function useActivePlaybook(): Playbook | undefined {
  const { data } = usePlaybooks();
  return data?.playbooks.find((playbook) => playbook.id === data.activeId);
}

/** Tier names for the active playbook, e.g. "Strong fit" instead of "Hot" */
export function useTierLabels(): TierLabels {
  return useActivePlaybook()?.tierLabels ?? DEFAULT_TIER_LABELS;
}

/**
 * Store the playbooks returned by a playbook command. If the active playbook
 * changed, every list, prompt, and criteria query refers to different data,
 * so refetch all of them and drop any selection from the old lists.
 */
export function applyPlaybooksState(state: PlaybooksState): void {
  const previous = queryClient.getQueryData<PlaybooksState>(queryKeys.playbooks);
  queryClient.setQueryData(queryKeys.playbooks, state);

  if (previous?.activeId !== state.activeId) {
    useSelectionStore.getState().clearAll();
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== queryKeys.playbooks[0],
    });
  }
}
