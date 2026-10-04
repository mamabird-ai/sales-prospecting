"use client";

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconSparkles } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CompanyOverviewDialogProps {
  hasCompanyOverview: boolean;
}

/**
 * Points a new playbook at the Your company page, where Claude can draft the
 * profile from a website, instead of asking for an essay in a modal.
 */
export function CompanyOverviewDialog({ hasCompanyOverview }: CompanyOverviewDialogProps) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const open = !hasCompanyOverview && !dismissed && location.pathname !== "/about";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Let&apos;s set up your company</DialogTitle>
          <DialogDescription>
            Claude needs to know what you make and who you&apos;re looking for before it can
            research anything. It takes about a minute, and Claude can draft it from your website.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Later
          </Button>
          <Button
            onClick={() => {
              setDismissed(true);
              navigate("/about");
            }}
          >
            <IconSparkles />
            Set up my company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
