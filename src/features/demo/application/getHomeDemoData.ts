import { createWelcomeMessage } from "@/features/demo/domain/createWelcomeMessage";

export type HomeDemoData = {
  title: string;
  description: string;
  structure: string[];
};

/**
 * Compose feature-level demo data for the home page.
 * @returns Home demo view model.
 */
export function getHomeDemoData(): HomeDemoData {
  return {
    title: "Next.js Standard Project Structure",
    description: createWelcomeMessage("hub-spoke-forge"),
    structure: ["app", "features", "shared", "server"],
  };
}
